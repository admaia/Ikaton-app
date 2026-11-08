import { NextResponse } from 'next/server';
import { currentUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { toPublic } from '@/lib/payments/initiate';
import { freshen, reconcile } from '@/lib/payments/reconcile';
import { closePayment } from '@/lib/payments/settle';
import { isUuid } from '@/lib/validate';

type Ctx = { params: Promise<{ id: string }> };

async function own(id: string) {
  if (!isUuid(id)) return null;
  const user = await currentUser();
  if (!user) return null;
  return prisma.payment.findFirst({ where: { id, membership: { userId: user.id } } });
}

export async function GET(_: Request, { params }: Ctx) {
  const p = await own((await params).id);
  if (!p) return NextResponse.json({ error: 'not_found' }, { status: 404 });
  return NextResponse.json(toPublic(await freshen(p)));
}

export async function POST(_: Request, { params }: Ctx) {
  const p = await own((await params).id);
  if (!p) return NextResponse.json({ error: 'not_found' }, { status: 404 });
  if (p.status === 'PENDING') await reconcile(p);
  const fresh = await prisma.payment.findUniqueOrThrow({ where: { id: p.id } });
  return NextResponse.json(toPublic(await freshen(fresh)));
}

// If the provider already took the money, reconcile wins over the cancel.
export async function DELETE(_: Request, { params }: Ctx) {
  const p = await own((await params).id);
  if (!p) return NextResponse.json({ error: 'not_found' }, { status: 404 });
  const out = await reconcile(p);
  if (out === 'ignored') await closePayment(p.id, 'FAILED', 'cancelled_by_member');
  const fresh = await prisma.payment.findUniqueOrThrow({ where: { id: p.id } });
  return NextResponse.json(toPublic(fresh));
}
