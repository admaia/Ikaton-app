import 'server-only';
import { Prisma, type PaymentStatus } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { canTransition } from './status';

export type SettleOutcome = 'confirmed' | 'duplicate' | 'needs_review' | 'failed' | 'expired' | 'ignored' | 'unknown_payment';

async function serializable<T>(fn: (tx: Prisma.TransactionClient) => Promise<T>, attempts = 3): Promise<T> {
  for (let i = 0; ; i++) {
    try {
      return await prisma.$transaction(fn, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    } catch (e) {
      const code = (e as { code?: string }).code;
      if (i < attempts - 1 && (code === 'P2034' || code === 'P2002')) continue;
      throw e;
    }
  }
}

// Only call with amounts fetched from the provider by the server, or validated cash.
export function confirmPayment(input: {
  paymentId: string;
  amount: number;
  currency: string;
  providerRef?: string;
  validatedById?: string;
}): Promise<SettleOutcome> {
  return serializable(async (tx) => {
    const p = await tx.payment.findUnique({ where: { id: input.paymentId } });
    if (!p) return 'unknown_payment';
    if (p.status === 'CONFIRMED') return 'duplicate';
    if (!canTransition(p.status, 'CONFIRMED')) return 'ignored';

    if (input.amount !== p.amount || input.currency !== p.currency) {
      await tx.payment.update({ where: { id: p.id }, data: { status: 'NEEDS_REVIEW', failureReason: 'amount_mismatch' } });
      return 'needs_review';
    }

    const already = await tx.contribution.findUnique({
      where: { membershipId_cycleId: { membershipId: p.membershipId, cycleId: p.cycleId } },
    });
    if (already) {
      // Money arrived for a share that is already paid: flag it for a refund.
      await tx.payment.update({ where: { id: p.id }, data: { status: 'NEEDS_REVIEW', failureReason: 'share_already_paid' } });
      return 'needs_review';
    }

    const cas = await tx.payment.updateMany({
      where: { id: p.id, status: p.status },
      data: { status: 'CONFIRMED', confirmedAt: new Date(), providerRef: input.providerRef ?? p.providerRef },
    });
    if (cas.count === 0) return 'duplicate';

    const m = await tx.membership.findUniqueOrThrow({ where: { id: p.membershipId }, include: { user: true } });
    await tx.contribution.create({
      data: { membershipId: p.membershipId, cycleId: p.cycleId, paymentId: p.id, amount: p.amount, method: p.provider, validatedById: input.validatedById },
    });
    await tx.ledgerEntry.create({
      data: {
        circleId: m.circleId,
        cycleId: p.cycleId,
        kind: 'in',
        text: `${m.user.name} a déposé sa part`,
        meta: p.provider === 'CASH' ? 'Espèces · validées par le gestionnaire' : `${label(p.provider)} · vérifié auprès de l’opérateur`,
        amount: p.amount,
      },
    });
    return 'confirmed';
  });
}

export async function closePayment(paymentId: string, to: Extract<PaymentStatus, 'FAILED' | 'EXPIRED'>, reason: string): Promise<SettleOutcome> {
  const res = await prisma.payment.updateMany({
    where: { id: paymentId, status: { in: ['INITIATED', 'PENDING'] } },
    data: { status: to, failureReason: reason },
  });
  return res.count ? (to === 'FAILED' ? 'failed' : 'expired') : 'ignored';
}

const label = (p: string) => ({ WAVE: 'Wave', ORANGE: 'Orange Money', MOOV: 'Moov Money', CARD: 'Carte', CASH: 'Espèces', SANDBOX: 'Opérateur de démo' })[p] ?? p;
