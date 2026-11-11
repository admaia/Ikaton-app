import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  currentUser: vi.fn(),
  findFirst: vi.fn(),
  findUniqueOrThrow: vi.fn(),
  initiatePayment: vi.fn(),
  freshen: vi.fn(),
  reconcile: vi.fn(),
  closePayment: vi.fn(),
}));

vi.mock('server-only', () => ({}));
vi.mock('@/lib/env', () => ({ env: {} }));
vi.mock('@/lib/auth', () => ({ currentUser: mocks.currentUser }));
vi.mock('@/lib/prisma', () => ({ prisma: { payment: { findFirst: mocks.findFirst, findUniqueOrThrow: mocks.findUniqueOrThrow } } }));
vi.mock('@/lib/payments/initiate', async (original) => ({
  ...(await original<typeof import('@/lib/payments/initiate')>()),
  initiatePayment: mocks.initiatePayment,
}));
vi.mock('@/lib/payments/reconcile', () => ({ freshen: mocks.freshen, reconcile: mocks.reconcile }));
vi.mock('@/lib/payments/settle', () => ({ closePayment: mocks.closePayment }));

import { GET as list, POST as create } from '@/app/api/payments/route';
import { DELETE as cancel, GET as read, POST as check } from '@/app/api/payments/[id]/route';
import { PaymentError } from '@/lib/payments/initiate';

const CYCLE = '7c9e6679-7425-40de-944b-e07fc1f90ae7';
const PAYMENT = '2b9f6a1e-4c7d-4f3a-9b1e-8d6c5a4b3f21';
const KEY = 'attempt-0123456789abcdef';
const row = (over: object = {}) => ({
  id: PAYMENT, status: 'PENDING', provider: 'WAVE', amount: 25000, expiresAt: new Date('2026-09-17T10:45:00Z'),
  confirmedAt: null, failureReason: null, checkoutUrl: 'https://pay.wave.test/1', ...over,
});

const post = (body: unknown, key: string | null = KEY) =>
  create(new Request('http://localhost/api/payments', {
    method: 'POST',
    headers: key ? { 'idempotency-key': key } : {},
    body: typeof body === 'string' ? body : JSON.stringify(body),
  }));
const ctx = (id = PAYMENT) => ({ params: Promise.resolve({ id }) });
const req = new Request('http://localhost/api/payments/x');

beforeEach(() => {
  vi.clearAllMocks();
  mocks.currentUser.mockResolvedValue({ id: 'user-1' });
  mocks.initiatePayment.mockResolvedValue(row());
  mocks.findFirst.mockResolvedValue(row());
  mocks.findUniqueOrThrow.mockResolvedValue(row());
  mocks.freshen.mockImplementation(async (p: unknown) => p);
  mocks.reconcile.mockResolvedValue('ignored');
  mocks.closePayment.mockResolvedValue('failed');
});

describe('POST /api/payments', () => {
  it('requires a signed-in member', async () => {
    mocks.currentUser.mockResolvedValue(null);
    expect((await post({ cycleId: CYCLE, provider: 'WAVE' })).status).toBe(401);
  });

  it('requires an idempotency key of a sane length', async () => {
    for (const key of [null, 'short', 'x'.repeat(81)]) {
      const res = await post({ cycleId: CYCLE, provider: 'WAVE' }, key);
      expect(res.status).toBe(400);
      expect(await res.json()).toEqual({ error: 'missing_idempotency_key' });
    }
    expect(mocks.initiatePayment).not.toHaveBeenCalled();
  });

  it('rejects a body that is not valid', async () => {
    expect((await post('not json')).status).toBe(400);
    expect((await post({ cycleId: 'nope', provider: 'WAVE' })).status).toBe(400);
    expect((await post({ cycleId: CYCLE, provider: 'BITCOIN' })).status).toBe(400);
    expect(mocks.initiatePayment).not.toHaveBeenCalled();
  });

  it('scopes the idempotency key to the member and returns the public payment', async () => {
    const res = await post({ cycleId: CYCLE, provider: 'WAVE' });
    expect(res.status).toBe(200);
    expect(mocks.initiatePayment).toHaveBeenCalledWith({ userId: 'user-1', idempotencyKey: `user-1:${KEY}`, cycleId: CYCLE, provider: 'WAVE' });
    const body = await res.json();
    expect(body).toMatchObject({ id: PAYMENT, status: 'PENDING', checkoutUrl: 'https://pay.wave.test/1' });
    expect(body).not.toHaveProperty('notifTokenHash');
  });

  it('turns a payment rule into its own status code', async () => {
    mocks.initiatePayment.mockRejectedValue(new PaymentError('already_paid', 409));
    const res = await post({ cycleId: CYCLE, provider: 'WAVE' });
    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({ error: 'already_paid' });
  });

  it('does not hide an unexpected failure', async () => {
    mocks.initiatePayment.mockRejectedValue(new Error('connection lost'));
    await expect(post({ cycleId: CYCLE, provider: 'WAVE' })).rejects.toThrow('connection lost');
  });
});

