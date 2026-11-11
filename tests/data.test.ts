import { beforeEach, describe, expect, it, vi } from 'vitest';

const db = vi.hoisted(() => ({
  membershipFindMany: vi.fn(),
  membershipFindUnique: vi.fn(),
  circleFindUniqueOrThrow: vi.fn(),
  cycleFindFirst: vi.fn(),
  ledgerFindMany: vi.fn(),
  ledgerFindFirst: vi.fn(),
}));

vi.mock('server-only', () => ({}));
vi.mock('@/lib/prisma', () => ({
  prisma: {
    membership: { findMany: db.membershipFindMany, findUnique: db.membershipFindUnique },
    circle: { findUniqueOrThrow: db.circleFindUniqueOrThrow },
    cycle: { findFirst: db.cycleFindFirst },
    ledgerEntry: { findMany: db.ledgerFindMany, findFirst: db.ledgerFindFirst },
  },
}));

import { getCircle, getLedger, getOverview, getPayout } from '@/lib/data';

const DAY = 864e5;
const inDays = (n: number) => new Date(Date.now() + n * DAY);
const member = (id: string, name: string, turn: number | null, role = 'MEMBER') => ({ id, turn, role, user: { name } });

const nafa = (role = 'MEMBER') => ({
  id: 'circle-nafa', name: 'Cercle Nafa', amount: 25000, size: 8, rhythm: 'MONTH', orderMode: 'DRAW', acceptsCash: true, orderSealedAt: new Date(),
  memberships: [member('m-aicha', 'Aïcha K.', 1, role === 'ADMIN' ? 'MEMBER' : 'ADMIN'), member('m-me', 'Aminata B.', 2, role), member('m-salif', 'Salif C.', 3)],
  cycles: [
    {
      id: 'cycle-2', index: 2, status: 'PAID_OUT', dueAt: inDays(-20), closedAt: inDays(-19), beneficiaryId: 'm-aicha',
      contributions: [], payments: [],
    },
    {
      id: 'cycle-3', index: 3, status: 'OPEN', dueAt: inDays(11), closedAt: null, beneficiaryId: 'm-me',
      contributions: [{ membershipId: 'm-aicha', method: 'WAVE' }],
      payments: [{ id: 'pay-cash', membershipId: 'm-salif', provider: 'CASH', amount: 25000, createdAt: inDays(-1) }],
    },
  ],
});

beforeEach(() => {
  vi.clearAllMocks();
  db.ledgerFindMany.mockResolvedValue([]);
  db.cycleFindFirst.mockResolvedValue(null);
});

describe('getOverview', () => {
  const open = nafa().cycles[1];

  it('works out each member’s share: paid, waiting, or still due', async () => {
    db.membershipFindMany.mockResolvedValue([{ id: 'm-me', role: 'MEMBER', turn: 2, circle: { ...nafa(), cycles: [open] } }]);
    const { circles } = await getOverview('user-1');
    expect(circles[0].members.map((m) => m.status)).toEqual(['paid', 'due', 'pending']);
    expect(circles[0]).toMatchObject({
      myStatus: 'due', joined: 3, cashToValidate: 0,
      cycle: { index: 3, paid: 1, pending: 1, beneficiary: 'Aminata B.', iReceive: true },
    });
  });

  it('marks an unpaid share late once the due date has passed', async () => {
    db.membershipFindMany.mockResolvedValue([{ id: 'm-me', role: 'MEMBER', turn: 2, circle: { ...nafa(), cycles: [{ ...open, dueAt: inDays(-1) }] } }]);
    expect((await getOverview('user-1')).circles[0].myStatus).toBe('late');
  });

  it('shows the cash waiting for validation to the organiser only', async () => {
    db.membershipFindMany.mockResolvedValue([{ id: 'm-me', role: 'ADMIN', turn: 2, circle: { ...nafa('ADMIN'), cycles: [open] } }]);
    expect((await getOverview('user-1')).circles[0].cashToValidate).toBe(1);
  });

  it('puts the circle that needs a payment first, then loads its last ledger lines', async () => {
    const paid = { ...open, contributions: [{ membershipId: 'm-me', method: 'WAVE' }], payments: [], beneficiaryId: 'm-gone' };
    db.membershipFindMany.mockResolvedValue([
      { id: 'm-me', role: 'MEMBER', turn: 2, circle: { ...nafa(), id: 'circle-paid', cycles: [paid] } },
      { id: 'm-me', role: 'MEMBER', turn: 2, circle: { ...nafa(), cycles: [open] } },
    ]);
    const lines = [{ id: 'line-1' }];
    db.ledgerFindMany.mockResolvedValue(lines);
    const out = await getOverview('user-1');
    expect(out.focus?.id).toBe('circle-nafa');
    expect(out.ledger).toBe(lines);
    expect(db.ledgerFindMany).toHaveBeenCalledWith({ where: { circleId: 'circle-nafa' }, orderBy: { createdAt: 'desc' }, take: 3 });
    expect(out.circles[0].cycle).toMatchObject({ beneficiary: '', iReceive: false });
  });

  it('handles a circle that has not started yet', async () => {
    db.membershipFindMany.mockResolvedValue([{ id: 'm-me', role: 'ADMIN', turn: null, circle: { ...nafa('ADMIN'), cycles: [] } }]);
    const out = await getOverview('user-1');
    expect(out.circles[0]).toMatchObject({ cycle: null, myStatus: null, cashToValidate: 0 });
    expect(out.focus).toBeNull();
    expect(db.ledgerFindMany).not.toHaveBeenCalled();
  });

  it('reports a recent payout with the full pot', async () => {
    db.membershipFindMany.mockResolvedValue([]);
    db.cycleFindFirst.mockResolvedValue({ circle: { id: 'circle-market', name: 'Tontine du marché', amount: 10000, size: 12 } });
    const out = await getOverview('user-1');
    expect(out.payout).toEqual({ circleId: 'circle-market', name: 'Tontine du marché', total: 120000 });
    expect(out.circles).toEqual([]);
  });
});

