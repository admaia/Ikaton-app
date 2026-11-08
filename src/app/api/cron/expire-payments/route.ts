import { NextResponse } from 'next/server';
import { env } from '@/lib/env';
import { expireStalePayments } from '@/lib/payments/reconcile';

export const runtime = 'nodejs';

export async function GET(req: Request) {
  if (req.headers.get('authorization') !== `Bearer ${env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  return NextResponse.json(await expireStalePayments());
}
