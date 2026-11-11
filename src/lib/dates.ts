const TZ = 'Africa/Bamako';
const DAY = 864e5;

const fmt = (d: Date, o: Intl.DateTimeFormatOptions) => d.toLocaleDateString('fr-FR', { timeZone: TZ, ...o });
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export const dayMonth = (d: Date) => fmt(d, { day: 'numeric', month: 'short' });
export const longDate = (d: Date) => fmt(d, { day: 'numeric', month: 'long' });
export const monthName = (d: Date) => cap(fmt(d, { month: 'long' }));
export const today = (d = new Date()) => cap(fmt(d, { weekday: 'short', day: 'numeric', month: 'short' }));
export const clock = (d: Date) => d.toLocaleTimeString('fr-FR', { timeZone: TZ, hour: '2-digit', minute: '2-digit' });

export const daysLeft = (due: Date, now = new Date()) => Math.max(0, Math.ceil((due.getTime() - now.getTime()) / DAY));

export function relativeDay(d: Date, now = new Date()) {
  const key = (x: Date) => fmt(x, { year: 'numeric', month: '2-digit', day: '2-digit' });
  if (key(d) === key(now)) return 'Aujourd’hui';
  if (key(d) === key(new Date(now.getTime() - DAY))) return 'Hier';
  return dayMonth(d);
}

export const addDays = (d: Date, n: number) => new Date(d.getTime() + n * DAY);