describe('getCircle', () => {
  it('shows nothing to someone outside the circle', async () => {
    db.membershipFindUnique.mockResolvedValue(null);
    expect(await getCircle('circle-nafa', 'stranger')).toBeNull();
    db.membershipFindUnique.mockResolvedValue({ id: 'm-me', leftAt: new Date() });
    expect(await getCircle('circle-nafa', 'user-1')).toBeNull();
    expect(db.circleFindUniqueOrThrow).not.toHaveBeenCalled();
  });

  it('describes the open cycle and every member’s share', async () => {
    db.membershipFindUnique.mockResolvedValue({ id: 'm-me', role: 'MEMBER', turn: 2, leftAt: null });
    db.circleFindUniqueOrThrow.mockResolvedValue(nafa());
    const out = (await getCircle('circle-nafa', 'user-1'))!;
    expect(out.circle).toMatchObject({ name: 'Cercle Nafa', sealed: true, admin: 'Aïcha K.', acceptsCash: true });
    expect(out.cycle).toMatchObject({ id: 'cycle-3', index: 3, paid: 1, pending: 1, beneficiary: 'Aminata B.' });
    expect(out.members.map((m) => [m.name, m.status, m.method, m.isMe])).toEqual([
      ['Aïcha K.', 'paid', 'WAVE', false],
      ['Aminata B.', 'due', null, true],
      ['Salif C.', 'pending', 'CASH', false],
    ]);
    expect(out.members[0].receivedAt).toBeInstanceOf(Date);
    expect(out.members[1].receivedAt).toBeNull();
  });

  it('hides declared cash from regular members', async () => {
    db.membershipFindUnique.mockResolvedValue({ id: 'm-me', role: 'MEMBER', turn: 2, leftAt: null });
    db.circleFindUniqueOrThrow.mockResolvedValue(nafa());
    expect((await getCircle('circle-nafa', 'user-1'))!.pendingCash).toEqual([]);
  });

  it('lists declared cash, with names, for the organiser', async () => {
    db.membershipFindUnique.mockResolvedValue({ id: 'm-me', role: 'ADMIN', turn: 2, leftAt: null });
    db.circleFindUniqueOrThrow.mockResolvedValue(nafa('ADMIN'));
    const out = (await getCircle('circle-nafa', 'user-1'))!;
    expect(out.pendingCash).toEqual([{ id: 'pay-cash', amount: 25000, createdAt: expect.any(Date), name: 'Salif C.' }]);
    expect(out.circle.admin).toBe('Aminata B.');
  });

  it('handles a circle that is still filling up', async () => {
    db.membershipFindUnique.mockResolvedValue({ id: 'm-me', role: 'ADMIN', turn: null, leftAt: null });
    db.circleFindUniqueOrThrow.mockResolvedValue({ ...nafa('ADMIN'), orderSealedAt: null, cycles: [] });
    const out = (await getCircle('circle-nafa', 'user-1'))!;
    expect(out.cycle).toBeNull();
    expect(out.circle.sealed).toBe(false);
    expect(out.members.every((m) => m.status === null)).toBe(true);
    expect(out.pendingCash).toEqual([]);
  });
});

