import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { env } from '@/lib/env';
import { verifyWaveSignature } from '@/lib/payments/verify';
import { claimEvent, markProcessed } from '@/lib/payments/webhook';
import { reconcile } from '@/lib/payments/reconcile';
import { isUuid } from '@/lib/validate';

export const runtime = 'nodejs';

export async function POST(req: Request) {
  // The signature covers the raw bytes, so the body is read as text before parsing.
  const raw = await req.text();
  const ok = verifyWaveSignature(raw, req.headers.get('wave-signature'), env.WAVE_WEBHOOK_SECRET);

  let evt: { id?: string; type?: string; data?: { id?: string; client_reference?: string } };
  try {
    evt = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: 'bad_json' }, { status: 400 });
  }

  if (!ok) {
    await claimEvent('WAVE', `forged:${evt.id ?? crypto.randomUUID()}`, false, raw);
    console.warn('[wave] rejected webhook with invalid signature', evt.id);
    return NextResponse.json({ error: 'invalid_signature' }, { status: 401 });
  }

  const claimed = await claimEvent('WAVE', evt.id ?? `${evt.type}:${evt.data?.id}`, true, JSON.parse(raw));
  if (!claimed) return NextResponse.json({ ok: true, duplicate: true });

  const paymentId = evt.data?.client_reference;
  const p = isUuid(paymentId) ? await prisma.payment.findUnique({ where: { id: paymentId } }) : null;
  if (!p || p.providerRef !== evt.data?.id) {
    await markProcessed(claimed.id, 'unknown_payment');
    return NextResponse.json({ ok: true });
  }

  // A valid signature only triggers a check: amount and status always come from the provider API.
  const result = await reconcile(p);
  await markProcessed(claimed.id, result);
  return NextResponse.json({ ok: true, result });
}
