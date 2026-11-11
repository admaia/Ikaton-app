import 'server-only';
import { z } from 'zod';

const schema = z.object({
  APP_URL: z.string().url(),
  PAYMENT_TIMEOUT_MINUTES: z.coerce.number().int().min(2).max(120).default(15),
  CRON_SECRET: z.string().min(8),
  WAVE_API_KEY: z.string().default(''),
  WAVE_WEBHOOK_SECRET: z.string().default(''),
  ORANGE_CLIENT_ID: z.string().default(''),
  ORANGE_CLIENT_SECRET: z.string().default(''),
  ORANGE_MERCHANT_KEY: z.string().default(''),
  ORANGE_COUNTRY: z.string().default('ml'),
  ORANGE_CURRENCY: z.string().default('XOF'),
  DEMO_MODE: z.enum(['true', 'false']).default('false').transform((v) => v === 'true'),
  SANDBOX_WEBHOOK_SECRET: z.string().default('sandbox-secret-change-me'),
  SANDBOX_TIMEOUT_MINUTES: z.coerce.number().int().min(1).default(2),
});

// A guessable secret would let anyone forge sandbox confirmations on the public demo.
const checked = schema.superRefine((v, ctx) => {
  if (v.DEMO_MODE && (v.SANDBOX_WEBHOOK_SECRET.length < 16 || v.SANDBOX_WEBHOOK_SECRET.startsWith('sandbox-secret') || v.SANDBOX_WEBHOOK_SECRET.startsWith('change-me'))) {
    ctx.addIssue({ code: 'custom', path: ['SANDBOX_WEBHOOK_SECRET'], message: 'Set a random secret of at least 16 characters when DEMO_MODE=true' });
  }
});

export const env = checked.parse(process.env);
