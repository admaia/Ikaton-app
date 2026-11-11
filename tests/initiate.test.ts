import { beforeEach, describe, expect, it, vi } from 'vitest';

const db = vi.hoisted(() => ({
  paymentFindUnique: vi.fn(),
  paymentFindFirst: vi.fn(),
  paymentCreate: vi.fn(),
  paymentUpdate: vi.fn(),
  cycleFindUnique: vi.fn(),
  membershipFindUnique: vi.fn(),
  contributionFindUnique: vi.fn(),
}));
const provider = vi.hoisted(() => ({ createCheckout: vi.fn(), providerFor: vi.fn() }));
const env = vi.hoisted(() => ({ DEMO_MODE: true, APP_URL: 'https://ikaton.test', SANDBOX_TIMEOUT_MINUTES: 2, PAYMENT_TIMEOUT_MINUTES: 15 }));

vi.mock('server-only', () => ({}));
vi.mock('@/lib/env', () => ({ env }));
vi.mock('@/lib/payments/providers', () => ({ providerFor: provider.providerFor }));
vi.mock('@/lib/prisma', () => ({
  prisma: {
    payment: { findUnique: db.paymentFindUnique, findFirst: db.paymentFindFirst, create: db.paymentCreate, update: db.paymentUpdate },
    cycle: { findUnique: db.cycleFindUnique },
    membership: { findUnique: db.membershipFindUnique },
    contribution: { findUnique: db.contributionFindUnique },
  },
}));

import { initiatePayment, PaymentError, toPublic } from '@/lib/payments/initiate';
import { hashToken } from '@/lib/payments/verify';

const dueAt = new Date('2026-09-28T00:00:00Z');
const opts = { userId: 'user-1', cycleId: 'cycle-1', provider: 'WAVE' as const, idempotencyKey: 'user-1:key-0123456789' };
const created = { id: 'pay-1', amount: 25000, currency: 'XOF', status: 'INITIATED' };

const code = (p: Promise<unknown>) => p.then(() => 'no error', (e: PaymentError) => e.code);

beforeEach(() => {
  vi.clearAllMocks();
  env.DEMO_MODE = true;
  db.paymentFindUnique.mockResolvedValue(null);
  db.paymentFindFirst.mockResolvedValue(null);
  db.cycleFindUnique.mockResolvedValue({ id: 'cycle-1', circleId: 'circle-1', status: 'OPEN', dueAt, circle: { amount: 25000, acceptsCash: true } });
  db.membershipFindUnique.mockResolvedValue({ id: 'm-1', leftAt: null });
  db.contributionFindUnique.mockResolvedValue(null);
  db.paymentCreate.mockResolvedValue(created);
  db.paymentUpdate.mockImplementation(async ({ data }: { data: object }) => ({ ...created, ...data }));
  provider.providerFor.mockReturnValue({ createCheckout: provider.createCheckout });
  provider.createCheckout.mockResolvedValue({ providerRef: 'wave_ref_1', checkoutUrl: 'https://pay.wave.test/1' });
});

