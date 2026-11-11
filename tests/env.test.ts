import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

const base = { APP_URL: 'https://ikaton.test', CRON_SECRET: 'cron_secret_123' };
const KEYS = ['APP_URL', 'CRON_SECRET', 'DEMO_MODE', 'SANDBOX_WEBHOOK_SECRET', 'PAYMENT_TIMEOUT_MINUTES', 'SANDBOX_TIMEOUT_MINUTES', 'ORANGE_COUNTRY'];

async function load(vars: Record<string, string>) {
  vi.resetModules();
  for (const key of KEYS) vi.stubEnv(key, undefined as unknown as string);
  for (const [key, value] of Object.entries(vars)) vi.stubEnv(key, value);
  return (await import('@/lib/env')).env;
}

afterEach(() => vi.unstubAllEnvs());

describe('env', () => {
  it('fills in safe defaults', async () => {
    const env = await load(base);
    expect(env).toMatchObject({ DEMO_MODE: false, PAYMENT_TIMEOUT_MINUTES: 15, SANDBOX_TIMEOUT_MINUTES: 2, ORANGE_COUNTRY: 'ml', ORANGE_CURRENCY: 'XOF' });
  });

  it('reads numbers and the demo switch from text', async () => {
    const env = await load({ ...base, DEMO_MODE: 'true', SANDBOX_WEBHOOK_SECRET: 'a-long-random-secret-0123', PAYMENT_TIMEOUT_MINUTES: '30' });
    expect(env.DEMO_MODE).toBe(true);
    expect(env.PAYMENT_TIMEOUT_MINUTES).toBe(30);
  });

  it('refuses to start without an app URL or with a short cron secret', async () => {
    await expect(load({ CRON_SECRET: 'cron_secret_123' })).rejects.toThrow();
    await expect(load({ APP_URL: 'https://ikaton.test', CRON_SECRET: 'short' })).rejects.toThrow();
  });

  it('refuses a payment timeout outside 2 to 120 minutes', async () => {
    await expect(load({ ...base, PAYMENT_TIMEOUT_MINUTES: '1' })).rejects.toThrow();
    await expect(load({ ...base, PAYMENT_TIMEOUT_MINUTES: '500' })).rejects.toThrow();
  });

  it.each(['', 'sandbox-secret-change-me', 'change-me-please-0123456789', 'too-short'])(
    'refuses to run the public demo with a guessable secret (%s)',
    async (secret) => {
      const vars = secret ? { ...base, DEMO_MODE: 'true', SANDBOX_WEBHOOK_SECRET: secret } : { ...base, DEMO_MODE: 'true' };
      await expect(load(vars)).rejects.toThrow(/at least 16 characters/);
    },
  );

  it('accepts the default sandbox secret when the demo is off', async () => {
    expect((await load(base)).SANDBOX_WEBHOOK_SECRET).toBe('sandbox-secret-change-me');
  });
});
