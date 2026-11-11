import { beforeEach, describe, expect, it, vi } from 'vitest';

const db = vi.hoisted(() => ({ upsert: vi.fn(), findUnique: vi.fn() }));
const fetchMock = vi.hoisted(() => vi.fn());

vi.mock('server-only', () => ({}));
vi.mock('@/lib/prisma', () => ({ prisma: { sandboxTxn: { upsert: db.upsert, findUnique: db.findUnique } } }));
vi.mock('@/lib/env', () => ({
  env: {
    WAVE_API_KEY: 'wave_key',
    ORANGE_CLIENT_ID: 'client',
    ORANGE_CLIENT_SECRET: 'secret',
    ORANGE_MERCHANT_KEY: 'merchant',
    ORANGE_COUNTRY: 'ml',
    ORANGE_CURRENCY: 'XOF',
    SANDBOX_WEBHOOK_SECRET: 'sandbox_test_secret_0123456789',
  },
}));

import { providerFor } from '@/lib/payments/providers';
import { wave } from '@/lib/payments/providers/wave';
import { orange } from '@/lib/payments/providers/orange';
import { sandbox, signSandbox } from '@/lib/payments/providers/sandbox';
import { verifyWaveSignature } from '@/lib/payments/verify';

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });
const checkout = { paymentId: 'pay-1', amount: 25000, currency: 'XOF', returnUrl: 'https://ikaton.test/pay/return', notifyUrl: 'https://ikaton.test/api/webhooks/orange' };
const sent = (call = 0) => {
  const [url, init] = fetchMock.mock.calls[call] as [string, RequestInit];
  const raw = String(init.body ?? '');
  return { url, body: raw.startsWith('{') ? JSON.parse(raw) : raw, headers: init.headers as Record<string, string> };
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal('fetch', fetchMock);
});

describe('providerFor', () => {
  it('knows Wave, Orange Money and the demo operator', () => {
    expect(providerFor('WAVE')).toBe(wave);
    expect(providerFor('ORANGE')).toBe(orange);
    expect(providerFor('SANDBOX')).toBe(sandbox);
  });

  it('has no remote provider for cash, Moov or cards', () => {
    expect(providerFor('CASH')).toBeNull();
    expect(providerFor('MOOV')).toBeNull();
    expect(providerFor('CARD')).toBeNull();
  });
});

describe('Wave', () => {
  it('opens a checkout session tied to our payment id', async () => {
    fetchMock.mockResolvedValue(json({ id: 'cos_1', wave_launch_url: 'https://pay.wave.com/c/cos_1' }));
    expect(await wave.createCheckout(checkout)).toEqual({ providerRef: 'cos_1', checkoutUrl: 'https://pay.wave.com/c/cos_1' });
    const req = sent();
    expect(req.url).toBe('https://api.wave.com/v1/checkout/sessions');
    expect(req.headers).toMatchObject({ Authorization: 'Bearer wave_key', 'Idempotency-Key': 'pay-1' });
    expect(req.body).toMatchObject({ amount: '25000', currency: 'XOF', client_reference: 'pay-1', success_url: 'https://ikaton.test/pay/return?p=pay-1' });
  });

  it('throws when Wave refuses the session', async () => {
    fetchMock.mockResolvedValue(json({}, 503));
    await expect(wave.createCheckout(checkout)).rejects.toThrow('wave_503');
  });

  it('reads the amount and currency from Wave, not from us', async () => {
    fetchMock.mockResolvedValue(json({ payment_status: 'succeeded', checkout_status: 'complete', amount: '25000', currency: 'XOF' }));
    expect(await wave.fetchStatus({ id: 'pay-1', providerRef: 'cos_1', amount: 1 })).toEqual({ status: 'succeeded', amount: 25000, currency: 'XOF' });
    expect(sent().url).toBe('https://api.wave.com/v1/checkout/sessions/cos_1');
  });

  it.each([
    [{ payment_status: 'processing', checkout_status: 'open' }, 'pending'],
    [{ payment_status: 'cancelled', checkout_status: 'open' }, 'failed'],
    [{ payment_status: 'processing', checkout_status: 'expired' }, 'failed'],
    [{ payment_status: 'something_new', checkout_status: 'open' }, 'pending'],
  ])('maps %j to %s', async (session, status) => {
    fetchMock.mockResolvedValue(json({ ...session, amount: '25000', currency: 'XOF' }));
    expect((await wave.fetchStatus({ id: 'pay-1', providerRef: 'cos_1', amount: 25000 })).status).toBe(status);
  });

  it('answers unknown without a reference or when Wave is down', async () => {
    expect(await wave.fetchStatus({ id: 'pay-1', providerRef: null, amount: 25000 })).toEqual({ status: 'unknown' });
    expect(fetchMock).not.toHaveBeenCalled();
    fetchMock.mockResolvedValue(json({}, 500));
    expect(await wave.fetchStatus({ id: 'pay-1', providerRef: 'cos_1', amount: 25000 })).toEqual({ status: 'unknown' });
  });
});

