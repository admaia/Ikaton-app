import { NextResponse } from 'next/server';
import { randomUUID } from 'node:crypto';
import { currentUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { env } from '@/lib/env';

const day = 864e5;

export async function POST() {
  if (!env.DEMO_MODE) return NextResponse.json({ error: 'not_found' }, { status: 404 });
  const me = await currentUser();
  if (!me) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  if (await prisma.membership.count({ where: { userId: me.id } })) return NextResponse.json({ ok: true });

  await prisma.$transaction(async (tx) => {
    const people = (names: string[]) =>
      Promise.all(names.map((name) => tx.user.create({ data: { id: randomUUID(), name, phone: `demo:${randomUUID()}` } })));

    await tx.user.update({ where: { id: me.id }, data: { name: 'Aminata B.' } });

    const a = await people(['Aïcha K.', 'Mamadou D.', 'Fatou S.', 'Ibrahim T.', 'Salif C.', 'Kofi A.', 'Nadia M.']);
    const nafa = await tx.circle.create({ data: { name: 'Cercle Nafa', amount: 25000, size: 8, createdById: a[0].id, orderSealedAt: new Date(Date.now() - 60 * day) } });
    const order = [a[0], a[1], a[2], a[3], me, a[4], a[5], a[6]];
    const ma = await Promise.all(order.map((u, i) => tx.membership.create({ data: { userId: u.id, circleId: nafa.id, turn: i + 1, role: i === 0 ? 'ADMIN' : 'MEMBER' } })));
    const ca = await tx.cycle.create({ data: { circleId: nafa.id, index: 3, dueAt: new Date(Date.now() + 9 * day), beneficiaryId: ma[2].id } });
    for (const i of [0, 1, 3, 6, 7]) await tx.contribution.create({ data: { membershipId: ma[i].id, cycleId: ca.id, amount: 25000, method: 'WAVE' } });

    const b = await people(['Mariam D.', 'Awa S.', 'Fanta T.', 'Rokia T.', 'Sira B.']);
    const soeurs = await tx.circle.create({ data: { name: 'Les sœurs de Badalabougou', amount: 20000, size: 6, createdById: me.id, orderSealedAt: new Date(Date.now() - 30 * day) } });
    const ob = [b[0], me, b[1], b[2], b[3], b[4]];
    const mb = await Promise.all(ob.map((u, i) => tx.membership.create({ data: { userId: u.id, circleId: soeurs.id, turn: i + 1, role: u.id === me.id ? 'ADMIN' : 'MEMBER' } })));
    const due = new Date(Date.now() + 4 * day);
    const cb = await tx.cycle.create({ data: { circleId: soeurs.id, index: 2, dueAt: due, beneficiaryId: mb[1].id } });
    for (const i of [2, 3, 4]) await tx.contribution.create({ data: { membershipId: mb[i].id, cycleId: cb.id, amount: 20000, method: 'ORANGE' } });
    await tx.payment.create({
      data: { idempotencyKey: `demo:${randomUUID()}`, membershipId: mb[0].id, cycleId: cb.id, provider: 'CASH', amount: 20000, status: 'PENDING', expiresAt: new Date(due.getTime() + 3 * day) },
    });
  }, { timeout: 20_000 });
  return NextResponse.json({ ok: true });
}
