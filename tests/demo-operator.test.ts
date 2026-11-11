import { beforeEach, describe, expect, it, vi } from 'vitest';

const env = vi.hoisted(() => ({ DEMO_MODE: true, SANDBOX_WEBHOOK_SECRET: 'sandbox_test_secret_0123456789' }));
const state = vi.hoisted(() => ({ seen: new Set<string>(), txn: 'pending', status: 'PENDING' }));
const mocks = vi.hoisted(() => ({ currentUser: vi.fn(), findFirst: vi.fn(), txnUpdate: vi.fn() }));

vi.mock('server-only', () => ({}));
vi.mock('@/lib/env', () => ({ env }));
vi.mock('@/lib/auth', () => ({ currentUser: mocks.currentUser }));

const PAYMENT = '2b9f6a1e-4c7d-4f3a-9b1e-8d6c5a4b3f21';
const payment = () => ({ id: PAYMENT, providerRef: `sbx_${PAYMENT}`, status: state.status, expiresAt: new Date('2026-09-17T10:45:00Z') });

vi.mock('@/lib/prisma', () => ({
  prisma: {
    payment: { findFirst: mocks.findFirst, findUnique: async () => payment(), findUniqueOrThrow: async () => payment() },
    sandboxTxn: { update: mocks.txnUpdate },
  },
}));
vi.mock('@/lib/payments/webhook', () => ({
  claimEvent: async (_provider: string, eventId: string) => {
    if (state.seen.has(eventId)) return null;
    state.seen.add(eventId);
    return { id: eventId };
  },
  markProcessed: async () => undefined,
}));
vi.mock('@/lib/payments/reconcile', () => ({
  reconcile: async () => {
    if (state.txn === 'failed') {
      state.status = 'FAILED';
      return 'failed';
    }
    if (state.status === 'CONFIRMED') return 'duplicate';
    state.status = 'CONFIRMED';
    return 'confirmed';
  },
}));

import { POST } from '@/app/api/sandbox/[paymentId]/route';

const play = (action: unknown, paymentId = PAYMENT) =>
  POST(new Request('http://localhost/api/sandbox/x', { method: 'POST', body: JSON.stringify({ action }) }), { params: Promise.resolve({ paymentId }) });
const lines = async (res: Response) => ((await res.json()) as { log: { label: string; http: number; answer: string }[] }).log.map((l) => [l.label, l.http, l.answer]);

beforeEach(() => {
  vi.clearAllMocks();
  env.DEMO_MODE = true;
  state.seen.clear();
  state.txn = 'pending';
  state.status = 'PENDING';
  mocks.currentUser.mockResolvedValue({ id: 'user-1' });
  mocks.findFirst.mockImplementation(async () => payment());
  mocks.txnUpdate.mockImplementation(async ({ data }: { data: { status: string } }) => {
    state.txn = data.status;
  });
});

describe('POST /api/sandbox/[paymentId]', () => {
  it('does not exist outside demo mode', async () => {
    env.DEMO_MODE = false;
    expect((await play('approve')).status).toBe(404);
  });

  it('requires a signed-in member and a known action', async () => {
    expect((await play('refund')).status).toBe(400);
    mocks.currentUser.mockResolvedValue(null);
    expect((await play('approve')).status).toBe(401);
  });

  it('only plays on the member’s own demo payment', async () => {
    expect((await play('approve', 'not-a-uuid')).status).toBe(404);
    mocks.findFirst.mockResolvedValue(null);
    expect((await play('approve')).status).toBe(404);
    expect(mocks.findFirst).toHaveBeenCalledWith({ where: { id: PAYMENT, provider: 'SANDBOX', membership: { userId: 'user-1' } } });
  });

  it('approve: one signed confirmation, counted', async () => {
    const res = await play('approve');
    expect(await lines(res)).toEqual([['signed', 200, 'confirmed']]);
    expect(state.status).toBe('CONFIRMED');
  });

  it('double: the same confirmation sent three ways is counted once', async () => {
    const res = await play('double');
    expect(await lines(res)).toEqual([
      ['first', 200, 'confirmed'],
      ['resent', 200, 'duplicate'],
      ['again', 200, 'duplicate'],
    ]);
  });

  it('decline: the payment is closed, not counted', async () => {
    const res = await play('decline');
    expect(await lines(res)).toEqual([['declined', 200, 'failed']]);
    expect(state.status).toBe('FAILED');
  });

  it('forge: a wrong secret, no signature and a replay are all rejected', async () => {
    const res = await play('forge');
    expect(await lines(res)).toEqual([
      ['forged', 401, 'invalid_signature'],
      ['unsigned', 401, 'invalid_signature'],
      ['replayed', 401, 'invalid_signature'],
    ]);
    expect(state.status).toBe('PENDING');
    expect(mocks.txnUpdate).not.toHaveBeenCalled();
  });

  it('silent: the operator sends nothing and the payment keeps waiting', async () => {
    const res = await play('silent');
    expect(await res.json()).toEqual({ log: [], status: 'PENDING', expiresAt: '2026-09-17T10:45:00.000Z' });
  });
});
