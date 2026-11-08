import { env } from '@/lib/env';
import type { PaymentProvider, RemoteStatus } from './types';

const API = 'https://api.wave.com/v1';
const headers = () => ({ Authorization: `Bearer ${env.WAVE_API_KEY}`, 'Content-Type': 'application/json' });

export const wave: PaymentProvider = {
  async createCheckout({ paymentId, amount, currency, returnUrl }) {
    const res = await fetch(`${API}/checkout/sessions`, {
      method: 'POST',
      headers: { ...headers(), 'Idempotency-Key': paymentId },
      body: JSON.stringify({
        amount: String(amount),
        currency,
        client_reference: paymentId,
        success_url: `${returnUrl}?p=${paymentId}`,
        error_url: `${returnUrl}?p=${paymentId}`,
      }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) throw new Error(`wave_${res.status}`);
    const s = await res.json();
    return { providerRef: s.id, checkoutUrl: s.wave_launch_url };
  },

  async fetchStatus({ providerRef }) {
    if (!providerRef) return { status: 'unknown' };
    const res = await fetch(`${API}/checkout/sessions/${providerRef}`, { headers: headers(), signal: AbortSignal.timeout(10_000) });
    if (!res.ok) return { status: 'unknown' };
    const s = await res.json();
    const map: Record<string, RemoteStatus> = { succeeded: 'succeeded', processing: 'pending', cancelled: 'failed' };
    const status: RemoteStatus = s.checkout_status === 'expired' ? 'failed' : map[s.payment_status] ?? 'pending';
    return { status, amount: Number(s.amount), currency: s.currency };
  },
};
