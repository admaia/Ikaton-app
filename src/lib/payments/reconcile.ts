import 'server-only';
import type { Payment } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { providerFor } from './providers';
import { closePayment, confirmPayment, type SettleOutcome } from './settle';

export async function reconcile(p: Payment): Promise<SettleOutcome> {
  const provider = providerFor(p.provider);
  if (!provider) return 'ignored';
  const remote = await provider.fetchStatus(p).catch(() => ({ status: 'unknown' as const }));
  if (remote.status === 'succeeded') {
    return confirmPayment({ paymentId: p.id, amount: remote.amount ?? -1, currency: remote.currency ?? '', providerRef: p.providerRef ?? undefined });
  }
  if (remote.status === 'failed') return closePayment(p.id, 'FAILED', 'declined_by_provider');
  return 'ignored';
}

export async function expireStalePayments(now = new Date(), batch = 100) {
  const stale = await prisma.payment.findMany({
    where: { status: { in: ['INITIATED', 'PENDING'] }, expiresAt: { lt: now } },
    orderBy: { expiresAt: 'asc' },
    take: batch,
  });
  const results: Record<string, number> = {};
  for (const p of stale) {
    let out = await reconcile(p);
    if (out === 'ignored') out = await closePayment(p.id, 'EXPIRED', p.provider === 'CASH' ? 'cash_not_validated' : 'no_confirmation');
    results[out] = (results[out] ?? 0) + 1;
  }
  return { scanned: stale.length, results };
}

// Expires on read too, so the UI never shows a stale pending state when the cron is late.
export async function freshen(p: Payment): Promise<Payment> {
  if ((p.status === 'PENDING' || p.status === 'INITIATED') && p.expiresAt < new Date()) {
    const out = await reconcile(p);
    if (out === 'ignored') await closePayment(p.id, 'EXPIRED', p.provider === 'CASH' ? 'cash_not_validated' : 'no_confirmation');
    return prisma.payment.findUniqueOrThrow({ where: { id: p.id } });
  }
  return p;
}
