import { createHash, createHmac, timingSafeEqual } from 'node:crypto';

const safeEq = (a: string, b: string) => {
  const A = Buffer.from(a);
  const B = Buffer.from(b);
  return A.length === B.length && timingSafeEqual(A, B);
};

// Header format: t=<unix>,v1=<hex HMAC-SHA256(secret, t + rawBody)>
export function verifyWaveSignature(rawBody: string, header: string | null, secret: string, nowSec = Date.now() / 1000, toleranceSec = 300) {
  if (!header || !secret) return false;
  const parts = Object.fromEntries(header.split(',').map((kv) => kv.trim().split('=') as [string, string]));
  const t = Number(parts.t);
  const sigs = header.split(',').filter((p) => p.trim().startsWith('v1=')).map((p) => p.trim().slice(3));
  if (!Number.isFinite(t) || sigs.length === 0) return false;
  if (Math.abs(nowSec - t) > toleranceSec) return false;
  const expected = createHmac('sha256', secret).update(`${t}${rawBody}`).digest('hex');
  return sigs.some((s) => safeEq(s, expected));
}

export const hashToken = (token: string) => createHash('sha256').update(token).digest('hex');

export function verifyOrangeToken(received: string | undefined, storedHash: string | null) {
  if (!received || !storedHash) return false;
  return safeEq(hashToken(received), storedHash);
}
