import { beforeEach, describe, expect, it, vi } from 'vitest';

type Row = { id: string; status: string; amount: number; currency: string; membershipId: string; cycleId: string; provider: string; providerRef: string | null; failureReason?: string };

const db = vi.hoisted(() => ({
  payments: new Map<string, Row>(),
  contributions: [] as { membershipId: string; cycleId: string; paymentId: string }[],
  ledger: [] as unknown[],
  conflicts: [] as string[],
}));

vi.mock('server-only', () => ({}));
vi.mock('@prisma/client', () => ({ Prisma: { TransactionIsolationLevel: { Serializable: 'Serializable' } } }));
vi.mock('@/lib/prisma', () => {
  const tx = {
    payment: {
      findUnique: async ({ where }: { where: { id: string } }) => db.payments.get(where.id) ?? null,
      update: async ({ where, data }: { where: { id: string }; data: Partial<Row> }) => {
        const row = { ...db.payments.get(where.id)!, ...data };
        db.payments.set(where.id, row);
        return row;
      },
      updateMany: async ({ where, data }: { where: { id: string; status?: string | { in: string[] } }; data: Partial<Row> }) => {
        const row = db.payments.get(where.id);
        const expected = where.status;
        const matches = !!row && (expected === undefined || (typeof expected === 'string' ? row.status === expected : expected.in.includes(row.status)));
        if (!matches) return { count: 0 };
        db.payments.set(where.id, { ...row!, ...data });
        return { count: 1 };
      },
    },
    contribution: {
      findUnique: async ({ where }: { where: { membershipId_cycleId: { membershipId: string; cycleId: string } } }) =>
        db.contributions.find((c) => c.membershipId === where.membershipId_cycleId.membershipId && c.cycleId === where.membershipId_cycleId.cycleId) ?? null,
      create: async ({ data }: { data: { membershipId: string; cycleId: string; paymentId: string } }) => {
        db.contributions.push(data);
        return data;
      },
    },
    membership: {
      findUniqueOrThrow: async () => ({ circleId: 'circle-1', user: { name: 'Aminata B.' } }),
    },
    ledgerEntry: {
      create: async ({ data }: { data: unknown }) => {
        db.ledger.push(data);
        return data;
      },
    },
  };
  const $transaction = async (fn: (t: typeof tx) => unknown) => {
    const code = db.conflicts.shift();
    if (code) throw Object.assign(new Error(code), { code });
    return fn(tx);
  };
  return { prisma: { ...tx, $transaction } };
});

import { closePayment, confirmPayment } from '@/lib/payments/settle';

const seed = (over: Partial<Row> = {}) => {
  const row: Row = { id: 'pay-1', status: 'PENDING', amount: 25000, currency: 'XOF', membershipId: 'm-1', cycleId: 'c-1', provider: 'WAVE', providerRef: 'wave_1', ...over };
  db.payments.set(row.id, row);
  return row;
};

beforeEach(() => {
  db.payments.clear();
  db.contributions.length = 0;
  db.ledger.length = 0;
  db.conflicts.length = 0;
});