describe('initiatePayment', () => {
  it('returns the same payment when the request is sent twice', async () => {
    const first = { id: 'pay-0' };
    db.paymentFindUnique.mockResolvedValue(first);
    expect(await initiatePayment(opts)).toBe(first);
    expect(db.paymentCreate).not.toHaveBeenCalled();
  });

  it('refuses the demo operator outside demo mode', async () => {
    env.DEMO_MODE = false;
    expect(await code(initiatePayment({ ...opts, provider: 'SANDBOX' }))).toBe('provider_unavailable');
  });

  it('refuses a cycle that is closed or does not exist', async () => {
    db.cycleFindUnique.mockResolvedValue(null);
    expect(await code(initiatePayment(opts))).toBe('cycle_closed');
    db.cycleFindUnique.mockResolvedValue({ id: 'cycle-1', status: 'PAID_OUT' });
    expect(await code(initiatePayment(opts))).toBe('cycle_closed');
  });

  it('refuses someone who is not in the circle, or who left it', async () => {
    db.membershipFindUnique.mockResolvedValue(null);
    expect(await code(initiatePayment(opts))).toBe('not_member');
    db.membershipFindUnique.mockResolvedValue({ id: 'm-1', leftAt: new Date() });
    expect(await code(initiatePayment(opts))).toBe('not_member');
  });

  it('refuses cash when the circle does not accept it', async () => {
    db.cycleFindUnique.mockResolvedValue({ id: 'cycle-1', circleId: 'circle-1', status: 'OPEN', dueAt, circle: { amount: 25000, acceptsCash: false } });
    expect(await code(initiatePayment({ ...opts, provider: 'CASH' }))).toBe('cash_refused');
  });

  it('refuses a second payment for a share that is already paid', async () => {
    db.contributionFindUnique.mockResolvedValue({ id: 'contribution-1' });
    expect(await code(initiatePayment(opts))).toBe('already_paid');
    expect(db.paymentCreate).not.toHaveBeenCalled();
  });

  it('reuses the attempt that is still running instead of opening another', async () => {
    const live = { id: 'pay-live', expiresAt: new Date(Date.now() + 60_000) };
    db.paymentFindFirst.mockResolvedValue(live);
    expect(await initiatePayment(opts)).toBe(live);
    expect(db.paymentCreate).not.toHaveBeenCalled();
  });

  it('opens a new attempt when the previous one has run out of time', async () => {
    db.paymentFindFirst.mockResolvedValue({ id: 'pay-old', expiresAt: new Date(Date.now() - 60_000) });
    const p = await initiatePayment(opts);
    expect(db.paymentCreate).toHaveBeenCalledTimes(1);
    expect(p.status).toBe('PENDING');
  });

  it('sends the member to the provider and keeps the reference', async () => {
    const p = await initiatePayment(opts);
    expect(provider.createCheckout).toHaveBeenCalledWith({
      paymentId: 'pay-1',
      amount: 25000,
      currency: 'XOF',
      returnUrl: 'https://ikaton.test/pay/return',
      notifyUrl: 'https://ikaton.test/api/webhooks/wave',
    });
    expect(p).toMatchObject({ status: 'PENDING', providerRef: 'wave_ref_1', checkoutUrl: 'https://pay.wave.test/1', notifTokenHash: null });
  });

  it('stores only a hash of the notification token', async () => {
    provider.createCheckout.mockResolvedValue({ providerRef: 'om_1', checkoutUrl: 'https://om.test/1', notifToken: 'secret-token' });
    const p = await initiatePayment({ ...opts, provider: 'ORANGE' });
    expect(p.notifTokenHash).toBe(hashToken('secret-token'));
  });

  it('gives a mobile money payment the configured timeout', async () => {
    const before = Date.now();
    await initiatePayment(opts);
    const expiresAt: Date = db.paymentCreate.mock.calls[0][0].data.expiresAt;
    expect(expiresAt.getTime() - before).toBeGreaterThanOrEqual(15 * 60_000 - 50);
    expect(expiresAt.getTime() - before).toBeLessThan(15 * 60_000 + 5_000);
  });

  it('gives the demo operator its own shorter timeout', async () => {
    const before = Date.now();
    await initiatePayment({ ...opts, provider: 'SANDBOX' });
    const expiresAt: Date = db.paymentCreate.mock.calls[0][0].data.expiresAt;
    expect(expiresAt.getTime() - before).toBeLessThan(2 * 60_000 + 5_000);
  });

  it('keeps a cash payment pending until three days after the due date, with no provider call', async () => {
    const p = await initiatePayment({ ...opts, provider: 'CASH' });
    expect(db.paymentCreate.mock.calls[0][0].data.expiresAt).toEqual(new Date('2026-10-01T00:00:00Z'));
    expect(p.status).toBe('PENDING');
    expect(provider.providerFor).not.toHaveBeenCalled();
  });

  it('fails the payment when the method is not available yet', async () => {
    provider.providerFor.mockReturnValue(null);
    expect(await code(initiatePayment({ ...opts, provider: 'MOOV' }))).toBe('provider_unavailable');
    expect(db.paymentUpdate).toHaveBeenCalledWith({ where: { id: 'pay-1' }, data: { status: 'FAILED', failureReason: 'provider_unavailable' } });
  });

  it('fails the payment cleanly when the provider cannot be reached', async () => {
    provider.createCheckout.mockRejectedValue(new Error('wave_503'));
    const p = await initiatePayment(opts);
    expect(p).toMatchObject({ status: 'FAILED', failureReason: 'provider_unreachable' });
  });

  it('returns the winner when two requests race for the same share', async () => {
    const winner = { id: 'pay-winner' };
    db.paymentCreate.mockRejectedValue({ code: 'P2002' });
    db.paymentFindFirst.mockResolvedValueOnce(null).mockResolvedValueOnce(winner);
    expect(await initiatePayment(opts)).toBe(winner);
  });

  it('lets an unexpected database error through', async () => {
    db.paymentCreate.mockRejectedValue(new Error('connection lost'));
    await expect(initiatePayment(opts)).rejects.toThrow('connection lost');
  });
});

describe('toPublic', () => {
  const row = {
    id: 'pay-1', status: 'PENDING', provider: 'WAVE', amount: 25000, expiresAt: new Date('2026-09-17T10:45:00Z'),
    confirmedAt: null, failureReason: null, checkoutUrl: 'https://pay.wave.test/1', notifTokenHash: 'hash', providerRef: 'wave_ref_1',
  } as unknown as Parameters<typeof toPublic>[0];

  it('exposes only what the member needs', () => {
    expect(toPublic(row)).toEqual({
      id: 'pay-1', status: 'PENDING', provider: 'WAVE', amount: 25000, expiresAt: '2026-09-17T10:45:00.000Z',
      confirmedAt: null, failureReason: null, checkoutUrl: 'https://pay.wave.test/1',
    });
  });

  it('hides the checkout link once the payment is no longer pending', () => {
    const done = { ...row, status: 'CONFIRMED', confirmedAt: new Date('2026-09-17T10:40:00Z') } as typeof row;
    expect(toPublic(done)).toMatchObject({ checkoutUrl: null, confirmedAt: '2026-09-17T10:40:00.000Z' });
  });
});
