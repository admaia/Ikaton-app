import 'server-only';
import { createHmac } from 'node:crypto';
import { prisma } from '@/lib/prisma';
import { env } from '@/lib/env';
import type { PaymentProvider } from './types';

export const sandbox: PaymentProvider = {
  async createCheckout({ paymentId, amount }) {
    await prisma.sandboxTxn.upsert({ where: { paymentId }, update: {}, create: { paymentId, amount, status: 'pending' } });
    return { providerRef: `sbx_${paymentId}`, checkoutUrl: `/pay/sandbox?p=${paymentId}` };
  },
  async fetchStatus({ id }) {
    const t = await prisma.sandboxTxn.findUnique({ where: { paymentId: id } });
    if (!t) return { status: 'unknown' };
    return { status: t.status === 'succeeded' ? 'succeeded' : t.status === 'failed' ? 'failed' : 'pending', amount: t.amount, currency: 'XOF' };
  },
};

export function signSandbox(body: string, secret = env.SANDBOX_WEBHOOK_SECRET, t = Math.floor(Date.now() / 1000)) {
  return `t=${t},v1=${createHmac('sha256', secret).update(`${t}${body}`).digest('hex')}`;
}
