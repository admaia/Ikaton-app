import { NextResponse } from 'next/server';
import { z } from 'zod';
import { currentUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { closePayment, confirmPayment } from '@/lib/payments/settle';
import { isUuid } from '@/lib/validate';

const body = z.object({ action: z.enum(['confirm', 'refuse']) });

export async function POST(req: Request, { params }: { params: Promise<{ paymentId: string }> }) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const parsed = body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'bad_request' }, { status: 400 });

  const paymentId = (await params).paymentId;
  if (!isUuid(paymentId)) return NextResponse.json({ error: 'not_found' }, { status: 404 });
  const p = await prisma.payment.findUnique({ where: { id: paymentId }, include: { cycle: true } });
  if (!p || p.provider !== 'CASH') return NextResponse.json({ error: 'not_found' }, { status: 404 });

  const admin = await prisma.membership.findFirst({ where: { userId: user.id, circleId: p.cycle.circleId, role: 'ADMIN' } });
  if (!admin) return NextResponse.json({ error: 'forbidden' }, { status: 403 });

  const result =
    parsed.data.action === 'confirm'
      ? await confirmPayment({ paymentId: p.id, amount: p.amount, currency: p.currency, validatedById: user.id })
      : await closePayment(p.id, 'FAILED', 'cash_refused_by_admin');
  return NextResponse.json({ result });
}
