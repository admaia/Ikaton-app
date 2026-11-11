import { notFound } from 'next/navigation';
import { requireUser } from '@/lib/auth';
import { getLedger } from '@/lib/data';
import { dayMonth } from '@/lib/dates';
import { BackLink, Tag, delay } from '@/components/ui/Kit';
import { Ledger } from './Ledger';

const WORDS = ['', 'un', 'deux', 'trois', 'quatre', 'cinq', 'six', 'sept', 'huit', 'neuf', 'dix', 'onze', 'douze'];

export default async function RegistrePage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const data = await getLedger((await params).id, user.id);
  if (!data) notFound();
  const { circle, cycles, loose, total, fixes } = data;
  const n = circle.members;

  const groups = cycles
    .filter((c) => c.rows.length)
    .map((c) => ({
      key: c.id,
      title: `Cycle ${c.index} — ${c.status === 'OPEN' ? 'en cours' : 'bouclé'}`,
      aside: c.status === 'OPEN' ? `Échéance le ${dayMonth(c.dueAt)}` : c.closedAt ? `Versé le ${dayMonth(c.closedAt)}` : 'Clôturé',
      rows: c.rows.map((r) => ({ id: r.id, kind: r.kind, text: r.text, meta: r.meta, amount: r.amount, at: r.createdAt.toISOString() })),
    }));
  if (loose.length) {
    groups.push({ key: 'circle', title: 'Le cercle', aside: 'Ouverture', rows: loose.map((r) => ({ id: r.id, kind: r.kind, text: r.text, meta: r.meta, amount: r.amount, at: r.createdAt.toISOString() })) });
  }

  return (
    <main className="relative">
      <section className="relative bg-night px-[22px] pb-[26px] pt-[60px] text-on-night">
        <div className="flex items-center justify-between gap-2.5">
          <BackLink href={`/tontines/${circle.id}`} label={`Retour à ${circle.name}`} />
          <p className="m-0 truncate text-[9.5px] font-bold uppercase tracking-[.18em] text-on-night-muted">{circle.name}</p>
          <Tag tone="outline-night">Public</Tag>
        </div>
        <h1 className="a-clip m-0 mt-6 font-serif text-[38px] font-normal leading-[.98] tracking-[-.025em]" style={delay(0.1)}>Le registre</h1>
        <p className="m-0 mt-3 text-[13px] font-medium leading-normal text-on-night-muted">
          Chaque dépôt, chaque versement, chaque correction. Les {WORDS[n] || n} membres voient exactement ces lignes.
        </p>
        <dl className="m-0 mt-[22px] grid grid-cols-3 border-t border-on-night/28">
          {[['Lignes', total], ['Cycles', cycles.length], ['Corrigées', fixes]].map(([k, v], i) => (
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
