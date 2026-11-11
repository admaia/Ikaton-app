import { dict, type Lang } from '@/i18n/dict';

const TZ = 'Africa/Bamako';
const DAY = 864e5;

const fmt = (d: Date, lang: Lang, o: Intl.DateTimeFormatOptions) => d.toLocaleDateString(dict[lang].locale, { timeZone: TZ, ...o });
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export const dayMonth = (d: Date, lang: Lang) => fmt(d, lang, { day: 'numeric', month: 'short' });
export const longDate = (d: Date, lang: Lang) => fmt(d, lang, { day: 'numeric', month: 'long' });
export const monthName = (d: Date, lang: Lang) => cap(fmt(d, lang, { month: 'long' }));
export const today = (lang: Lang, d = new Date()) => cap(fmt(d, lang, { weekday: 'short', day: 'numeric', month: 'short' }));
export const clock = (d: Date) => d.toLocaleTimeString('fr-FR', { timeZone: TZ, hour: '2-digit', minute: '2-digit' });

export const daysLeft = (due: Date, now = new Date()) => Math.max(0, Math.ceil((due.getTime() - now.getTime()) / DAY));

export function relativeDay(d: Date, lang: Lang, now = new Date()) {
  const key = (x: Date) => fmt(x, 'fr', { year: 'numeric', month: '2-digit', day: '2-digit' });
  if (key(d) === key(now)) return dict[lang].today;
  if (key(d) === key(new Date(now.getTime() - DAY))) return dict[lang].yesterday;
  return dayMonth(d, lang);
}

export const addDays = (d: Date, n: number) => new Date(d.getTime() + n * DAY);
