import { describe, expect, it } from 'vitest';
import { canTransition, isLive } from '@/lib/payments/status';
import { gaugeMode } from '@/lib/tontine';
import { commit, drawOrder } from '@/lib/draw';

describe('payment state machine', () => {
  it('never leaves CONFIRMED', () => {
    for (const to of ['PENDING', 'FAILED', 'EXPIRED', 'NEEDS_REVIEW', 'CONFIRMED'] as const) expect(canTransition('CONFIRMED', to)).toBe(false);
  });
  it('lets a verified late confirmation rescue an expired payment', () => expect(canTransition('EXPIRED', 'CONFIRMED')).toBe(true));
  it('follows the happy path: initiated, pending, confirmed', () => {
    expect(canTransition('INITIATED', 'PENDING')).toBe(true);
    expect(canTransition('PENDING', 'CONFIRMED')).toBe(true);
  });
  it('lets a pending payment fail or expire', () => {
    expect(canTransition('PENDING', 'FAILED')).toBe(true);
    expect(canTransition('PENDING', 'EXPIRED')).toBe(true);
  });
  it('cannot confirm a payment the provider never received', () => expect(canTransition('INITIATED', 'CONFIRMED')).toBe(false));
  it('never revives a payment to pending', () => {
    expect(canTransition('EXPIRED', 'PENDING')).toBe(false);
    expect(canTransition('FAILED', 'PENDING')).toBe(false);
  });
});

describe('live payments', () => {
  it('only initiated and pending payments are live', () => {
    expect(isLive('INITIATED')).toBe(true);
    expect(isLive('PENDING')).toBe(true);
    for (const s of ['CONFIRMED', 'FAILED', 'EXPIRED', 'NEEDS_REVIEW'] as const) expect(isLive(s)).toBe(false);
  });
});

describe('tontine', () => {
  it('draw is deterministic for a seed and a permutation', () => {
    const ids = Array.from({ length: 40 }, (_, i) => i);
    const a = drawOrder(ids, 'seed');
    expect(drawOrder(ids, 'seed')).toEqual(a);
    expect([...a].sort((x, y) => x - y)).toEqual(ids);
  });
  it('a different seed gives a different order', () => {
    const ids = Array.from({ length: 20 }, (_, i) => i);
    expect(drawOrder(ids, 'seed-a')).not.toEqual(drawOrder(ids, 'seed-b'));
  });
  it('the published commitment matches the revealed seed', () => {
    expect(commit('seed')).toBe(commit('seed'));
    expect(commit('seed')).not.toBe(commit('seed2'));
  });
  it('switches gauge above 12', () => {
    expect(gaugeMode(12)).toBe('segments');
    expect(gaugeMode(13)).toBe('bar');
  });
});
