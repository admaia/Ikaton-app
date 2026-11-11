import Link from 'next/link';
import { requireUser } from '@/lib/auth';
import { getOverview } from '@/lib/data';
import { fcfa, initials } from '@/lib/money';
import { clock, dayMonth, daysLeft, relativeDay, today } from '@/lib/dates';
import { ArrowRight, Collage, Picture, SectionHead, Stats, Tag, delay } from '@/components/ui/Kit';
import { RevealBar } from './RevealBar';

const DOT: Record<string, { mark: string; label: string }> = {
  in: { mark: 'bg-accent', label: 'Payé' },
  out: { mark: 'bg-forest', label: 'Versé' },
  open: { mark: 'bg-forest', label: 'Tour' },
  close: { mark: 'bg-ink', label: 'Clos' },
  late: { mark: 'bg-warn rotate-45 rounded-none', label: 'Relance' },
  note: { mark: 'border-[1.5px] border-ink', label: 'Attente' },
};

const value = 'text-[15px] font-bold tracking-[-.02em]';

export default async function Home() {
  const user = await requireUser();
  const { circles, focus, ledger, payout } = await getOverview(user.id);
  const first = user.name.split(' ')[0];

  const header = (
    <div className="a-fade flex items-center justify-between gap-3 px-[22px]">
      <Picture name="ikaton-logo-full" alt="Ikàton" width={27} priority className="dark:invert" />
      <Link href="/profile" aria-label="Votre profil" className="flex size-11 items-center justify-center border border-ink text-[12px] font-bold tracking-[.04em] text-ink no-underline transition-colors hover:bg-ink hover:text-paper">
        {initials(user.name)}
      </Link>
    </div>
  );

  if (!focus) {
    return (
      <main className="relative min-h-dvh overflow-hidden pt-[60px]">
        <div className="grain" />
        {header}
        <div className="px-[22px] pt-10">
          <p className="m-0 text-[10px] font-bold uppercase tracking-[.26em] text-muted">Bonjour {first}</p>
          <h1 className="a-clip m-0 mt-4 font-serif text-[40px] font-normal leading-[.97] tracking-[-.025em]">Le panier est<br />encore <em className="text-accent">vide.</em></h1>
          <div className="relative mx-auto mt-4 h-[300px] w-[220px]">
            <Collage name="empty-basket" alt="Un panier tressé vide" width={220} glow={false} className="left-0 top-0" />
          </div>
          <p className="m-0 text-[14px] font-medium leading-relaxed text-muted">
            Une tontine se fait à plusieurs : quand quelqu’un vous invite dans son cercle, il apparaît ici.
          </p>
        </div>
      </main>
    );
  }

  const c = focus;
  const cy = c.cycle!;
  const total = c.amount * c.size;
  const left = daysLeft(cy.dueAt);
  const managed = circles.filter((x) => x.role === 'ADMIN');
  const actions = managed.reduce((n, x) => n + x.cashToValidate, 0);
  const owes = c.myStatus === 'due' || c.myStatus === 'late';
  const href = `/tontines/${c.id}`;

  const hero = owes ? (
    <>
      <h1 className="a-clip m-0 mt-[22px] font-serif text-[40px] font-normal leading-[.97] tracking-[-.025em]" style={delay(0.18)}>
        Bonjour {first},<br />{c.myStatus === 'late' ? <>votre part <em className="text-accent">est en retard.</em></> : <>il manque <em className="text-accent">votre part.</em></>}
      </h1>
      <Figure value={fcfa(c.amount)} unit="FCFA" />
      <Stats
        className="a-up-sm mt-[22px]"
        items={[
          { label: 'Échéance', value: <span className={value}>{dayMonth(cy.dueAt)}</span> },
          { label: 'Il reste', value: <span className={value}>{left} jour{left > 1 ? 's' : ''}</span> },
          { label: 'Le pot', value: <span className={value}>{cy.paid} / {c.size}</span> },
        ]}
      />
      <p className="a-fade m-0 mt-4 text-[13px] font-medium leading-normal text-muted" style={delay(0.52)}>Aucun jour ne vous est imposé — déposez votre part quand vous voulez avant l’échéance.</p>
      <Link href={`${href}?pay=1`} className="a-up-sm mt-5 flex min-h-[58px] w-full items-center justify-between bg-accent px-[22px] text-[11.5px] font-bold uppercase tracking-[.2em] text-white no-underline transition-colors hover:bg-accent-strong" style={delay(0.58)}>
        Déposer ma part <ArrowRight />
      </Link>
    </>
  ) : c.myStatus === 'pending' ? (
    <>
      <h1 className="a-clip m-0 mt-[22px] font-serif text-[40px] font-normal leading-[.97] tracking-[-.025em]" style={delay(0.18)}>
        Bonjour {first},<br />votre part <em className="text-accent">est en route.</em>
      </h1>
      <Figure value={fcfa(c.amount)} unit="FCFA — en vérification" />
      <p className="a-fade m-0 mt-4 text-[13px] font-medium leading-normal text-muted" style={delay(0.52)}>Elle sera comptée dès que l’opérateur ou le gestionnaire l’aura confirmée. Rien n’est compté deux fois.</p>
      <Link href={`${href}?pay=1`} className="a-up-sm mt-5 flex min-h-[58px] w-full items-center justify-between bg-ink px-[22px] text-[11.5px] font-bold uppercase tracking-[.2em] text-paper no-underline transition-colors hover:bg-accent hover:text-white" style={delay(0.58)}>
        Suivre mon paiement <ArrowRight />
      </Link>
    </>
  ) : (
    <>
      <h1 className="a-clip m-0 mt-[22px] font-serif text-[40px] font-normal leading-[.97] tracking-[-.025em]" style={delay(0.18)}>
        Votre part est<br /><em className="text-accent">dans le pot.</em>
      </h1>
      <Figure value={fcfa(cy.paid * c.amount)} unit={`FCFA — sur ${fcfa(total)}`} />
      <Stats
        className="a-up-sm mt-[22px]"
        items={[
          { label: 'Le pot', value: <span className={value}>{cy.paid} / {c.size}</span> },
          { label: 'Votre tour', value: <span className={value}>{c.turn ? `Cycle ${c.turn}` : '—'}</span> },
          { label: 'Vous recevrez', value: <span className={value}>{fcfa(total)}</span> },
        ]}
      />
      <Link href={href} className="a-up-sm mt-5 flex min-h-[58px] w-full items-center justify-between bg-ink px-[22px] text-[11.5px] font-bold uppercase tracking-[.2em] text-paper no-underline transition-colors hover:bg-accent hover:text-white" style={delay(0.58)}>
        Voir le cercle <ArrowRight />
      </Link>
    </>
  );

  return (
    <main className="relative overflow-hidden pt-[60px]">
      <div className="grain" />
      {owes && <RevealBar label={`Votre part — avant le ${dayMonth(cy.dueAt)}`} amount={`${fcfa(c.amount)} FCFA`} href={`${href}?pay=1`} />}
      {header}

      <div className="mt-[34px] px-[22px]">
        <div className="a-up-sm flex items-baseline justify-between gap-3" style={delay(0.06)}>
          <p className="m-0 text-[10px] font-bold uppercase tracking-[.26em] text-muted">{today()}</p>
          <p className="m-0 text-[10px] font-bold uppercase tracking-[.26em] text-muted">Cycle {cy.index}</p>
        </div>
        <span aria-hidden className="a-rule mt-[9px] block h-[1.5px] bg-ink" style={delay(0.1)} />
        {hero}
      </div>

      {managed.length > 0 && (
        <Banner href="/tontines" tag={<Tag tone="accent" className="px-2 text-[8.5px]">Gestion</Tag>}>
          {managed.length} cercle{managed.length > 1 ? 's' : ''} que vous gérez{actions ? ` — ${actions} action${actions > 1 ? 's' : ''} en attente` : ''}
        </Banner>
      )}
      {payout && (
        <Banner href={`/tontines/${payout.circleId}/tour`} tag={<Tag tone="forest" className="px-2 text-[8.5px]">Reçu</Tag>} joined={managed.length > 0}>
          {payout.name} vous a rendu {fcfa(payout.total)} FCFA
        </Banner>
      )}

      <Link href={href} className="torn-b group relative mt-[30px] block overflow-hidden bg-accent text-[#161918] no-underline">
        <span aria-hidden className="a-spin-slow absolute -left-[70px] -top-[90px] size-[300px] rounded-full border border-on-night/35" />
        <span aria-hidden className="a-fade absolute -right-[52px] top-1 h-[296px] w-[244px] overflow-hidden [mask-image:linear-gradient(98deg,transparent_0%,rgba(0,0,0,.26)_22%,#000_54%)]" style={delay(0.2)}>
          <span className="absolute -left-3.5 -top-0.5 opacity-30 grayscale brightness-[.35]"><Picture name="circle-hands" alt="" width={292} /></span>
          <span className="absolute -left-6 -top-2.5"><Picture name="circle-hands" alt="" width={292} /></span>
        </span>
        <span className="relative block px-[22px] pb-[46px] pr-[110px] pt-[26px] transition-transform duration-200 group-hover:translate-x-1">
          <span className="inline-block bg-[#161918] px-2.5 py-1.5 text-[9.5px] font-bold uppercase tracking-[.22em] text-on-night">Le cercle en cours</span>
          <span className="mt-3.5 block font-serif text-[34px] leading-[.98] tracking-[-.02em]">{c.name}</span>
          <span className="mt-4 flex items-baseline gap-2">
            <span className="font-serif text-[40px] leading-[.85] text-on-night">{cy.paid}</span>
            <span className="text-[19px] font-extrabold tracking-[-.01em]">/ {c.size} ont cotisé</span>
          </span>
          <span aria-hidden className="mt-3.5 flex max-w-[180px] gap-1">
            {Array.from({ length: Math.min(c.size, 12) }, (_, k) => {
              const filled = Math.round((cy.paid / c.size) * Math.min(c.size, 12));
              return <span key={k} className={`a-bar block h-[26px] flex-1 ${k < filled ? 'bg-[#161918]' : 'bg-[#161918]/22'}`} style={delay(0.3 + k * 0.05)} />;
            })}
          </span>
          <span className="mt-4 inline-flex items-center gap-2 bg-[#161918] px-[11px] py-[7px] text-[10.5px] font-bold uppercase tracking-[.14em] text-on-night">
            <span aria-hidden className="block size-[9px] rounded-full bg-forest-soft" />
            {cy.iReceive ? 'Vous recevez ce cycle' : `${cy.beneficiary} reçoit ce cycle`}
          </span>
        </span>
      </Link>

      {ledger.length > 0 && (
        <section className="px-[22px] pt-[34px]" aria-label="Le registre">
          <SectionHead title="Le registre" aside={<Link href={`${href}/registre`} className="text-muted no-underline hover:text-ink">{ledger.length} dernières lignes →</Link>} />
          <ol className="m-0 list-none p-0">
            {ledger.map((e, k) => {
              const dot = DOT[e.kind] ?? DOT.note;
              return (
                <li key={e.id} className="flex items-baseline gap-4 border-b border-line py-[18px] last:border-b-0">
                  <span className="w-[26px] font-serif text-[17px]">{String(k + 1).padStart(2, '0')}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block font-serif text-[18px] leading-[1.25]">{e.text}</span>
                    <span className="mt-1.5 block text-[11px] font-semibold uppercase tracking-[.1em] text-muted">
                      {relativeDay(e.createdAt)} {clock(e.createdAt)}{e.meta ? ` — ${e.meta.split(' · ')[0]}` : ''}
                    </span>
                  </span>
                  <span aria-hidden className={`block size-[11px] shrink-0 rounded-full ${dot.mark}`} />
                  <span className="text-[9.5px] font-bold uppercase tracking-[.14em]">{dot.label}</span>
                </li>
              );
            })}
          </ol>
        </section>
      )}
    </main>
  );
}

function Figure({ value, unit }: { value: string; unit: string }) {
  return (
    <div className="a-clip-r mt-[26px] flex items-end gap-3" style={delay(0.34)}>
      <span className="whitespace-nowrap font-serif text-[70px] leading-[.82] tracking-[-.03em] tabular-nums">{value}</span>
      <span className="min-w-0 flex-1 pb-2 text-[11px] font-bold uppercase tracking-[.2em] text-muted">{unit}</span>
    </div>
  );
}

function Banner({ href, tag, children, joined = false }: { href: string; tag: React.ReactNode; children: React.ReactNode; joined?: boolean }) {
  return (
    <Link href={href} className={`a-fade flex min-h-[60px] w-full items-center gap-3 border-b border-line-strong px-[22px] py-3.5 text-ink no-underline transition-colors hover:bg-ink/5 ${joined ? '' : 'mt-[22px] border-t'}`} style={delay(0.2)}>
      {tag}
      <span className="min-w-0 flex-1 text-[13px] font-bold tracking-[.01em]">{children}</span>
      <ArrowRight />
    </Link>
  );
}
