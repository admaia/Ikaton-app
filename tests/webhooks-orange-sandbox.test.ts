import { createHmac } from 'node:crypto';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const env = vi.hoisted(() => ({ DEMO_MODE: true, SANDBOX_WEBHOOK_SECRET: 'sandbox_test_secret_0123456789' }));
const mocks = vi.hoisted(() => ({ claimEvent: vi.fn(), markProcessed: vi.fn(), reconcile: vi.fn(), findUnique: vi.fn() }));

vi.mock('server-only', () => ({}));
vi.mock('@/lib/env', () => ({ env }));
vi.mock('@/lib/prisma', () => ({ prisma: { payment: { findUnique: mocks.findUnique } } }));
vi.mock('@/lib/payments/webhook', () => ({ claimEvent: mocks.claimEvent, markProcessed: mocks.markProcessed }));
vi.mock('@/lib/payments/reconcile', () => ({ reconcile: mocks.reconcile }));

import { POST as orange } from '@/app/api/webhooks/orange/route';
import { POST as sandbox } from '@/app/api/webhooks/sandbox/route';
import { hashToken } from '@/lib/payments/verify';

const PAYMENT = '2b9f6a1e-4c7d-4f3a-9b1e-8d6c5a4b3f21';

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  env.DEMO_MODE = true;
  mocks.claimEvent.mockResolvedValue({ id: 'event-row-1' });
  mocks.reconcile.mockResolvedValue('confirmed');
});

describe('POST /api/webhooks/orange', () => {
  const notify = (body: unknown) =>
    orange(new Request('http://localhost/api/webhooks/orange', { method: 'POST', body: typeof body === 'string' ? body : JSON.stringify(body) }));
  const genuine = { status: 'SUCCESS', notif_token: 'nt_1', txnid: 'MP240917.1030.A12345', order_id: PAYMENT };

  beforeEach(() => {
    mocks.findUnique.mockResolvedValue({ id: PAYMENT, provider: 'ORANGE', notifTokenHash: hashToken('nt_1') });
  });

  it('rejects a body that is not JSON', async () => {
    expect((await notify('<xml/>')).status).toBe(400);
  });

  it('rejects a notification with the wrong token and keeps a trace of it', async () => {
    const res = await notify({ ...genuine, notif_token: 'guessed' });
    expect(res.status).toBe(401);
    expect(mocks.claimEvent).toHaveBeenCalledWith('ORANGE', 'forged:MP240917.1030.A12345', false, expect.any(String));
    expect(mocks.reconcile).not.toHaveBeenCalled();
  });

  it('rejects a notification for an unknown or malformed order', async () => {
    expect((await notify({ ...genuine, order_id: 'not-a-uuid' })).status).toBe(401);
    expect(mocks.findUnique).not.toHaveBeenCalled();
    mocks.findUnique.mockResolvedValue(null);
    expect((await notify({ status: 'SUCCESS', notif_token: 'nt_1', order_id: PAYMENT })).status).toBe(401);
    expect(mocks.claimEvent).toHaveBeenLastCalledWith('ORANGE', expect.stringMatching(/^forged:/), false, expect.any(String));
  });

  it('rejects a valid token used on a payment from another provider', async () => {
    mocks.findUnique.mockResolvedValue({ id: PAYMENT, provider: 'WAVE', notifTokenHash: hashToken('nt_1') });
    expect((await notify(genuine)).status).toBe(401);
  });

  it('accepts a genuine notification, then checks the payment with Orange', async () => {
    const res = await notify(genuine);
    expect(res.status).toBe(200);
    expect(mocks.claimEvent).toHaveBeenCalledWith('ORANGE', 'MP240917.1030.A12345:SUCCESS', true, genuine);
    expect(mocks.reconcile).toHaveBeenCalledTimes(1);
    expect(mocks.markProcessed).toHaveBeenCalledWith('event-row-1', 'confirmed');
    expect(await res.json()).toEqual({ ok: true, result: 'confirmed' });
  });

  it('falls back to the payment id when Orange sends no transaction id', async () => {
    await notify({ status: 'SUCCESS', notif_token: 'nt_1', order_id: PAYMENT });
    expect(mocks.claimEvent).toHaveBeenCalledWith('ORANGE', `${PAYMENT}:SUCCESS`, true, expect.any(Object));
  });

  it('answers 200 to a repeated notification without processing it again', async () => {
    mocks.claimEvent.mockResolvedValue(null);
    const res = await notify(genuine);
    expect(await res.json()).toEqual({ ok: true, duplicate: true });
    expect(mocks.reconcile).not.toHaveBeenCalled();
  });
});

