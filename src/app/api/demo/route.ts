import { NextResponse } from 'next/server';
import { randomUUID } from 'node:crypto';
import type { Prisma, Provider, Rhythm } from '@prisma/client';
import { currentUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { env } from '@/lib/env';

const DAY = 864e5;
const LABEL: Record<Provider, string> = { WAVE: 'Wave', ORANGE: 'Orange Money', MOOV: 'Moov Money', CARD: 'Carte', CASH: 'Espèces', SANDBOX: 'Démo' };
const STEP: Record<Rhythm, number> = { WEEK: 7, FORTNIGHT: 14, MONTH: 30 };

type Spec = {
  name: string;
  amount: number;
  size: number;
  rhythm: Rhythm;
  roster: string[];
  me: number;
  admin: number;
  open?: { index: number; dueIn: number; paid: [number, Provider, number][]; cash?: number[]; reminder?: boolean };
  joinedDaysAgo: number;
};

// Recreates the four circles from the design: one to pay, one paid with a past payout, two managed.
const SPECS: Spec[] = [
  {
    name: 'Cercle Nafa', amount: 25000, size: 8, rhythm: 'MONTH', joinedDaysAgo: 100,
    roster: ['Aïcha K.', 'Mamadou D.', 'Fatou S.', 'Ibrahim T.', '', 'Salif C.', 'Kofi A.', 'Nadia M.'], me: 4, admin: 0,
    open: { index: 3, dueIn: 11, paid: [[0, 'WAVE', 15], [1, 'ORANGE', 12], [3, 'WAVE', 9], [7, 'MOOV', 6], [6, 'CASH', 4], [2, 'CARD', 2]], cash: [5], reminder: true },
  },
  {
    name: 'Tontine du marché', amount: 10000, size: 12, rhythm: 'WEEK', joinedDaysAgo: 99,
    roster: ['Mariam K.', 'Oumou S.', 'Fatou D.', '', 'Bintou C.', 'Aïssata T.', 'Djeneba K.', 'Hawa M.', 'Ibrahim T.', 'Assitan D.', 'Kadiatou B.', 'Nana S.'], me: 3, admin: 0,
    open: { index: 9, dueIn: 2, paid: Array.from({ length: 12 }, (_, i) => [i, (['WAVE', 'ORANGE', 'MOOV', 'CASH'] as Provider[])[i % 4], 1 + (i % 3)] as [number, Provider, number]) },
  },
  {
    name: 'Les sœurs de Badalabougou', amount: 50000, size: 6, rhythm: 'MONTH', joinedDaysAgo: 98,
    roster: ['', 'Kadi T.', 'Rama S.', 'Fanta K.', 'Sali B.'], me: 0, admin: 0,
  },
  {
    name: 'Cercle Sènè', amount: 20000, size: 8, rhythm: 'MONTH', joinedDaysAgo: 97,
    roster: ['Rokia T.', 'Mariam D.', 'Awa S.', 'Fanta T.', 'Sira B.', '', 'Moussa K.', 'Adama K.'], me: 5, admin: 5,
    open: { index: 2, dueIn: 4, paid: [[0, 'WAVE', 20], [2, 'ORANGE', 16], [4, 'MOOV', 10], [5, 'ORANGE', 8], [6, 'WAVE', 5], [7, 'CASH', 3]], cash: [1, 3] },
  },
];

export async function POST() {
  if (!env.DEMO_MODE) return NextResponse.json({ error: 'not_found' }, { status: 404 });
  const me = await currentUser();
  if (!me) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  if (await prisma.membership.count({ where: { userId: me.id } })) return NextResponse.json({ ok: true });

  const now = Date.now();
  const at = (days: number) => new Date(now + days * DAY);
  const fr = (n: number) => n.toLocaleString('fr-FR').replace(/ | /g, ' ');

  const users: Prisma.UserCreateManyInput[] = [];
  const circles: Prisma.CircleCreateManyInput[] = [];
  const memberships: Prisma.MembershipCreateManyInput[] = [];
  const cycles: Prisma.CycleCreateManyInput[] = [];
  const contributions: Prisma.ContributionCreateManyInput[] = [];
  const payments: Prisma.PaymentCreateManyInput[] = [];
  const ledger: Prisma.LedgerEntryCreateManyInput[] = [];

  for (const s of SPECS) {
    const circleId = randomUUID();
    const people = s.roster.map((name, i) => {
      if (i === s.me) return { userId: me.id, name: 'Aminata B.' };
      const id = randomUUID();
      users.push({ id, name, phone: `demo:${randomUUID()}` });
      return { userId: id, name };
    });
    const mIds = people.map(() => randomUUID());
    const sealed = !!s.open;
    const step = STEP[s.rhythm];
    const opened = s.open ? s.open.dueIn - s.open.index * step - 2 : -6;

    circles.push({
      id: circleId, name: s.name, amount: s.amount, size: s.size, rhythm: s.rhythm, createdById: people[s.admin].userId,
      createdAt: at(opened), orderSealedAt: sealed ? at(opened + 1) : null,
    });
    people.forEach((p, i) =>
      memberships.push({
        id: mIds[i], userId: p.userId, circleId, turn: sealed ? i + 1 : null, role: i === s.admin ? 'ADMIN' : 'MEMBER',
        joinedAt: i === s.me ? at(-s.joinedDaysAgo) : at(opened),
      }),
    );
    ledger.push({ circleId, kind: 'open', text: `Le cercle a été ouvert par ${people[s.admin].name}`, meta: `${fr(s.amount)} par ${s.rhythm === 'WEEK' ? 'semaine' : 'mois'} · ${s.size} membres`, createdAt: at(opened) });
    if (!s.open) continue;

    const o = s.open;
    const pot = s.amount * s.size;
    for (let index = 1; index <= o.index; index++) {
      const id = randomUUID();
      const due = o.dueIn - (o.index - index) * step;
      const current = index === o.index;
      const ben = index - 1;
      cycles.push({
        id, circleId, index, dueAt: at(due), beneficiaryId: mIds[ben],
        status: current ? 'OPEN' : 'PAID_OUT', closedAt: current ? null : at(due + 1),
      });
      if (index === 1) ledger.push({ circleId, cycleId: id, kind: 'open', text: 'L’ordre des tours a été tiré au sort', meta: `Scellé · identique pour les ${s.size} membres`, createdAt: at(opened + 1) });
      if (!current) {
        const via = (['ORANGE', 'WAVE', 'CASH'] as Provider[])[index % 3];
        ledger.push({ circleId, cycleId: id, kind: 'close', text: `${people[s.admin].name} a clôturé le cycle ${index}`, meta: `Les ${s.size} parts étaient arrivées`, createdAt: at(due + 0.9) });
        ledger.push({ circleId, cycleId: id, kind: 'out', text: `Le pot a été versé à ${people[ben].name}`, meta: `${ben === s.me ? 'Orange Money' : LABEL[via]} · ${fr(pot)}`, amount: pot, createdAt: at(due + 1) });
        continue;
      }
      ledger.push({ circleId, cycleId: id, kind: 'open', text: `Le cycle ${index} a été ouvert`, meta: `Bénéficiaire : ${people[ben].name}`, createdAt: at(due - step + 1) });
      for (const [i, method, ago] of o.paid) {
        contributions.push({ membershipId: mIds[i], cycleId: id, amount: s.amount, method, createdAt: at(-ago), validatedById: method === 'CASH' ? people[s.admin].userId : null });
        ledger.push({
          circleId, cycleId: id, kind: 'in', amount: s.amount, createdAt: at(-ago),
          text: `${people[i].name} a déposé sa part`,
          meta: method === 'CASH' ? `Espèces · validées par ${people[s.admin].name}` : `${LABEL[method]} · vérifié auprès de l’opérateur`,
        });
      }
      for (const i of o.cash ?? []) {
        payments.push({ idempotencyKey: `demo:${randomUUID()}`, membershipId: mIds[i], cycleId: id, provider: 'CASH', amount: s.amount, status: 'PENDING', createdAt: at(-0.8), expiresAt: at(o.dueIn + 3) });
      }
      if (o.reminder) ledger.push({ circleId, cycleId: id, kind: 'late', text: `${people[s.admin].name} a relancé ${people[s.me].name}`, meta: 'Relance · part manquante', createdAt: at(-0.3) });
    }
  }

  await prisma.$transaction(async (tx) => {
    await tx.user.update({ where: { id: me.id }, data: { name: 'Aminata B.' } });
    await tx.user.createMany({ data: users });
    await tx.circle.createMany({ data: circles });
    await tx.membership.createMany({ data: memberships });
    await tx.cycle.createMany({ data: cycles });
    await tx.contribution.createMany({ data: contributions });
    await tx.payment.createMany({ data: payments });
    await tx.ledgerEntry.createMany({ data: ledger });
  }, { timeout: 20_000 });
  return NextResponse.json({ ok: true });
}
