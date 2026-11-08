import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyOrangeToken } from '@/lib/payments/verify';
import { claimEvent, markProcessed } from '@/lib/payments/webhook';
import { reconcile } from '@/lib/payments/reconcile';
import { isUuid } from '@/lib/validate';

export const runtime = 'nodejs';

type OrangeNotif = { status?: string; notif_token?: string; txnid?: string; order_id?: string };

export async function POST(req: Request) {
  const raw = await req.text();
  let body: OrangeNotif;
  try {
    body = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: 'bad_json' }, { status: 400 });
  }

  const p = isUuid(body.order_id)
    ? await prisma.payment.findUnique({ where: { id: body.order_id } })
    : null;
  const ok = !!p && p.provider === 'ORANGE' && verifyOrangeToken(body.notif_token, p.notifTokenHash);

  if (!ok) {
    await claimEvent('ORANGE', `forged:${body.txnid ?? crypto.randomUUID()}`, false, raw);
    console.warn('[orange] rejected notification with invalid token', body.txnid);
    return NextResponse.json({ error: 'invalid_token' }, { status: 401 });
  }

  const claimed = await claimEvent('ORANGE', `${body.txnid ?? p!.id}:${body.status}`, true, JSON.parse(raw));
  if (!claimed) return NextResponse.json({ ok: true, duplicate: true });

  const result = await reconcile(p!);
  await markProcessed(claimed.id, result);
  return NextResponse.json({ ok: true, result });
}
