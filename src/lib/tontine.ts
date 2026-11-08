export const pot = (amount: number, size: number) => amount * size;

export const gaugeMode = (size: number) => (size <= 12 ? 'segments' : 'bar') as 'segments' | 'bar';
export const needsSearch = (size: number) => size > 13;

export const RHYTHM_DAYS = { WEEK: 7, FORTNIGHT: 14, MONTH: 30 } as const;

export function commitmentMonths(size: number, rhythm: keyof typeof RHYTHM_DAYS) {
  return Math.max(1, Math.round((size * RHYTHM_DAYS[rhythm]) / 30));
}
