import Link from 'next/link';
import { requireUser } from '@/lib/auth';
import { getHome } from '@/lib/data';
import { fcfa, shortDate } from '@/lib/money';
import { Collage } from '@/components/ui/Collage';
import { LinkButton } from '@/components/ui/Button';
import { Eyebrow, Title } from '@/components/ui/Type';

export default async function Home() {
  const user = await requireUser();
  const circles = await getHome(user.id);
  const first = user.name.split(' ')[0];

  if (circles.length === 0) {
    return (
      <main className="flex min-h-dvh flex-col gap-6 px-6 pt-24">
        <Eyebrow>Bonjour {first}</Eyebrow>
        <Title>Aucun<br />cercle</Title>
        <div className="mx-auto"><Collage src="/assets/empty-basket.png" alt="Un panier vide" width={300} mask="radial" /></div>
        <p className="m-0 text-[15px] font-medium leading-relaxed">Ouvrez un cercle avec vos proches, ou rejoignez-en un avec le code reçu.</p>
        <div className="flex flex-col gap-2">
          <LinkButton href="/tontines/new">Ouvrir un cercle</LinkButton>
          <LinkButton href="/join" variant="line">J’ai un code</LinkButton>
        </div>
      </main>
    );
  }

  const due = circles.filter((c) => !c.myShareIn && !c.receivesNow && c.dueAt);
  return (
    <main className="flex flex-col gap-10 px-6 pt-24">
      <div className="flex flex-col gap-3">
        <Eyebrow>Bonjour {first}</Eyebrow>
        <Title>{due.length ? <>{due.length} part{due.length > 1 ? 's' : ''}<br />à déposer</> : <>Tout est<br />à jour</>}</Title>
      </div>
      <ul className="m-0 flex list-none flex-col p-0">
        {circles.map((c) => (
          <li key={c.id} className="border-t border-line last:border-b">
            <Link href={`/tontines/${c.id}`} className="flex min-h-24 flex-col gap-2 py-5 text-ink no-underline">
              <span className="flex items-baseline justify-between gap-3">
                <span className="font-serif text-[24px] uppercase leading-none">{c.name}</span>
                <span className="text-[10px] font-bold uppercase tracking-[.18em] text-muted">{c.role === 'ADMIN' ? 'Gestionnaire' : `Tour ${c.turn ?? '—'}`}</span>
              </span>
              <span className="flex items-baseline justify-between gap-3 text-[13px] font-medium text-muted">
                <span>{c.paid} / {c.size} parts · cycle {c.cycleIndex ?? '—'}</span>
                <span className={c.myShareIn ? '' : 'font-bold text-accent-text'}>
                  {c.receivesNow ? 'Vous recevez' : c.myShareIn ? 'Ma part : reçue' : c.dueAt ? `${fcfa(c.amount)} avant le ${shortDate(c.dueAt)}` : ''}
                </span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </main>
  );
}
