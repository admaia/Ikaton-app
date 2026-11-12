export const gaugeMode = (size: number) => (size <= 12 ? 'segments' : 'bar') as 'segments' | 'bar';

export const RHYTHM_DAYS = { WEEK: 7, FORTNIGHT: 14, MONTH: 30 } as const;