describe('POST /api/webhooks/sandbox', () => {
  const sign = (raw: string, secret = env.SANDBOX_WEBHOOK_SECRET, t = Math.floor(Date.now() / 1000)) =>
    `t=${t},v1=${createHmac('sha256', secret).update(`${t}${raw}`).digest('hex')}`;
  const event = JSON.stringify({ id: 'evt_1', data: { id: `sbx_${PAYMENT}`, client_reference: PAYMENT } });
  const deliver = (raw: string, signature?: string) =>
    sandbox(new Request('http://localhost/api/webhooks/sandbox', { method: 'POST', body: raw, headers: signature ? { 'sandbox-signature': signature } : {} }));

  beforeEach(() => {
    mocks.findUnique.mockResolvedValue({ id: PAYMENT, providerRef: `sbx_${PAYMENT}` });
  });

  it('does not exist outside demo mode', async () => {
    env.DEMO_MODE = false;
    expect((await deliver(event, sign(event))).status).toBe(404);
    expect(mocks.claimEvent).not.toHaveBeenCalled();
  });

  it('rejects a body that is not JSON', async () => {
    expect((await deliver('nope', sign('nope'))).status).toBe(400);
  });

  it('rejects a forged, missing or replayed signature', async () => {
    expect((await deliver(event, sign(event, 'guessed-secret'))).status).toBe(401);
    expect((await deliver(event)).status).toBe(401);
    expect((await deliver(event, sign(event, env.SANDBOX_WEBHOOK_SECRET, Math.floor(Date.now() / 1000) - 3600))).status).toBe(401);
    expect(mocks.reconcile).not.toHaveBeenCalled();
    expect(mocks.claimEvent).toHaveBeenCalledWith('SANDBOX', expect.stringMatching(/^forged:evt_1:/), false, event);
  });

  it('accepts a signed event and checks the payment', async () => {
    const res = await deliver(event, sign(event));
    expect(await res.json()).toEqual({ ok: true, result: 'confirmed' });
    expect(mocks.claimEvent).toHaveBeenCalledWith('SANDBOX', 'evt_1', true, JSON.parse(event));
    expect(mocks.markProcessed).toHaveBeenCalledWith('event-row-1', 'confirmed');
  });

  it('ignores the same event delivered twice', async () => {
    mocks.claimEvent.mockResolvedValue(null);
    const res = await deliver(event, sign(event));
    expect(await res.json()).toEqual({ ok: true, duplicate: true });
    expect(mocks.reconcile).not.toHaveBeenCalled();
  });

  it('does nothing for a payment it does not know or a reference that does not match', async () => {
    mocks.findUnique.mockResolvedValue({ id: PAYMENT, providerRef: 'sbx_other' });
    expect(await (await deliver(event, sign(event))).json()).toEqual({ ok: true, result: 'unknown_payment' });
    const stray = JSON.stringify({ data: { id: 'sbx_x', client_reference: 'not-a-uuid' } });
    expect(await (await deliver(stray, sign(stray))).json()).toEqual({ ok: true, result: 'unknown_payment' });
    expect(mocks.reconcile).not.toHaveBeenCalled();
    expect(mocks.markProcessed).toHaveBeenCalledWith('event-row-1', 'unknown_payment');
  });
});
