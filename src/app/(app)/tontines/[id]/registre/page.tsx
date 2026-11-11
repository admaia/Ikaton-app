import { notFound } from 'next/navigation';
import { requireUser } from '@/lib/auth';
import { getLedger } from '@/lib/data';
import { dayMonth } from '@/lib/dates';
import { BackLink, Tag, delay } from '@/components/ui/Kit';
import { getT } from '@/i18n/server';
import { ledgerText } from '@/i18n/dict';
import { Ledger } from './Ledger';

export default async function RegistrePage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { lang, t } = await getT();
  const tl = t.ledger;
  const data = await getLedger((await params).id, user.id);
  if (!data) notFound();
  const { circle, cycles, loose, total, fixes } = data;

  const row = (r: { id: string; kind: string; text: string; meta: string | null; amount: number | null; createdAt: Date }) => ({
    id: r.id, kind: r.kind, text: ledgerText(r.text, lang)!, meta: ledgerText(r.meta, lang), amount: r.amount, at: r.createdAt.toISOString(),
  });
  const groups = cycles
    .filter((c) => c.rows.length)
    .map((c) => ({
      key: c.id,
      title: c.status === 'OPEN' ? tl.cycleOpen(c.index) : tl.cycleDone(c.index),
      aside: c.status === 'OPEN' ? tl.dueOn(dayMonth(c.dueAt, lang)) : c.closedAt ? tl.paidOn(dayMonth(c.closedAt, lang)) : tl.closed,
      rows: c.rows.map(row),
    }));
  if (loose.length) {
    groups.push({ key: 'circle', title: tl.circle, aside: tl.opening, rows: loose.map(row) });
  }

  return (
    <main className="relative">
      <section className="relative bg-night px-[22px] pb-[26px] pt-[60px] text-on-night">
        <div className="flex items-center justify-between gap-2.5">
          <BackLink href={`/tontines/${circle.id}`} label={tl.back(circle.name)} />
          <p className="m-0 truncate text-[9.5px] font-bold uppercase tracking-[.18em] text-on-night-muted">{circle.name}</p>
          <Tag tone="outline-night">{tl.public}</Tag>
        </div>
        <h1 className="a-clip m-0 mt-6 font-serif text-[38px] font-normal leading-[.98] tracking-[-.025em]" style={delay(0.1)}>{tl.title}</h1>
        <p className="m-0 mt-3 text-[13px] font-medium leading-normal text-on-night-muted">
          {tl.intro(circle.members)}
        </p>
        <dl className="m-0 mt-[22px] grid grid-cols-3 border-t border-on-night/28">
          {[[tl.lines, total], [tl.cycles, cycles.length], [tl.fixes, fixes]].map(([k, v], i) => (
            <div key={k} className={`py-[13px] ${i ? 'pl-3' : ''} ${i < 2 ? 'border-r border-on-night/28' : ''}`}>
              <dt className="text-[9px] font-bold uppercase tracking-[.18em] text-on-night-muted">{k}</dt>
              <dd className="m-0 mt-1.5 font-serif text-[22px]">{v}</dd>
            </div>
          ))}
        </dl>
      </section>
      <Ledger groups={groups} circleId={circle.id} circleName={circle.name} />
    </main>
  );
}
