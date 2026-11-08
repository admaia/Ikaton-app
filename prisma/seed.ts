import { PrismaClient } from '@prisma/client';
import { randomUUID } from 'node:crypto';

const prisma = new PrismaClient();
const NAMES = ['Aminata B.', 'Kofi A.', 'Nadia M.', 'Mariam D.', 'Awa S.', 'Fanta T.', 'Salif C.', 'Ibrahim T.'];

async function main() {
  const meId = process.env.SEED_ME_ID;
  if (!meId) throw new Error('Set SEED_ME_ID to your Supabase auth user id');

  const users = await Promise.all(
    NAMES.map((name, i) =>
      prisma.user.upsert({
        where: { id: i === 0 ? meId : randomUUID() },
        update: { name },
        create: { id: i === 0 ? meId : randomUUID(), name, phone: `+2237600000${i}` },
      }),
    ),
  );

  const circle = await prisma.circle.create({
    data: { name: 'Cercle Nafa', amount: 25000, size: 8, createdById: users[1].id, orderSealedAt: new Date() },
  });

  const memberships = await Promise.all(
    users.map((u, i) =>
      prisma.membership.create({
        data: { userId: u.id, circleId: circle.id, turn: i + 1, role: i === 1 ? 'ADMIN' : 'MEMBER' },
      }),
    ),
  );

  const due = new Date();
  due.setDate(due.getDate() + 9);
  const cycle = await prisma.cycle.create({
    data: { circleId: circle.id, index: 3, dueAt: due, beneficiaryId: memberships[2].id },
  });

  for (const m of memberships.slice(1, 6)) {
    await prisma.contribution.create({ data: { membershipId: m.id, cycleId: cycle.id, amount: 25000, method: 'WAVE' } });
  }
  await prisma.ledgerEntry.create({
    data: { circleId: circle.id, cycleId: cycle.id, kind: 'open', text: 'Le cycle 3 a été ouvert', meta: 'Bénéficiaire : Nadia M.' },
  });
  console.log('Seeded', circle.name);
}

main().finally(() => prisma.$disconnect());
