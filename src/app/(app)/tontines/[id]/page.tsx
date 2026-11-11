import { notFound } from 'next/navigation';
import Link from 'next/link';
import { requireUser } from '@/lib/auth';
import { getCircle, METHOD, type ShareStatus } from '@/lib/data';
import { fcfa } from '@/lib/money';
import { addDays, dayMonth, monthName } from '@/lib/dates';
import { RHYTHM_DAYS } from '@/lib/tontine';
import { ArrowRight, BackLink, SectionHead, Tag, delay } from '@/components/ui/Kit';
import { CircleActions } from './CircleActions';
import { Ring } from './Ring';

const MARK: Record<ShareStatus, [string, string]> = {
  paid: ['bg-accent', 'Payé'],
  pending: ['border-[1.5px] border-ink', 'Attente'],
  late: ['bg-warn rotate-45 rounded-none', 'Retard'],
  due: ['border-[1.5px] border-ink', 'À payer'],
};

export default async function CirclePage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ pay?: string }> }) {
  const user = await requireUser();
  const data = await getCircle((await params).id, user.id);
  if (!data) notFound();
  const { circle, cycle, members, me, pendingCash } = data;
  const autoOpen = (await searchParams).pay === '1';
  const mine = members.find((m) => m.isMe)!;
  const total = circle.amount * circle.size;
  const step = RHYTHM_DAYS[circle.rhythm];
  const when = (turn: number) => {
    const d = addDays(cycle!.dueAt, (turn - cycle!.index) * step);
    return circle.rhythm === 'MONTH' ? monthName(d) : dayMonth(d);
  };

  const top = (
    <div className="relative flex items-center justify-between gap-2.5 px-5">
      <BackLink href="/tontines" label="Retour aux tontines" />
      <p className="m-0 truncate text-[9.5px] font-bold uppercase tracking-[.18em] text-on-night-muted">{circle.name}{cycle ? ` · Cycle ${cycle.index}` : ''}</p>
      <Tag tone="outline-night">{me.role === 'ADMIN' ? 'Gestionnaire' : 'Membre'}</Tag>
    </div>
  );

  if (!cycle) {
    return (
      <main className="relative">
        <section className="relative bg-night px-0 pb-9 pt-[60px] text-on-night">
          {top}
          <div className="px-[22px] pt-8">
            <p className="m-0 text-[9px] font-bold uppercase tracking-[.24em] text-on-night-muted">Le cercle se forme</p>
            <h1 className="a-clip m-0 mt-3 font-serif text-[40px] font-normal leading-[.97] tracking-[-.025em]">{circle.name}</h1>
            <p className="m-0 mt-6 flex items-baseline gap-2.5">
              <span className="font-serif text-[60px] leading-[.85]">{members.length}</span>
              <span className="text-[17px] font-extrabold">/ {circle.size} ont rejoint</span>
            </p>
            <span aria-hidden className="mt-4 flex gap-1">
              {Array.from({ length: circle.size }, (_, k) => <span key={k} className={`a-bar block h-[26px] flex-1 ${k < members.length ? 'bg-accent' : 'bg-on-night/18'}`} style={delay(0.2 + k * 0.05)} />)}
            </span>
            <p className="m-0 mt-5 text-[13px] font-medium leading-normal text-on-night-muted">
              Le premier cycle s’ouvre quand les {circle.size} membres ont rejoint. Personne ne cotise avant : {fcfa(circle.amount)} FCFA par part, {total ? `${fcfa(total)} FCFA par tour` : ''}.
            </p>
          </div>
        </section>
        <section className="px-[22px] pt-8">
          <SectionHead title="Déjà dans le cercle" aside={`${members.length} / ${circle.size}`} />
          <ul className="m-0 list-none p-0">
            {members.map((m) => (
              <li key={m.id} className="flex min-h-14 items-center justify-between border-b border-dotted border-line-strong py-3 text-[14.5px] font-semibold">
                <span>{m.name}{m.isMe && <span className="ml-1.5 text-[10px] font-semibold uppercase tracking-[.12em] text-muted">vous</span>}</span>
                <span className="text-[9.5px] font-bold uppercase tracking-[.12em] text-muted">A rejoint</span>
              </li>
            ))}
          </ul>
        </section>
      </main>
    );
  }

  const missing = members.filter((m) => !m.isMe && m.status !== 'paid').map((m) => m.name);
  const collected = cycle.paid * circle.amount;
  const ordered = [...members].sort((a, b) => (a.turn ?? 0) - (b.turn ?? 0));
  const ticker = [`Cycle ${cycle.index}`, `Échéance ${dayMonth(cycle.dueAt)}`, `${cycle.paid} / ${circle.size} ont cotisé`, `${cycle.beneficiary} reçoit`];

  return (
    <main className="relative">
      <section className="relative overflow-hidden bg-night pb-[34px] pt-[60px] text-on-night">
        {top}
        <Ring
          members={ordered.map((m) => ({ id: m.id, name: m.name, turn: m.turn, isMe: m.isMe, status: m.status, method: m.method ? METHOD[m.method] : null }))}
          paid={cycle.paid}
          size={circle.size}
          amount={circle.amount}
          beneficiaryId={cycle.beneficiaryId}
        />
      </section>

      <div className="relative flex h-10 items-center overflow-hidden border-t border-on-night/24 bg-night">
        <div aria-hidden className="a-marquee flex w-max">
          {[0, 1].map((k) => (
            <span key={k} className="flex items-center gap-[22px] whitespace-nowrap pr-[22px] text-[9.5px] font-bold uppercase tracking-[.24em] text-on-night">
              {ticker.map((t) => (
                <span key={t} className="flex items-center gap-[22px]"><span>{t}</span><span className="block size-[5px] bg-accent" /></span>
              ))}
            </span>
          ))}
        </div>
      </div>

      <section className="torn-b relative bg-accent px-[22px] pb-[46px] pt-6 text-[#161918]" aria-label="Bénéficiaire">
        <span className="inline-block bg-[#161918] px-2.5 py-1.5 text-[9px] font-bold uppercase tracking-[.22em] text-on-night">Bénéficiaire du cycle {cycle.index}</span>
        <div className="mt-3 flex items-end justify-between gap-3.5">
          <p className="m-0 font-serif text-[30px] leading-none">{cycle.beneficiary}{cycle.beneficiaryId === me.id ? ' — vous' : ''}</p>
          <p className="m-0 font-serif text-[34px] leading-[.9] text-on-night">{fcfa(total)}</p>
        </div>
        <span className="mt-3 inline-block bg-[#161918] px-2.5 py-1.5 text-[9.5px] font-bold uppercase tracking-[.16em] text-on-night">
          {cycle.paid === circle.size ? 'Pot complet — versement en cours' : 'Versé dès que le pot est complet'}
        </span>
      </section>

      <div className="px-[22px] pt-7">
        <CircleActions
          cycleId={cycle.id}
          amount={circle.amount}
          acceptsCash={circle.acceptsCash}
          myStatus={mine.status!}
          dueAt={cycle.dueAt.toISOString()}
          pendingCash={pendingCash.map((p) => ({ ...p, createdAt: p.createdAt.toISOString() }))}
          autoOpen={autoOpen}
          ctx={{ circle: circle.name, cycle: cycle.index, beneficiary: cycle.beneficiary, admin: me.role === 'ADMIN' ? '' : circle.admin, size: circle.size, paid: cycle.paid, total, missing }}
        />

        <SectionHead className="mt-[34px]" title="L’ordre des tours" aside={circle.orderMode === 'DRAW' ? 'Tiré au sort' : 'Fixé à l’ouverture'} />
        <ol className="-mx-[22px] mt-[18px] flex list-none scroll-pl-[22px] snap-x snap-mandatory gap-2.5 overflow-x-auto px-[22px] pb-2 pt-0.5 [scrollbar-width:none]">
          {ordered.map((m) => {
            const t = m.turn ?? 0;
            const past = t < cycle.index;
            const current = t === cycle.index;
            const name = <p className={`m-0 mt-3.5 text-[14px] ${m.isMe || current ? 'font-bold' : 'font-semibold'}`}>{m.name}</p>;
            if (current) {
              return (
                <li key={m.id} className="w-[134px] shrink-0 snap-start bg-forest px-[13px] pb-3.5 pt-3 text-on-night">
                  <p className="m-0 font-serif text-[24px] leading-none">{t}</p>
                  {name}
                  <p className="m-0 mt-1.5 text-[9px] font-bold uppercase tracking-[.16em]">En cours{m.isMe ? ' — vous' : ''}</p>
                  <p className="m-0 mt-3 font-serif text-[21px]">{fcfa(total)}</p>
                </li>
              );
            }
            if (m.isMe) {
              return (
                <li key={m.id} className="w-[134px] shrink-0 snap-start border-2 border-accent px-[11px] pb-3 pt-2.5">
                  <p className="m-0 font-serif text-[24px] leading-none">{t}</p>
                  {name}
                  <span className="mt-[7px] inline-block bg-accent px-[7px] py-1 text-[8.5px] font-bold uppercase tracking-[.14em] text-white">{past ? 'Reçu' : 'Votre tour'}</span>
                  {past ? (
                    <Link href={`/tontines/${circle.id}/tour`} className="mt-[11px] flex items-center justify-between font-serif text-[18px] text-ink no-underline hover:text-accent-text">{fcfa(total)} <span aria-hidden>→</span></Link>
                  ) : (
                    <p className="m-0 mt-[11px] font-serif text-[21px]">{fcfa(total)}</p>
                  )}
                </li>
              );
            }
            return (
              <li key={m.id} className={`w-[134px] shrink-0 snap-start border-t-2 pt-3 ${past ? 'border-line-strong text-muted' : 'border-ink'}`}>
                <p className="m-0 font-serif text-[24px] leading-none">{t}</p>
                {name}
                <p className="m-0 mt-1.5 text-[9px] font-bold uppercase tracking-[.16em] text-muted">{past ? `Reçu — ${when(t).toLowerCase()}` : when(t)}</p>
              </li>
            );
          })}
        </ol>
        <p className="m-0 mt-3.5 text-[12.5px] font-medium leading-normal text-muted">
          Faites défiler les {circle.size} tours. L’ordre est {circle.orderMode === 'DRAW' ? 'tiré au sort' : 'fixé'} à l’ouverture du cercle et ne change plus.
          {circle.sealed && <> <Link href={`/tontines/${circle.id}/order`} className="font-semibold">Voir la preuve du tirage</Link>.</>}
        </p>

        <SectionHead className="mt-[34px]" title="Le registre du cycle" aside={`${cycle.paid} / ${circle.size}`} />
        <ul className="m-0 list-none p-0">
          {ordered.map((m) => {
            const [mark, label] = MARK[m.status!];
            return (
              <li key={m.id} className="flex min-h-[50px] items-center gap-3 border-b border-dotted border-line-strong py-[13px] last:border-b-0">
                <span className={`flex-1 text-[14.5px] ${m.isMe ? 'font-extrabold' : 'font-semibold'}`}>
                  {m.name}{m.isMe && <span className="ml-1.5 text-[10px] font-semibold uppercase tracking-[.12em] text-muted">vous</span>}
                </span>
                {m.method && <span className="text-[10px] font-semibold uppercase tracking-[.12em] text-muted">{METHOD[m.method]}</span>}
                <span aria-hidden className={`block size-2.5 shrink-0 rounded-full ${mark}`} />
                <span className="w-[52px] text-right text-[9.5px] font-bold uppercase tracking-[.12em]">{label}</span>
              </li>
            );
          })}
        </ul>
        <div className="mt-1.5 flex items-baseline gap-3 border-t-[1.5px] border-ink pt-4">
          <span className="flex-1 text-[10px] font-bold uppercase tracking-[.2em]">Total encaissé</span>
          <span className="font-serif text-[26px]">{fcfa(collected)}</span>
        </div>

        <Link href={`/tontines/${circle.id}/registre`} className="mt-7 flex min-h-[58px] items-center gap-3.5 border border-ink px-4 py-3.5 text-[12.5px] font-bold text-ink no-underline transition-colors hover:bg-ink hover:text-paper">
          <span className="flex-1">Ouvrir le registre complet</span>
          <ArrowRight />
        </Link>
      </div>
    </main>
  );
}
