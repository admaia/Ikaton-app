import 'server-only';
import { prisma } from './prisma';

export type ShareStatus = 'paid' | 'pending' | 'late' | 'due';

const LIVE = { in: ['INITIATED', 'PENDING'] as ('INITIATED' | 'PENDING')[] };

function shareStatus(paid: boolean, pending: boolean, dueAt: Date, now: Date): ShareStatus {
  if (paid) return 'paid';
  if (pending) return 'pending';
  return dueAt < now ? 'late' : 'due';
}

export async function getOverview(userId: string) {
  const now = new Date();
  const memberships = await prisma.membership.findMany({
    where: { userId, leftAt: null },
    orderBy: { joinedAt: 'asc' },
    include: {
      circle: {
        include: {
          memberships: { where: { leftAt: null }, include: { user: { select: { name: true } } }, orderBy: { turn: 'asc' } },
          cycles: {
            where: { status: 'OPEN' },
            take: 1,
            include: { contributions: true, payments: { where: { status: LIVE } } },
          },
        },
      },
    },
  });

  const circles = memberships.map((m) => {
    const c = m.circle;
    const cycle = c.cycles[0] ?? null;
    const members = c.memberships.map((x) => {
      const paid = !!cycle?.contributions.some((k) => k.membershipId === x.id);
      const pending = !!cycle?.payments.some((p) => p.membershipId === x.id);
      return { id: x.id, name: x.user.name, status: cycle ? shareStatus(paid, pending, cycle.dueAt, now) : null };
    });
    const mine = members.find((x) => x.id === m.id)!;
    return {
      id: c.id,
      name: c.name,
      amount: c.amount,
      size: c.size,
      rhythm: c.rhythm,
      role: m.role,
      turn: m.turn,
      joined: members.length,
      members,
      cycle: cycle && {
        index: cycle.index,
        dueAt: cycle.dueAt,
        paid: cycle.contributions.length,
        pending: cycle.payments.length,
        beneficiary: members.find((x) => x.id === cycle.beneficiaryId)?.name ?? '',
        iReceive: cycle.beneficiaryId === m.id,
      },
      myStatus: mine.status,
      cashToValidate: m.role === 'ADMIN' && cycle ? cycle.payments.filter((p) => p.provider === 'CASH').length : 0,
    };
  });

  const owed = circles.find((c) => c.myStatus === 'due' || c.myStatus === 'late' || c.myStatus === 'pending');
  const focus = owed ?? circles.find((c) => c.cycle) ?? null;

  const ledger = focus
    ? await prisma.ledgerEntry.findMany({ where: { circleId: focus.id }, orderBy: { createdAt: 'desc' }, take: 3 })
    : [];

  const payout = await prisma.cycle.findFirst({
    where: { status: 'PAID_OUT', beneficiaryId: { in: memberships.map((m) => m.id) }, closedAt: { gte: new Date(now.getTime() - 60 * 864e5) } },
    orderBy: { closedAt: 'desc' },
    include: { circle: { select: { id: true, name: true, amount: true, size: true } } },
  });

  return {
    circles,
    focus,
    ledger,
    payout: payout && { circleId: payout.circle.id, name: payout.circle.name, total: payout.circle.amount * payout.circle.size },
  };
}

