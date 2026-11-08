import 'server-only';
import type { Payment, Provider } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { env } from '@/lib/env';
import { providerFor } from './providers';
import { hashToken } from './verify';
import type { PublicPayment } from './status';

const CASH_GRACE_MS = 3 * 24 * 60 * 60 * 1000;

export class PaymentError extends Error {
  constructor(public code: 'not_member' | 'cycle_closed' | 'already_paid' | 'cash_refused' | 'provider_unavailable', public status = 400) {
    super(code);
  }
}

export const toPublic = (p: Payment): PublicPayment => ({
  id: p.id,
  status: p.status,
  provider: p.provider,
  amount: p.amount,
  expiresAt: p.expiresAt.toISOString(),
  confirmedAt: p.confirmedAt?.toISOString() ?? null,
  failureReason: p.failureReason,
  checkoutUrl: p.status === 'PENDING' ? p.checkoutUrl : null,
});

export async function initiatePayment(opts: { userId: string; cycleId: string; provider: Provider; idempotencyKey: string }) {
  const same = await prisma.payment.findUnique({ where: { idempotencyKey: opts.idempotencyKey } });
  if (same) return same;

  if (opts.provider === 'SANDBOX' && !env.DEMO_MODE) throw new PaymentError('provider_unavailable', 503);

  const cycle = await prisma.cycle.findUnique({ where: { id: opts.cycleId }, include: { circle: true } });
  if (!cycle || cycle.status !== 'OPEN') throw new PaymentError('cycle_closed', 409);
  const m = await prisma.membership.findUnique({ where: { userId_circleId: { userId: opts.userId, circleId: cycle.circleId } } });
  if (!m || m.leftAt) throw new PaymentError('not_member', 403);
  if (opts.provider === 'CASH' && !cycle.circle.acceptsCash) throw new PaymentError('cash_refused');

  const paid = await prisma.contribution.findUnique({ where: { membershipId_cycleId: { membershipId: m.id, cycleId: cycle.id } } });
  if (paid) throw new PaymentError('already_paid', 409);

  const live = await prisma.payment.findFirst({ where: { membershipId: m.id, cycleId: cycle.id, status: { in: ['INITIATED', 'PENDING'] } } });
  if (live && live.expiresAt > new Date()) return live;

  const expiresAt =
    opts.provider === 'CASH'
      ? new Date(cycle.dueAt.getTime() + CASH_GRACE_MS)
      : new Date(Date.now() + (opts.provider === 'SANDBOX' ? env.SANDBOX_TIMEOUT_MINUTES : env.PAYMENT_TIMEOUT_MINUTES) * 60_000);

  let p: Payment;
  try {
    p = await prisma.payment.create({
      data: { idempotencyKey: opts.idempotencyKey, membershipId: m.id, cycleId: cycle.id, provider: opts.provider, amount: cycle.circle.amount, expiresAt },
    });
  } catch (e) {
    // Lost a race on the idempotency key or the one-live-attempt index: return the winner.
    if ((e as { code?: string }).code === 'P2002') {
      const winner = await prisma.payment.findFirst({
        where: { OR: [{ idempotencyKey: opts.idempotencyKey }, { membershipId: m.id, cycleId: cycle.id, status: { in: ['INITIATED', 'PENDING'] } }] },
      });
      if (winner) return winner;
    }
    throw e;
  }

  if (opts.provider === 'CASH') {
    return prisma.payment.update({ where: { id: p.id }, data: { status: 'PENDING' } });
  }

  const provider = providerFor(opts.provider);
  if (!provider) {
    await prisma.payment.update({ where: { id: p.id }, data: { status: 'FAILED', failureReason: 'provider_unavailable' } });
    throw new PaymentError('provider_unavailable', 503);
  }
  try {
    const r = await provider.createCheckout({
      paymentId: p.id,
      amount: p.amount,
      currency: p.currency,
      returnUrl: `${env.APP_URL}/pay/return`,
      notifyUrl: `${env.APP_URL}/api/webhooks/${opts.provider.toLowerCase()}`,
    });
    return prisma.payment.update({
      where: { id: p.id },
      data: { status: 'PENDING', providerRef: r.providerRef, checkoutUrl: r.checkoutUrl, notifTokenHash: r.notifToken ? hashToken(r.notifToken) : null },
    });
  } catch {
    return prisma.payment.update({ where: { id: p.id }, data: { status: 'FAILED', failureReason: 'provider_unreachable' } });
  }
}
