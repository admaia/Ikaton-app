import { notFound } from 'next/navigation';
import Link from 'next/link';
import { requireUser } from '@/lib/auth';
import { getPayout } from '@/lib/data';
import { getT } from '@/i18n/server';
import { ledgerText } from '@/i18n/dict';
import { fcfa } from '@/lib/money';
import { addDays, monthName } from '@/lib/dates';
import { RHYTHM_DAYS } from '@/lib/tontine';
import { ArrowRight, Collage, delay } from '@/components/ui/Kit';

const FADE = 'linear-gradient(var(--night) 0%, rgba(22,25,24,.88) 15%, rgba(22,25,24,.06) 28%, rgba(22,25,24,0) 38%, rgba(22,25,24,.62) 45%, rgba(22,25,24,.95) 51%, var(--night) 58%)';
const MASK = 'radial-gradient(104% 100% at 50% 46%, #000 36%, rgba(0,0,0,.82) 58%, rgba(0,0,0,.34) 78%, transparent 97%)';

export default async function TourPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { lang, t } = await getT();
  const tp = t.payout;
  const data = await getPayout((await params).id, user.id);
  if (!data) notFound();
  const { circle, paidOut, via, members, cycleIndex, dueAt } = data;
  const total = circle.amount * circle.size;
  const end = monthName(addDays(dueAt, (circle.size - cycleIndex) * RHYTHM_DAYS[circle.rhythm]), lang);
  const endLabel = lang === 'fr' ? end.toLowerCase() : end;
  const stat = 'm-0 mt-1.5 font-serif text-[20px]';

  return (
    <main className="relative min-h-dvh overflow-hidden bg-night text-on-night">
      <Collage name="pot-received" alt={tp.art} width={318} priority mask={MASK} className="left-1/2 top-[126px] -ml-[159px]" />
      <div aria-hidden className="absolute inset-0" style={{ background: FADE }} />
      <div className="grain" />

      <p className="a-fade absolute inset-x-[26px] top-[72px] z-10 m-0 text-center text-[10px] font-bold uppercase tracking-[.3em] text-accent-soft" style={delay(0.2)}>
        {paidOut ? tp.eyebrowDone : tp.eyebrowNow}
      </p>

      <div className="relative z-10 flex min-h-dvh flex-col justify-end px-[26px] pb-[110px] pt-[420px]">
        <h1 className="a-clip m-0 font-serif text-[40px] font-normal leading-[.98] tracking-[-.025em]" style={delay(0.3)}>
          {paidOut ? <>{tp.doneA}<br /><em className="text-accent-soft">{tp.doneEm}</em> {tp.doneB}</> : <>{tp.nowA}<br /><em className="text-accent-soft">{tp.nowEm}</em></>}
        </h1>
        <div className="a-up mt-[22px] flex items-end gap-3" style={delay(0.5)}>
          <span className="whitespace-nowrap font-serif text-[66px] leading-[.82] tracking-[-.02em] tabular-nums">{fcfa(total)}</span>
          <span className="min-w-0 flex-1 pb-2 text-[11px] font-bold uppercase tracking-[.2em] text-on-night-muted">FCFA</span>
        </div>
        <dl className="a-up-sm m-0 mt-5 grid grid-cols-2 border-t border-on-night/28" style={delay(0.62)}>
          <div className="border-r border-on-night/28 py-3.5 pr-3.5">
            <dt className="text-[9px] font-bold uppercase tracking-[.18em] text-on-night-muted">{paidOut ? tp.paidTo : tp.payout}</dt>
            <dd className={stat}>{paidOut ? ledgerText(via, lang) ?? 'Mobile Money' : tp.whenFull}</dd>
          </div>
          <div className="py-3.5 pl-3.5">
            <dt className="text-[9px] font-bold uppercase tracking-[.18em] text-on-night-muted">{tp.by}</dt>
            <dd className={stat}>{tp.members(members)}</dd>
          </div>
        </dl>
        <p className="a-fade m-0 mb-5 mt-4 text-[13px] font-medium leading-normal text-on-night-muted" style={delay(0.72)}>
          {tp.keepPaying(fcfa(circle.amount), t.rhythm[circle.rhythm], endLabel)}
        </p>
        <Link href={`/tontines/${circle.id}/registre`} className="a-up-sm flex min-h-[58px] w-full items-center justify-between bg-accent px-[22px] text-[11px] font-bold uppercase tracking-[.2em] text-white no-underline transition-colors hover:bg-accent-strong" style={delay(0.8)}>
          {tp.details} <ArrowRight />
        </Link>
        <Link href={`/tontines/${circle.id}`} className="mt-2 flex min-h-12 items-center justify-center text-[10px] font-bold uppercase tracking-[.18em] text-on-night-muted no-underline hover:text-on-night">
          {tp.back}
        </Link>
      </div>
    </main>
  );
}