export async function getCircle(circleId: string, userId: string) {
  const me = await prisma.membership.findUnique({ where: { userId_circleId: { userId, circleId } } });
  if (!me || me.leftAt) return null;
  const now = new Date();
  const circle = await prisma.circle.findUniqueOrThrow({
    where: { id: circleId },
    include: {
      memberships: { where: { leftAt: null }, include: { user: true }, orderBy: { turn: 'asc' } },
      cycles: { orderBy: { index: 'asc' }, include: { contributions: true, payments: { where: { status: LIVE } } } },
    },
  });
  const cycle = circle.cycles.find((c) => c.status === 'OPEN') ?? null;
  const admin = circle.memberships.find((m) => m.role === 'ADMIN');

  const members = circle.memberships.map((m) => {
    const contribution = cycle?.contributions.find((c) => c.membershipId === m.id);
    const pending = cycle?.payments.find((p) => p.membershipId === m.id);
    const received = circle.cycles.find((c) => c.beneficiaryId === m.id && c.status === 'PAID_OUT');
    return {
      id: m.id,
      name: m.user.name,
      turn: m.turn,
      isMe: m.id === me.id,
      status: cycle ? shareStatus(!!contribution, !!pending, cycle.dueAt, now) : null,
      method: contribution?.method ?? pending?.provider ?? null,
      receivedAt: received?.closedAt ?? null,
    };
  });

  return {
    me: { id: me.id, role: me.role, turn: me.turn },
    circle: {
      id: circle.id,
      name: circle.name,
      amount: circle.amount,
      size: circle.size,
      rhythm: circle.rhythm,
      orderMode: circle.orderMode,
      acceptsCash: circle.acceptsCash,
      sealed: !!circle.orderSealedAt,
      admin: admin?.user.name ?? '',
    },
    cycle: cycle && {
      id: cycle.id,
      index: cycle.index,
      dueAt: cycle.dueAt,
      paid: cycle.contributions.length,
      pending: cycle.payments.length,
      beneficiaryId: cycle.beneficiaryId,
      beneficiary: members.find((m) => m.id === cycle.beneficiaryId)?.name ?? '',
    },
    members,
    pendingCash:
      me.role === 'ADMIN' && cycle
        ? cycle.payments
            .filter((p) => p.provider === 'CASH')
            .map((p) => ({ id: p.id, amount: p.amount, createdAt: p.createdAt, name: members.find((m) => m.id === p.membershipId)?.name ?? '' }))
        : [],
  };
}

export async function getLedger(circleId: string, userId: string) {
  const me = await prisma.membership.findUnique({ where: { userId_circleId: { userId, circleId } } });
  if (!me || me.leftAt) return null;
  const circle = await prisma.circle.findUniqueOrThrow({
    where: { id: circleId },
    include: {
      memberships: { where: { leftAt: null }, include: { user: { select: { name: true } } } },
      cycles: { orderBy: { index: 'desc' }, include: { payments: { where: { status: LIVE, provider: 'CASH' } } } },
      ledger: { orderBy: { createdAt: 'desc' } },
    },
  });
  const name = (id: string) => circle.memberships.find((m) => m.id === id)?.user.name ?? '';

  const declared = circle.cycles.flatMap((c) =>
    c.payments.map((p) => ({
      id: p.id,
      cycleId: c.id,
      kind: 'note',
      text: `${name(p.membershipId)} déclare avoir remis ${p.amount.toLocaleString('fr-FR').replace(/ | /g, ' ')} en espèces`,
      meta: 'En attente de validation',
      amount: null as number | null,
      createdAt: p.createdAt,
    })),
  );
  const rows = [...circle.ledger, ...declared].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

  return {
    circle: { id: circle.id, name: circle.name, members: circle.memberships.length },
    cycles: circle.cycles.map((c) => ({
      id: c.id,
      index: c.index,
      status: c.status,
      dueAt: c.dueAt,
      closedAt: c.closedAt,
      rows: rows.filter((r) => r.cycleId === c.id),
    })),
    loose: rows.filter((r) => !r.cycleId),
    total: rows.length,
    fixes: circle.ledger.filter((r) => r.kind === 'fix').length,
  };
}

export async function getPayout(circleId: string, userId: string) {
  const me = await prisma.membership.findUnique({ where: { userId_circleId: { userId, circleId } } });
  if (!me || me.leftAt) return null;
  const circle = await prisma.circle.findUniqueOrThrow({
    where: { id: circleId },
    include: { cycles: { where: { beneficiaryId: me.id }, take: 1 }, _count: { select: { memberships: { where: { leftAt: null } } } } },
  });
  const cycle = circle.cycles[0];
  if (!cycle) return null;
  const entry = await prisma.ledgerEntry.findFirst({ where: { cycleId: cycle.id, kind: 'out' } });
  return {
    circle: { id: circle.id, name: circle.name, amount: circle.amount, size: circle.size, rhythm: circle.rhythm },
    cycleIndex: cycle.index,
    dueAt: cycle.dueAt,
    paidOut: cycle.status === 'PAID_OUT',
    closedAt: cycle.closedAt,
    via: entry?.meta?.split(' · ')[0] ?? null,
    members: circle._count.memberships,
  };
}
