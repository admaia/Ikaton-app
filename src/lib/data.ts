import 'server-only';
import { prisma } from './prisma';

export async function getHome(userId: string) {
  const memberships = await prisma.membership.findMany({
    where: { userId, leftAt: null },
    include: {
      circle: {
        include: {
          cycles: { where: { status: 'OPEN' }, include: { contributions: true }, take: 1 },
          memberships: { where: { leftAt: null }, select: { id: true } },
        },
      },
    },
    orderBy: { joinedAt: 'asc' },
  });
  return memberships.map((m) => {
    const cycle = m.circle.cycles[0];
    const paid = cycle?.contributions.length ?? 0;
    return {
      id: m.circle.id,
      name: m.circle.name,
      role: m.role,
      amount: m.circle.amount,
      size: m.circle.size,
      turn: m.turn,
      cycleIndex: cycle?.index ?? null,
      dueAt: cycle?.dueAt ?? null,
      paid,
      myShareIn: !!cycle?.contributions.some((c) => c.membershipId === m.id),
      receivesNow: cycle?.beneficiaryId === m.id,
    };
  });
}

export async function getCircle(circleId: string, userId: string) {
  const me = await prisma.membership.findUnique({ where: { userId_circleId: { userId, circleId } } });
  if (!me) return null;
  const circle = await prisma.circle.findUniqueOrThrow({
    where: { id: circleId },
    include: {
      memberships: { where: { leftAt: null }, include: { user: true }, orderBy: { turn: 'asc' } },
      cycles: {
        where: { status: 'OPEN' },
        take: 1,
        include: {
          contributions: true,
          payments: { where: { status: { in: ['INITIATED', 'PENDING'] } } },
        },
      },
    },
  });
  const cycle = circle.cycles[0] ?? null;
  const now = new Date();
  const members = circle.memberships.map((m) => {
    const paid = cycle?.contributions.some((c) => c.membershipId === m.id);
    const pending = cycle?.payments.find((p) => p.membershipId === m.id);
    const status = cycle?.beneficiaryId === m.id ? 'receives' : paid ? 'paid' : pending ? 'pending' : cycle && cycle.dueAt < now ? 'late' : 'due';
    return { id: m.id, name: m.user.name, turn: m.turn, isMe: m.id === me.id, status: status as 'paid' | 'pending' | 'late' | 'due' | 'receives' };
  });
  const pendingCash = me.role === 'ADMIN' && cycle
    ? cycle.payments.filter((p) => p.provider === 'CASH').map((p) => ({ id: p.id, amount: p.amount, name: circle.memberships.find((m) => m.id === p.membershipId)?.user.name ?? '' }))
    : [];
  return {
    me,
    circle: { id: circle.id, name: circle.name, amount: circle.amount, size: circle.size, acceptsCash: circle.acceptsCash, sealed: !!circle.orderSealedAt },
    cycle: cycle && {
      id: cycle.id,
      index: cycle.index,
      dueAt: cycle.dueAt,
      paid: cycle.contributions.length,
      pending: cycle.payments.length,
      beneficiary: members.find((m) => m.id === cycle.beneficiaryId)?.name ?? '',
    },
    members,
    pendingCash,
  };
}
