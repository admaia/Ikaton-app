import { createHmac } from 'node:crypto';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { SECRET } = vi.hoisted(() => ({ SECRET: 'whsec_test_secret_123' }));
const PAYMENT_ID = '2b9f6a1e-4c7d-4f3a-9b1e-8d6c5a4b3f21';

const mocks = vi.hoisted(() => ({
  claimEvent: vi.fn(),
  markProcessed: vi.fn(),
  reconcile: vi.fn(),
  findUnique: vi.fn(),
}));

vi.mock('server-only', () => ({}));
vi.mock('@/lib/env', () => ({ env: { WAVE_WEBHOOK_SECRET: SECRET } }));
vi.mock('@/lib/prisma', () => ({ prisma: { payment: { findUnique: mocks.findUnique } } }));
vi.mock('@/lib/payments/webhook', () => ({ claimEvent: mocks.claimEvent, markProcessed: mocks.markProcessed }));
vi.mock('@/lib/payments/reconcile', () => ({ reconcile: mocks.reconcile }));

import { POST } from '@/app/api/webhooks/wave/route';

const body = JSON.stringify({ id: 'evt_1', type: 'checkout.session.completed', data: { id: 'wave_ref_1', client_reference: PAYMENT_ID } });
const sign = (raw: string, secret = SECRET, t = Math.floor(Date.now() / 1000)) =>
  `t=${t},v1=${createHmac('sha256', secret).update(`${t}${raw}`).digest('hex')}`;
const call = (raw: string, signature?: string) =>
  POST(new Request('http://localhost/api/webhooks/wave', { method: 'POST', body: raw, headers: signature ? { 'wave-signature': signature } : {} }));

beforeEach(() => {
  vi.clearAllMocks();
  mocks.claimEvent.mockResolvedValue({ id: 'event-row-1' });
  mocks.markProcessed.mockResolvedValue(undefined);
  mocks.reconcile.mockResolvedValue('confirmed');
  mocks.findUnique.mockResolvedValue({ id: PAYMENT_ID, providerRef: 'wave_ref_1' });
});

describe('POST /api/webhooks/wave', () => {
  it('rejects a forged signature and touches no payment', async () => {
    const res = await call(body, sign(body, 'guessed-secret'));
    expect(res.status).toBe(401);
    expect(mocks.reconcile).not.toHaveBeenCalled();
    expect(mocks.claimEvent).toHaveBeenCalledWith('WAVE', expect.stringMatching(/^forged:/), false, body);
  });

  it('rejects a request with no signature', async () => {
    const res = await call(body);
    expect(res.status).toBe(401);
    expect(mocks.reconcile).not.toHaveBeenCalled();
  });

  it('rejects a genuine signature replayed an hour later', async () => {
    const res = await call(body, sign(body, SECRET, Math.floor(Date.now() / 1000) - 3600));
    expect(res.status).toBe(401);
    expect(mocks.reconcile).not.toHaveBeenCalled();
  });

  it('accepts a genuine event and checks the payment with the provider', async () => {
    const res = await call(body, sign(body));
    expect(res.status).toBe(200);
    expect(mocks.reconcile).toHaveBeenCalledTimes(1);
  });

  it('answers 200 to a redelivered event without processing it again', async () => {
    mocks.claimEvent.mockResolvedValue(null);
    const res = await call(body, sign(body));
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ duplicate: true });
    expect(mocks.reconcile).not.toHaveBeenCalled();
  });

  it('ignores an event whose reference is not a valid payment id', async () => {
    const raw = JSON.stringify({ id: 'evt_2', data: { id: 'wave_ref_1', client_reference: 'not-a-uuid' } });
    const res = await call(raw, sign(raw));
    expect(res.status).toBe(200);
    expect(mocks.findUnique).not.toHaveBeenCalled();
    expect(mocks.reconcile).not.toHaveBeenCalled();
  });
});
