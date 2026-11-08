import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { env } from '@/lib/env';
import { verifyWaveSignature } from '@/lib/payments/verify';
import { claimEvent, markProcessed } from '@/lib/payments/webhook';
import { reconcile } from '@/lib/payments/reconcile';
import { isUuid } from '@/lib/validate';

export const runtime = 'nodejs';

export async function POST(req: Request) {
  if (!env.DEMO_MODE) return NextResponse.json({ error: 'not_found' }, { status: 404 });
  const raw = await req.text();
  const ok = verifyWaveSignature(raw, req.headers.get('sandbox-signature'), env.SANDBOX_WEBHOOK_SECRET);
  let evt: { id?: string; data?: { id?: string; client_reference?: string } };
  try {
    evt = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: 'bad_json' }, { status: 400 });
  }

  if (!ok) {
    await claimEvent('SANDBOX', `forged:${evt.id ?? crypto.randomUUID()}:${Date.now()}`, false, raw);
    return NextResponse.json({ error: 'invalid_signature' }, { status: 401 });
  }

  const claimed = await claimEvent('SANDBOX', evt.id ?? crypto.randomUUID(), true, JSON.parse(raw));
  if (!claimed) return NextResponse.json({ ok: true, duplicate: true });

  const ref = evt.data?.client_reference;
  const p = isUuid(ref) ? await prisma.payment.findUnique({ where: { id: ref } }) : null;
  if (!p || p.providerRef !== evt.data?.id) {
    await markProcessed(claimed.id, 'unknown_payment');
    return NextResponse.json({ ok: true, result: 'unknown_payment' });
  }
  const result = await reconcile(p);
  await markProcessed(claimed.id, result);
  return NextResponse.json({ ok: true, result });
}
