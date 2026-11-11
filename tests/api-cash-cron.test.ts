import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  currentUser: vi.fn(),
  paymentFindUnique: vi.fn(),
  membershipFindFirst: vi.fn(),
  confirmPayment: vi.fn(),
  closePayment: vi.fn(),
  expireStalePayments: vi.fn(),
}));

vi.mock('server-only', () => ({}));
vi.mock('@/lib/env', () => ({ env: { CRON_SECRET: 'cron_secret_123' } }));
vi.mock('@/lib/auth', () => ({ currentUser: mocks.currentUser }));
vi.mock('@/lib/prisma', () => ({ prisma: { payment: { findUnique: mocks.paymentFindUnique }, membership: { findFirst: mocks.membershipFindFirst } } }));
vi.mock('@/lib/payments/settle', () => ({ confirmPayment: mocks.confirmPayment, closePayment: mocks.closePayment }));
vi.mock('@/lib/payments/reconcile', () => ({ expireStalePayments: mocks.expireStalePayments }));

import { POST as cash } from '@/app/api/cash/[paymentId]/route';
import { GET as cron } from '@/app/api/cron/expire-payments/route';

const PAYMENT = '2b9f6a1e-4c7d-4f3a-9b1e-8d6c5a4b3f21';
const act = (body: unknown, paymentId = PAYMENT) =>
  cash(new Request('http://localhost/api/cash/x', { method: 'POST', body: JSON.stringify(body) }), { params: Promise.resolve({ paymentId }) });

beforeEach(() => {
  vi.clearAllMocks();
  mocks.currentUser.mockResolvedValue({ id: 'admin-1' });
  mocks.paymentFindUnique.mockResolvedValue({ id: PAYMENT, provider: 'CASH', amount: 25000, currency: 'XOF', cycle: { circleId: 'circle-1' } });
  mocks.membershipFindFirst.mockResolvedValue({ id: 'm-admin' });
  mocks.confirmPayment.mockResolvedValue('confirmed');
  mocks.closePayment.mockResolvedValue('failed');
});

describe('POST /api/cash/[paymentId]', () => {
  it('requires a signed-in user', async () => {
    mocks.currentUser.mockResolvedValue(null);
    expect((await act({ action: 'confirm' })).status).toBe(401);
  });

  it('rejects an unknown action', async () => {
    expect((await act({ action: 'steal' })).status).toBe(400);
    expect((await act(null)).status).toBe(400);
  });

  it('answers not found for a bad id, a missing payment or one that is not cash', async () => {
    expect((await act({ action: 'confirm' }, 'not-a-uuid')).status).toBe(404);
    mocks.paymentFindUnique.mockResolvedValue(null);
    expect((await act({ action: 'confirm' })).status).toBe(404);
    mocks.paymentFindUnique.mockResolvedValue({ id: PAYMENT, provider: 'WAVE', cycle: { circleId: 'circle-1' } });
    expect((await act({ action: 'confirm' })).status).toBe(404);
    expect(mocks.confirmPayment).not.toHaveBeenCalled();
  });

  it('lets only the organiser of that circle validate', async () => {
    mocks.membershipFindFirst.mockResolvedValue(null);
    expect((await act({ action: 'confirm' })).status).toBe(403);
    expect(mocks.membershipFindFirst).toHaveBeenCalledWith({ where: { userId: 'admin-1', circleId: 'circle-1', role: 'ADMIN' } });
    expect(mocks.confirmPayment).not.toHaveBeenCalled();
  });

  it('confirms with the expected amount and records who validated', async () => {
    const res = await act({ action: 'confirm' });
    expect(mocks.confirmPayment).toHaveBeenCalledWith({ paymentId: PAYMENT, amount: 25000, currency: 'XOF', validatedById: 'admin-1' });
    expect(await res.json()).toEqual({ result: 'confirmed' });
  });

  it('closes the payment when the organiser refuses it', async () => {
    const res = await act({ action: 'refuse' });
    expect(mocks.closePayment).toHaveBeenCalledWith(PAYMENT, 'FAILED', 'cash_refused_by_admin');
    expect(await res.json()).toEqual({ result: 'failed' });
  });
});

describe('GET /api/cron/expire-payments', () => {
  const run = (authorization?: string) => cron(new Request('http://localhost/api/cron/expire-payments', { headers: authorization ? { authorization } : {} }));

  it('refuses a call without the cron secret', async () => {
    expect((await run()).status).toBe(401);
    expect((await run('Bearer wrong')).status).toBe(401);
    expect(mocks.expireStalePayments).not.toHaveBeenCalled();
  });

  it('expires stale payments and reports the count', async () => {
    mocks.expireStalePayments.mockResolvedValue({ scanned: 2, results: { expired: 2 } });
    const res = await run('Bearer cron_secret_123');
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ scanned: 2, results: { expired: 2 } });
  });
});
