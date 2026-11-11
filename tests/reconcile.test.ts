import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Payment } from '@prisma/client';

const mocks = vi.hoisted(() => ({
  findMany: vi.fn(),
  findUniqueOrThrow: vi.fn(),
  providerFor: vi.fn(),
  fetchStatus: vi.fn(),
  confirmPayment: vi.fn(),
  closePayment: vi.fn(),
}));

vi.mock('server-only', () => ({}));
vi.mock('@/lib/prisma', () => ({ prisma: { payment: { findMany: mocks.findMany, findUniqueOrThrow: mocks.findUniqueOrThrow } } }));
vi.mock('@/lib/payments/providers', () => ({ providerFor: mocks.providerFor }));
vi.mock('@/lib/payments/settle', () => ({ confirmPayment: mocks.confirmPayment, closePayment: mocks.closePayment }));

import { expireStalePayments, freshen, reconcile } from '@/lib/payments/reconcile';

const payment = (over: Partial<Payment> = {}) =>
  ({ id: 'pay-1', provider: 'WAVE', status: 'PENDING', providerRef: 'wave_ref_1', amount: 25000, expiresAt: new Date(Date.now() + 60_000), ...over }) as Payment;

beforeEach(() => {
  vi.clearAllMocks();
  mocks.providerFor.mockReturnValue({ fetchStatus: mocks.fetchStatus });
  mocks.fetchStatus.mockResolvedValue({ status: 'pending' });
  mocks.confirmPayment.mockResolvedValue('confirmed');
  mocks.closePayment.mockImplementation(async (_id: string, to: string) => (to === 'FAILED' ? 'failed' : 'expired'));
});

describe('reconcile', () => {
  it('confirms with the amount the provider reports, never the one we expect', async () => {
    mocks.fetchStatus.mockResolvedValue({ status: 'succeeded', amount: 20000, currency: 'XOF' });
    expect(await reconcile(payment())).toBe('confirmed');
    expect(mocks.confirmPayment).toHaveBeenCalledWith({ paymentId: 'pay-1', amount: 20000, currency: 'XOF', providerRef: 'wave_ref_1' });
  });

  it('sends a success with no amount to review by passing values that cannot match', async () => {
    mocks.fetchStatus.mockResolvedValue({ status: 'succeeded' });
    await reconcile(payment({ providerRef: null }));
    expect(mocks.confirmPayment).toHaveBeenCalledWith({ paymentId: 'pay-1', amount: -1, currency: '', providerRef: undefined });
  });

  it('closes a payment the provider declined', async () => {
    mocks.fetchStatus.mockResolvedValue({ status: 'failed' });
    expect(await reconcile(payment())).toBe('failed');
    expect(mocks.closePayment).toHaveBeenCalledWith('pay-1', 'FAILED', 'declined_by_provider');
  });

  it('changes nothing while the provider is still waiting', async () => {
    expect(await reconcile(payment())).toBe('ignored');
    expect(mocks.confirmPayment).not.toHaveBeenCalled();
    expect(mocks.closePayment).not.toHaveBeenCalled();
  });

  it('changes nothing when the provider cannot be reached', async () => {
    mocks.fetchStatus.mockRejectedValue(new Error('timeout'));
    expect(await reconcile(payment())).toBe('ignored');
  });

  it('never asks a provider about cash', async () => {
    mocks.providerFor.mockReturnValue(null);
    expect(await reconcile(payment({ provider: 'CASH' }))).toBe('ignored');
    expect(mocks.fetchStatus).not.toHaveBeenCalled();
  });
});

describe('expireStalePayments', () => {
  it('asks only for live payments past their deadline, oldest first', async () => {
    mocks.findMany.mockResolvedValue([]);
    const now = new Date('2026-09-17T10:00:00Z');
    expect(await expireStalePayments(now, 50)).toEqual({ scanned: 0, results: {} });
    expect(mocks.findMany).toHaveBeenCalledWith({
      where: { status: { in: ['INITIATED', 'PENDING'] }, expiresAt: { lt: now } },
      orderBy: { expiresAt: 'asc' },
      take: 50,
    });
  });

  it('checks with the provider one last time before expiring', async () => {
    mocks.findMany.mockResolvedValue([payment({ id: 'paid-late' }), payment({ id: 'silent' }), payment({ id: 'cash', provider: 'CASH' })]);
    mocks.fetchStatus.mockResolvedValueOnce({ status: 'succeeded', amount: 25000, currency: 'XOF' }).mockResolvedValue({ status: 'pending' });
    expect(await expireStalePayments()).toEqual({ scanned: 3, results: { confirmed: 1, expired: 2 } });
    expect(mocks.closePayment).toHaveBeenCalledWith('silent', 'EXPIRED', 'no_confirmation');
    expect(mocks.closePayment).toHaveBeenCalledWith('cash', 'EXPIRED', 'cash_not_validated');
  });
});

describe('freshen', () => {
  it('returns a payment that still has time as it is', async () => {
    const p = payment();
    expect(await freshen(p)).toBe(p);
    expect(mocks.fetchStatus).not.toHaveBeenCalled();
  });

  it('returns a finished payment as it is, even past its deadline', async () => {
    const p = payment({ status: 'CONFIRMED', expiresAt: new Date(Date.now() - 60_000) });
    expect(await freshen(p)).toBe(p);
  });

  it('expires an overdue payment on read, so the screen never shows a stale wait', async () => {
    const fresh = payment({ status: 'EXPIRED' });
    mocks.findUniqueOrThrow.mockResolvedValue(fresh);
    expect(await freshen(payment({ expiresAt: new Date(Date.now() - 60_000) }))).toBe(fresh);
    expect(mocks.closePayment).toHaveBeenCalledWith('pay-1', 'EXPIRED', 'no_confirmation');
  });

  it('expires overdue cash with its own reason', async () => {
    mocks.findUniqueOrThrow.mockResolvedValue(payment({ status: 'EXPIRED' }));
    await freshen(payment({ provider: 'CASH', status: 'INITIATED', expiresAt: new Date(Date.now() - 60_000) }));
    expect(mocks.closePayment).toHaveBeenCalledWith('pay-1', 'EXPIRED', 'cash_not_validated');
  });

  it('keeps a late success instead of expiring it', async () => {
    mocks.fetchStatus.mockResolvedValue({ status: 'succeeded', amount: 25000, currency: 'XOF' });
    mocks.findUniqueOrThrow.mockResolvedValue(payment({ status: 'CONFIRMED' }));
    const out = await freshen(payment({ expiresAt: new Date(Date.now() - 60_000) }));
    expect(out.status).toBe('CONFIRMED');
    expect(mocks.closePayment).not.toHaveBeenCalled();
  });
});
