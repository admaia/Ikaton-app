import { env } from '@/lib/env';
import type { PaymentProvider } from './types';

const BASE = 'https://api.orange.com';
let cached: { token: string; until: number } | null = null;

async function token() {
  if (cached && cached.until > Date.now()) return cached.token;
  const res = await fetch(`${BASE}/oauth/v3/token`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${Buffer.from(`${env.ORANGE_CLIENT_ID}:${env.ORANGE_CLIENT_SECRET}`).toString('base64')}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials',
  });
  if (!res.ok) throw new Error(`orange_oauth_${res.status}`);
  const j = await res.json();
  cached = { token: j.access_token, until: Date.now() + (j.expires_in - 60) * 1000 };
  return cached.token;
}

const url = (p: string) => `${BASE}/orange-money-webpay/${env.ORANGE_COUNTRY}/v1${p}`;

export const orange: PaymentProvider = {
  async createCheckout({ paymentId, amount, returnUrl, notifyUrl }) {
    const res = await fetch(url('/webpayment'), {
      method: 'POST',
      headers: { Authorization: `Bearer ${await token()}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        merchant_key: env.ORANGE_MERCHANT_KEY,
        currency: env.ORANGE_CURRENCY,
        order_id: paymentId,
        amount,
        return_url: `${returnUrl}?p=${paymentId}`,
        cancel_url: `${returnUrl}?p=${paymentId}`,
        notif_url: notifyUrl,
        lang: 'fr',
        reference: 'Ikaton',
      }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) throw new Error(`orange_${res.status}`);
    const j = await res.json();
    return { providerRef: j.pay_token, checkoutUrl: j.payment_url, notifToken: j.notif_token };
  },

  async fetchStatus({ id, providerRef, amount }) {
    if (!providerRef) return { status: 'unknown' };
    const res = await fetch(url('/transactionstatus'), {
      method: 'POST',
      headers: { Authorization: `Bearer ${await token()}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ order_id: id, amount, pay_token: providerRef }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) return { status: 'unknown' };
    const j = await res.json();
    const s = String(j.status).toUpperCase();
    return {
      status: s === 'SUCCESS' ? 'succeeded' : s === 'FAILED' || s === 'EXPIRED' ? 'failed' : 'pending',
      amount,
      currency: env.ORANGE_CURRENCY,
    };
  },
};