describe('GET /api/payments', () => {
  const get = (query: string) => list(new Request(`http://localhost/api/payments${query}`));

  it('requires a signed-in member and a valid cycle id', async () => {
    expect((await get('?cycleId=nope')).status).toBe(400);
    expect((await get('')).status).toBe(400);
    mocks.currentUser.mockResolvedValue(null);
    expect((await get(`?cycleId=${CYCLE}`)).status).toBe(401);
  });

  it('returns only the member’s own latest payment for the cycle', async () => {
    const res = await get(`?cycleId=${CYCLE}`);
    expect(mocks.findFirst).toHaveBeenCalledWith({ where: { cycleId: CYCLE, membership: { userId: 'user-1' } }, orderBy: { createdAt: 'desc' } });
    expect(mocks.freshen).toHaveBeenCalledTimes(1);
    expect(await res.json()).toMatchObject({ id: PAYMENT });
  });

  it('answers null when there is no payment yet', async () => {
    mocks.findFirst.mockResolvedValue(null);
    expect(await (await get(`?cycleId=${CYCLE}`)).json()).toBeNull();
  });
});

describe('/api/payments/[id]', () => {
  it('answers not found for a bad id, a signed-out visitor or someone else’s payment', async () => {
    expect((await read(req, ctx('not-a-uuid'))).status).toBe(404);
    expect(mocks.findFirst).not.toHaveBeenCalled();
    mocks.findFirst.mockResolvedValue(null);
    expect((await read(req, ctx())).status).toBe(404);
    expect((await check(req, ctx())).status).toBe(404);
    expect((await cancel(req, ctx())).status).toBe(404);
    mocks.currentUser.mockResolvedValue(null);
    expect((await read(req, ctx())).status).toBe(404);
  });

  it('looks the payment up through the member’s own membership', async () => {
    const res = await read(req, ctx());
    expect(mocks.findFirst).toHaveBeenCalledWith({ where: { id: PAYMENT, membership: { userId: 'user-1' } } });
    expect(await res.json()).toMatchObject({ id: PAYMENT, status: 'PENDING' });
  });

  it('checks a pending payment with the provider when asked', async () => {
    mocks.findUniqueOrThrow.mockResolvedValue(row({ status: 'CONFIRMED', confirmedAt: new Date('2026-09-17T10:40:00Z') }));
    const res = await check(req, ctx());
    expect(mocks.reconcile).toHaveBeenCalledTimes(1);
    expect(await res.json()).toMatchObject({ status: 'CONFIRMED', checkoutUrl: null });
  });

  it('does not call the provider for a payment that is already settled', async () => {
    mocks.findFirst.mockResolvedValue(row({ status: 'CONFIRMED' }));
    await check(req, ctx());
    expect(mocks.reconcile).not.toHaveBeenCalled();
  });

  it('cancels a payment the provider has not taken', async () => {
    mocks.findUniqueOrThrow.mockResolvedValue(row({ status: 'FAILED', failureReason: 'cancelled_by_member' }));
    const res = await cancel(req, ctx());
    expect(mocks.closePayment).toHaveBeenCalledWith(PAYMENT, 'FAILED', 'cancelled_by_member');
    expect(await res.json()).toMatchObject({ status: 'FAILED', failureReason: 'cancelled_by_member' });
  });

  it('keeps the payment when the provider already took the money', async () => {
    mocks.reconcile.mockResolvedValue('confirmed');
    mocks.findUniqueOrThrow.mockResolvedValue(row({ status: 'CONFIRMED' }));
    const res = await cancel(req, ctx());
    expect(mocks.closePayment).not.toHaveBeenCalled();
    expect(await res.json()).toMatchObject({ status: 'CONFIRMED' });
  });
});
