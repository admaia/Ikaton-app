import { NextResponse } from 'next/server';
import { z } from 'zod';
import { currentUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { env } from '@/lib/env';
import { signSandbox } from '@/lib/payments/providers/sandbox';
import { POST as webhook } from '@/app/api/webhooks/sandbox/route';
import { isUuid } from '@/lib/validate';

const body = z.object({ action: z.enum(['approve', 'decline', 'double', 'forge', 'silent']) });

type Line = { label: string; http: number; answer: string };

async function deliver(payload: object, signature: string): Promise<Line & { label: '' }> {
  const raw = JSON.stringify(payload);
  const res = await webhook(new Request('http://internal/api/webhooks/sandbox', { method: 'POST', headers: { 'sandbox-signature': signature }, body: raw }));
  const j = await res.json();
  return { label: '', http: res.status, answer: j.error ?? (j.duplicate ? 'duplicate' : j.result) };
}

export async function POST(req: Request, { params }: { params: Promise<{ paymentId: string }> }) {
  if (!env.DEMO_MODE) return NextResponse.json({ error: 'not_found' }, { status: 404 });
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const parsed = body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'bad_request' }, { status: 400 });

  const paymentId = (await params).paymentId;
  if (!isUuid(paymentId)) return NextResponse.json({ error: 'not_found' }, { status: 404 });
  const p = await prisma.payment.findFirst({ where: { id: paymentId, provider: 'SANDBOX', membership: { userId: user.id } } });
  if (!p) return NextResponse.json({ error: 'not_found' }, { status: 404 });

  const event = (id = `evt_${crypto.randomUUID()}`) => ({ id, type: 'payment.updated', data: { id: p.providerRef, client_reference: p.id } });
  const setTxn = (status: string) => prisma.sandboxTxn.update({ where: { paymentId: p.id }, data: { status } });
  const log: Line[] = [];

  switch (parsed.data.action) {
    case 'approve': {
      await setTxn('succeeded');
      const e = event();
      log.push({ ...(await deliver(e, signSandbox(JSON.stringify(e)))), label: 'signed' });
      break;
    }
    case 'double': {
      await setTxn('succeeded');
      const e = event();
      const sig = signSandbox(JSON.stringify(e));
      log.push({ ...(await deliver(e, sig)), label: 'first' });
      log.push({ ...(await deliver(e, sig)), label: 'resent' });
      const e2 = event();
      log.push({ ...(await deliver(e2, signSandbox(JSON.stringify(e2)))), label: 'again' });
      break;
    }
    case 'decline': {
      await setTxn('failed');
      const e = event();
      log.push({ ...(await deliver(e, signSandbox(JSON.stringify(e)))), label: 'declined' });
      break;
    }
    case 'forge': {
      const e = event();
      log.push({ ...(await deliver(e, signSandbox(JSON.stringify(e), 'guessed-secret'))), label: 'forged' });
      log.push({ ...(await deliver(e, '')), label: 'unsigned' });
      const old = Math.floor(Date.now() / 1000) - 3600;
      log.push({ ...(await deliver(e, signSandbox(JSON.stringify(e), env.SANDBOX_WEBHOOK_SECRET, old))), label: 'replayed' });
      break;
    }
    case 'silent':
      break;
  }
  const fresh = await prisma.payment.findUniqueOrThrow({ where: { id: p.id } });
  return NextResponse.json({ log, status: fresh.status, expiresAt: fresh.expiresAt.toISOString() });
}
