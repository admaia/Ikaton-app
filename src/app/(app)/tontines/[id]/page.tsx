import { notFound } from 'next/navigation';
import Link from 'next/link';
import { requireUser } from '@/lib/auth';
import { getCircle } from '@/lib/data';
import { fcfa, initials, shortDate } from '@/lib/money';
import { needsSearch } from '@/lib/tontine';
import { PotGauge } from '@/components/PotGauge';
import { Eyebrow, StatusMark, Title } from '@/components/ui/Type';
import { CircleActions } from './CircleActions';

export default async function CirclePage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const data = await getCircle((await params).id, user.id);
  if (!data) notFound();
  const { circle, cycle, members, me, pendingCash } = data;
  const mine = members.find((m) => m.isMe)!;

  return (
    <main className="flex flex-col gap-10 px-6 pt-24">
      <div className="flex flex-col gap-3">
        <Link href="/home" className="text-[10px] font-bold uppercase tracking-[.2em] no-underline">← Mes cercles</Link>
        <Eyebrow>{me.role === 'ADMIN' ? 'Vous gérez ce cercle' : `Tour ${me.turn ?? '—'}`} · {fcfa(circle.amount)} / part</Eyebrow>
        <Title>{circle.name}</Title>
      </div>

      {cycle && (
        <section className="flex flex-col gap-4" aria-label="Le pot">
          <Eyebrow tone="muted">Cycle {cycle.index} · échéance le {shortDate(cycle.dueAt)} · pour {cycle.beneficiary}</Eyebrow>
          <PotGauge size={circle.size} paid={cycle.paid} pending={cycle.pending} amount={circle.amount} />
        </section>
      )}

      {cycle && (
        <CircleActions
          cycleId={cycle.id}
          amount={circle.amount}
          acceptsCash={circle.acceptsCash}
          myStatus={mine.status}
          pendingCash={pendingCash}
        />
      )}

      <section className="flex flex-col gap-3">
        <div className="flex items-baseline justify-between">
          <Eyebrow tone="muted">{members.length} membres</Eyebrow>
          {circle.sealed && <Link href={`/tontines/${circle.id}/order`} className="text-[10px] font-bold uppercase tracking-[.2em] no-underline">L’ordre scellé →</Link>}
        </div>
        {needsSearch(members.length) && (
          <input type="search" placeholder="Chercher un membre" className="min-h-12 border-0 border-b border-ink bg-transparent text-[15px] outline-none" aria-label="Chercher un membre" />
        )}
        <ul className="m-0 flex list-none flex-col p-0">
          {members.map((m) => (
            <li key={m.id} className={`flex min-h-16 items-center gap-4 border-t border-line py-3 last:border-b ${m.isMe ? 'bg-sand -mx-3 px-3' : ''}`}>
              <span className={`w-6 font-serif text-[18px] tabular-nums ${m.isMe ? 'text-accent-text' : ''}`}>{String(m.turn ?? 0).padStart(2, '0')}</span>
              <span className={`flex size-9 items-center justify-center rounded-full text-[11px] font-bold ${m.isMe ? 'bg-accent text-white' : 'bg-sand'}`}>{initials(m.name)}</span>
              <span className="flex-1 text-[15px] font-semibold">{m.name}{m.isMe ? ' — vous' : ''}</span>
              <StatusMark kind={m.status} />
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
