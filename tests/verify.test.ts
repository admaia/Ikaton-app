import { describe, expect, it } from 'vitest';
import { createHmac } from 'node:crypto';
import { verifyWaveSignature, verifyOrangeToken, hashToken } from '@/lib/payments/verify';

const secret = 'whsec_test';
const body = '{"id":"evt_1","type":"checkout.session.completed"}';
const sign = (t: number, b = body) => `t=${t},v1=${createHmac('sha256', secret).update(`${t}${b}`).digest('hex')}`;

describe('wave signature', () => {
  const now = 1_800_000_000;
  it('accepts a genuine, fresh signature', () => expect(verifyWaveSignature(body, sign(now), secret, now)).toBe(true));
  it('rejects a tampered body', () => expect(verifyWaveSignature(body.replace('evt_1', 'evt_2'), sign(now), secret, now)).toBe(false));
  it('rejects a replay older than 5 minutes', () => expect(verifyWaveSignature(body, sign(now - 600), secret, now)).toBe(false));
  it('rejects a missing header', () => expect(verifyWaveSignature(body, null, secret, now)).toBe(false));
  it('rejects the wrong secret', () => expect(verifyWaveSignature(body, sign(now), 'other', now)).toBe(false));
});

describe('orange token', () => {
  it('matches only the stored hash', () => {
    expect(verifyOrangeToken('tok_abc', hashToken('tok_abc'))).toBe(true);
    expect(verifyOrangeToken('tok_xyz', hashToken('tok_abc'))).toBe(false);
    expect(verifyOrangeToken(undefined, hashToken('tok_abc'))).toBe(false);
  });
});