describe('getLedger', () => {
  const circle = () => ({
    id: 'circle-nafa', name: 'Cercle Nafa',
    memberships: [member('m-aicha', 'Aïcha K.', 1), member('m-salif', 'Salif C.', 3)],
    cycles: [
      { id: 'cycle-3', index: 3, status: 'OPEN', dueAt: inDays(11), closedAt: null, payments: [{ id: 'pay-cash', membershipId: 'm-salif', amount: 25000, createdAt: inDays(-1) }] },
      { id: 'cycle-2', index: 2, status: 'PAID_OUT', dueAt: inDays(-20), closedAt: inDays(-19), payments: [] },
    ],
    ledger: [
      { id: 'l-in', cycleId: 'cycle-3', kind: 'in', text: 'Aïcha K. a déposé sa part', createdAt: inDays(-2) },
      { id: 'l-fix', cycleId: 'cycle-2', kind: 'fix', text: 'Correction', createdAt: inDays(-25) },
      { id: 'l-open', cycleId: null, kind: 'open', text: 'Le cercle a été ouvert par Aïcha K.', createdAt: inDays(-90) },
    ],
  });

  it('shows nothing to someone outside the circle', async () => {
    db.membershipFindUnique.mockResolvedValue(null);
    expect(await getLedger('circle-nafa', 'stranger')).toBeNull();
    db.membershipFindUnique.mockResolvedValue({ id: 'm-me', leftAt: new Date() });
    expect(await getLedger('circle-nafa', 'user-1')).toBeNull();
  });

  it('adds declared cash as a pending note, newest first', async () => {
    db.membershipFindUnique.mockResolvedValue({ id: 'm-me', leftAt: null });
    db.circleFindUniqueOrThrow.mockResolvedValue(circle());
    const out = (await getLedger('circle-nafa', 'user-1'))!;
    const current = out.cycles[0].rows;
    expect(current.map((r) => r.id)).toEqual(['pay-cash', 'l-in']);
    expect(current[0]).toMatchObject({ kind: 'note', text: 'Salif C. déclare avoir remis 25 000 en espèces', meta: 'En attente de validation', amount: null });
  });

  it('groups lines by cycle and keeps circle-level lines apart', async () => {
    db.membershipFindUnique.mockResolvedValue({ id: 'm-me', leftAt: null });
    db.circleFindUniqueOrThrow.mockResolvedValue(circle());
    const out = (await getLedger('circle-nafa', 'user-1'))!;
    expect(out.circle).toEqual({ id: 'circle-nafa', name: 'Cercle Nafa', members: 2 });
    expect(out.cycles.map((c) => [c.index, c.rows.length])).toEqual([[3, 2], [2, 1]]);
    expect(out.loose.map((r) => r.id)).toEqual(['l-open']);
    expect(out.total).toBe(4);
    expect(out.fixes).toBe(1);
  });
});

describe('getPayout', () => {
  const circle = (cycles: object[]) => ({ id: 'circle-market', name: 'Tontine du marché', amount: 10000, size: 12, rhythm: 'WEEK', cycles, _count: { memberships: 12 } });

  it('shows nothing to someone outside the circle', async () => {
    db.membershipFindUnique.mockResolvedValue(null);
    expect(await getPayout('circle-market', 'stranger')).toBeNull();
    db.membershipFindUnique.mockResolvedValue({ id: 'm-me', leftAt: new Date() });
    expect(await getPayout('circle-market', 'user-1')).toBeNull();
  });

  it('shows nothing before the member has a turn', async () => {
    db.membershipFindUnique.mockResolvedValue({ id: 'm-me', leftAt: null });
    db.circleFindUniqueOrThrow.mockResolvedValue(circle([]));
    expect(await getPayout('circle-market', 'user-1')).toBeNull();
  });

  it('reads how the pot was sent from the ledger line', async () => {
    db.membershipFindUnique.mockResolvedValue({ id: 'm-me', leftAt: null });
    db.circleFindUniqueOrThrow.mockResolvedValue(circle([{ id: 'cycle-4', index: 4, status: 'PAID_OUT', dueAt: inDays(-30), closedAt: inDays(-29) }]));
    db.ledgerFindFirst.mockResolvedValue({ meta: 'Orange Money · 120 000' });
    expect(await getPayout('circle-market', 'user-1')).toMatchObject({ cycleIndex: 4, paidOut: true, via: 'Orange Money', members: 12 });
    expect(db.ledgerFindFirst).toHaveBeenCalledWith({ where: { cycleId: 'cycle-4', kind: 'out' } });
  });

  it('announces a turn that has not been paid out yet', async () => {
    db.membershipFindUnique.mockResolvedValue({ id: 'm-me', leftAt: null });
    db.circleFindUniqueOrThrow.mockResolvedValue(circle([{ id: 'cycle-9', index: 9, status: 'OPEN', dueAt: inDays(2), closedAt: null }]));
    db.ledgerFindFirst.mockResolvedValue(null);
    expect(await getPayout('circle-market', 'user-1')).toMatchObject({ cycleIndex: 9, paidOut: false, via: null, closedAt: null });
  });
});