describe('confirmPayment', () => {
  it('counts a verified payment exactly once', async () => {
    seed();
    expect(await confirmPayment({ paymentId: 'pay-1', amount: 25000, currency: 'XOF' })).toBe('confirmed');
    expect(db.payments.get('pay-1')!.status).toBe('CONFIRMED');
    expect(db.contributions).toHaveLength(1);
    expect(db.ledger).toHaveLength(1);
  });

  it('ignores the same confirmation arriving twice', async () => {
    seed();
    await confirmPayment({ paymentId: 'pay-1', amount: 25000, currency: 'XOF' });
    expect(await confirmPayment({ paymentId: 'pay-1', amount: 25000, currency: 'XOF' })).toBe('duplicate');
    expect(db.contributions).toHaveLength(1);
  });

  it('parks an amount mismatch for review instead of counting it', async () => {
    seed();
    expect(await confirmPayment({ paymentId: 'pay-1', amount: 20000, currency: 'XOF' })).toBe('needs_review');
    expect(db.payments.get('pay-1')!.status).toBe('NEEDS_REVIEW');
    expect(db.contributions).toHaveLength(0);
  });

  it('parks a currency mismatch for review', async () => {
    seed();
    expect(await confirmPayment({ paymentId: 'pay-1', amount: 25000, currency: 'EUR' })).toBe('needs_review');
    expect(db.contributions).toHaveLength(0);
  });

  it('never counts a second payment for a share that is already paid', async () => {
    seed();
    seed({ id: 'pay-2', providerRef: 'wave_2' });
    await confirmPayment({ paymentId: 'pay-1', amount: 25000, currency: 'XOF' });
    expect(await confirmPayment({ paymentId: 'pay-2', amount: 25000, currency: 'XOF' })).toBe('needs_review');
    expect(db.payments.get('pay-2')!.failureReason).toBe('share_already_paid');
    expect(db.contributions).toHaveLength(1);
  });

  it('rescues an expired payment when the provider really took the money', async () => {
    seed({ status: 'EXPIRED' });
    expect(await confirmPayment({ paymentId: 'pay-1', amount: 25000, currency: 'XOF' })).toBe('confirmed');
  });

  it('refuses to confirm a payment that was never sent to the provider', async () => {
    seed({ status: 'INITIATED' });
    expect(await confirmPayment({ paymentId: 'pay-1', amount: 25000, currency: 'XOF' })).toBe('ignored');
    expect(db.contributions).toHaveLength(0);
  });

  it('reports an unknown payment', async () => {
    expect(await confirmPayment({ paymentId: 'nope', amount: 25000, currency: 'XOF' })).toBe('unknown_payment');
  });

  it('retries when two confirmations collide in the database', async () => {
    seed();
    db.conflicts.push('P2034', 'P2002');
    expect(await confirmPayment({ paymentId: 'pay-1', amount: 25000, currency: 'XOF' })).toBe('confirmed');
    expect(db.contributions).toHaveLength(1);
  });

  it('gives up after three collisions rather than looping', async () => {
    seed();
    db.conflicts.push('P2034', 'P2034', 'P2034');
    await expect(confirmPayment({ paymentId: 'pay-1', amount: 25000, currency: 'XOF' })).rejects.toThrow('P2034');
    expect(db.contributions).toHaveLength(0);
  });

  it('does not retry an error that is not a collision', async () => {
    seed();
    db.conflicts.push('P1001');
    await expect(confirmPayment({ paymentId: 'pay-1', amount: 25000, currency: 'XOF' })).rejects.toThrow('P1001');
  });

  it('writes a ledger line that says how the share was verified', async () => {
    seed();
    seed({ id: 'pay-cash', provider: 'CASH', membershipId: 'm-2', providerRef: null });
    await confirmPayment({ paymentId: 'pay-1', amount: 25000, currency: 'XOF' });
    await confirmPayment({ paymentId: 'pay-cash', amount: 25000, currency: 'XOF', validatedById: 'admin-1' });
    expect(db.ledger).toMatchObject([
      { kind: 'in', text: 'Aminata B. a déposé sa part', meta: 'Wave · vérifié auprès de l’opérateur', amount: 25000 },
      { kind: 'in', meta: 'Espèces · validées par le gestionnaire' },
    ]);
  });
});

describe('closePayment', () => {
  it('expires a live payment', async () => {
    seed();
    expect(await closePayment('pay-1', 'EXPIRED', 'no_confirmation')).toBe('expired');
    expect(db.payments.get('pay-1')!.status).toBe('EXPIRED');
  });

  it('never overwrites a payment that was already confirmed', async () => {
    seed({ status: 'CONFIRMED' });
    expect(await closePayment('pay-1', 'FAILED', 'cancelled_by_member')).toBe('ignored');
    expect(db.payments.get('pay-1')!.status).toBe('CONFIRMED');
  });
});