describe('Orange Money', () => {
  it('fails when the access token is refused', async () => {
    fetchMock.mockResolvedValue(json({}, 401));
    await expect(orange.createCheckout(checkout)).rejects.toThrow('orange_oauth_401');
  });

  it('gets a token, then opens a web payment and returns the notification token', async () => {
    fetchMock
      .mockResolvedValueOnce(json({ access_token: 'tok_1', expires_in: 3600 }))
      .mockResolvedValueOnce(json({ pay_token: 'pt_1', payment_url: 'https://om.test/pt_1', notif_token: 'nt_1' }));
    expect(await orange.createCheckout(checkout)).toEqual({ providerRef: 'pt_1', checkoutUrl: 'https://om.test/pt_1', notifToken: 'nt_1' });
    expect(sent(0).url).toBe('https://api.orange.com/oauth/v3/token');
    expect(sent(0).headers.Authorization).toBe(`Basic ${Buffer.from('client:secret').toString('base64')}`);
    expect(sent(0).body).toBe('grant_type=client_credentials');
    const pay = sent(1);
    expect(pay.url).toBe('https://api.orange.com/orange-money-webpay/ml/v1/webpayment');
    expect(pay.headers.Authorization).toBe('Bearer tok_1');
    expect(pay.body).toMatchObject({ merchant_key: 'merchant', currency: 'XOF', order_id: 'pay-1', amount: 25000, notif_url: 'https://ikaton.test/api/webhooks/orange' });
  });

  it('reuses the token while it is still valid', async () => {
    fetchMock.mockResolvedValue(json({ status: 'SUCCESS' }));
    expect(await orange.fetchStatus({ id: 'pay-1', providerRef: 'pt_1', amount: 25000 })).toEqual({ status: 'succeeded', amount: 25000, currency: 'XOF' });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(sent().url).toBe('https://api.orange.com/orange-money-webpay/ml/v1/transactionstatus');
    expect(sent().body).toEqual({ order_id: 'pay-1', amount: 25000, pay_token: 'pt_1' });
  });

  it.each([
    ['FAILED', 'failed'],
    ['expired', 'failed'],
    ['INITIATED', 'pending'],
  ])('maps %s to %s', async (remote, status) => {
    fetchMock.mockResolvedValue(json({ status: remote }));
    expect((await orange.fetchStatus({ id: 'pay-1', providerRef: 'pt_1', amount: 25000 })).status).toBe(status);
  });

  it('refuses a web payment Orange rejects', async () => {
    fetchMock.mockResolvedValue(json({}, 400));
    await expect(orange.createCheckout(checkout)).rejects.toThrow('orange_400');
  });

  it('answers unknown without a reference or when Orange is down', async () => {
    expect(await orange.fetchStatus({ id: 'pay-1', providerRef: null, amount: 25000 })).toEqual({ status: 'unknown' });
    fetchMock.mockResolvedValue(json({}, 500));
    expect(await orange.fetchStatus({ id: 'pay-1', providerRef: 'pt_1', amount: 25000 })).toEqual({ status: 'unknown' });
  });
});

describe('demo operator', () => {
  it('records a pending transaction and sends the member nowhere', async () => {
    expect(await sandbox.createCheckout(checkout)).toEqual({ providerRef: 'sbx_pay-1', checkoutUrl: '' });
    expect(db.upsert).toHaveBeenCalledWith({ where: { paymentId: 'pay-1' }, update: {}, create: { paymentId: 'pay-1', amount: 25000, status: 'pending' } });
  });

  it.each([
    ['succeeded', 'succeeded'],
    ['failed', 'failed'],
    ['pending', 'pending'],
  ])('reports a %s transaction as %s', async (stored, status) => {
    db.findUnique.mockResolvedValue({ status: stored, amount: 25000 });
    expect(await sandbox.fetchStatus({ id: 'pay-1', providerRef: 'sbx_pay-1', amount: 25000 })).toEqual({ status, amount: 25000, currency: 'XOF' });
  });

  it('answers unknown for a transaction it never saw', async () => {
    db.findUnique.mockResolvedValue(null);
    expect(await sandbox.fetchStatus({ id: 'pay-1', providerRef: null, amount: 25000 })).toEqual({ status: 'unknown' });
  });

  it('signs like a real provider, so the same check accepts it', () => {
    const body = JSON.stringify({ id: 'evt_1' });
    expect(verifyWaveSignature(body, signSandbox(body), 'sandbox_test_secret_0123456789')).toBe(true);
    expect(verifyWaveSignature(body, signSandbox(body, 'guessed-secret'), 'sandbox_test_secret_0123456789')).toBe(false);
  });
});
