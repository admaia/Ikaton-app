import { NextResponse } from 'next/server';
import { z } from 'zod';
import { currentUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { initiatePayment, PaymentError, toPublic } from '@/lib/payments/initiate';
import { freshen } from '@/lib/payments/reconcile';
import { isUuid } from '@/lib/validate';

const body = z.object({ cycleId: z.string().uuid(), provider: z.enum(['WAVE', 'ORANGE', 'MOOV', 'CARD', 'CASH', 'SANDBOX']) });

export async function POST(req: Request) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const key = req.headers.get('idempotency-key');
  if (!key || key.length < 16 || key.length > 80) return NextResponse.json({ error: 'missing_idempotency_key' }, { status: 400 });
  const parsed = body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'bad_request' }, { status: 400 });

  try {
    const p = await initiatePayment({ userId: user.id, idempotencyKey: `${user.id}:${key}`, ...parsed.data });
    return NextResponse.json(toPublic(p));
  } catch (e) {
    if (e instanceof PaymentError) return NextResponse.json({ error: e.code }, { status: e.status });
    throw e;
  }
}

export async function GET(req: Request) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const cycleId = new URL(req.url).searchParams.get('cycleId');
  if (!isUuid(cycleId)) return NextResponse.json({ error: 'bad_request' }, { status: 400 });
  const p = await prisma.payment.findFirst({
    where: { cycleId, membership: { userId: user.id } },
    orderBy: { createdAt: 'desc' },
  });
  return NextResponse.json(p ? toPublic(await freshen(p)) : null);
}
