'use client';
import { useState, useTransition } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { fcfa, initials } from '@/lib/money';
import { daysLeft, longDate, relativeDay } from '@/lib/dates';
import { PaySheet, type PayContext } from '@/components/PaySheet';
import { ArrowRight, Close, SectionHead } from '@/components/ui/Kit';
import type { ShareStatus } from '@/lib/data';

type Props = {
  cycleId: string;
  amount: number;
  acceptsCash: boolean;
  myStatus: ShareStatus;
  dueAt: string;
  pendingCash: { id: string; name: string; amount: number; createdAt: string }[];
  autoOpen: boolean;
  ctx: PayContext;
};

const RESULT: Record<string, string> = {
  confirmed: 'Validé · inscrit au registre',
  duplicate: 'Déjà validé',
  needs_review: 'Part déjà payée — à rembourser',
};

export function CircleActions({ cycleId, amount, acceptsCash, myStatus, dueAt, pendingCash, autoOpen, ctx }: Props) {
  const [open, setOpen] = useState(autoOpen && myStatus !== 'paid');
  const router = useRouter();
  const path = usePathname();
  const [pending, start] = useTransition();
  const [done, setDone] = useState<Record<string, string>>({});
  const due = new Date(dueAt);
  const left = daysLeft(due);

  const close = () => {
    setOpen(false);
    router.replace(path, { scroll: false });
    router.refresh();
  };

  const validate = (id: string, action: 'confirm' | 'refuse') =>
    start(async () => {
      const res = await fetch(`/api/cash/${id}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action }) });
      const { result } = await res.json();
      setDone((d) => ({ ...d, [id]: RESULT[result] ?? 'Refusé · rien n’est inscrit' }));
      router.refresh();
    });

  const box = {
    due: { mark: 'border-[1.5px] border-ink', head: 'Votre part n’est pas arrivée', body: `À déposer avant le ${longDate(due)}. Il reste ${left} jour${left > 1 ? 's' : ''} — aucun jour ne vous est imposé.`, cta: 'Déposer ma part' },
    late: { mark: 'rotate-45 rounded-none bg-warn', head: 'Votre part est en retard', body: `L’échéance était le ${longDate(due)}. Déposez-la dès que possible : le bénéficiaire attend le pot complet.`, cta: 'Déposer ma part' },
    pending: { mark: 'border-[1.5px] border-dashed border-ink animate-spin [animation-duration:4s]', head: 'Votre paiement est en vérification', body: 'Il sera compté dès que l’opérateur ou le gestionnaire l’aura confirmé. Rien n’est compté deux fois.', cta: 'Suivre mon paiement' },
    paid: { mark: 'bg-accent', head: 'Votre part est au registre', body: `Déposée pour le cycle ${ctx.cycle}. Rien d’autre à faire avant le prochain cycle.`, cta: null },
  }[myStatus];

  return (
    <>
      <section className="a-up-sm border-[1.5px] border-ink p-5" aria-label="Ma part">
        <div className="flex items-center gap-2.5">
          <span aria-hidden className={`block size-3 shrink-0 rounded-full ${box.mark}`} />
          <p className="m-0 text-[9.5px] font-bold uppercase tracking-[.22em]">{box.head}</p>
        </div>
        <div className="mt-4 flex items-end gap-2.5">
          <span className="whitespace-nowrap font-serif text-[46px] leading-[.85] tabular-nums">{fcfa(amount)}</span>
          <span className="min-w-0 flex-1 pb-[5px] text-[10px] font-bold uppercase tracking-[.2em] text-muted">FCFA</span>
        </div>
        <p className={`m-0 mt-3.5 text-[13px] font-medium leading-normal text-muted ${box.cta ? 'mb-[18px]' : ''}`}>{box.body}</p>
        {box.cta && (
          <button type="button" onClick={() => setOpen(true)} className="flex min-h-14 w-full items-center justify-between bg-ink px-5 text-[11px] font-bold uppercase tracking-[.2em] text-paper transition-colors hover:bg-accent hover:text-white">
            {box.cta} <ArrowRight />
          </button>
        )}
      </section>

      {pendingCash.length > 0 && (
        <section className="mt-[34px]" aria-label="Espèces à valider">
          <SectionHead title="Espèces à valider" aside={`${pendingCash.length} en attente`} />
          <p className="m-0 mt-3.5 text-[12.5px] font-medium leading-normal text-muted">
            Ces membres déclarent avoir remis l’argent en main propre. Votre validation inscrit la ligne au registre — elle ne pourra plus être retirée.
          </p>
          <ul className="m-0 mt-3 flex list-none flex-col gap-2 p-0">
            {pendingCash.map((c) => (
              <li key={c.id} className="flex min-h-16 items-center gap-3 border border-ink p-3">
                <span className="flex size-[34px] shrink-0 items-center justify-center bg-sand text-[11px] font-bold">{initials(c.name)}</span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[14px] font-bold">{c.name}</span>
                  <span className="mt-0.5 block text-[9.5px] font-semibold uppercase tracking-[.12em] text-muted">
                    {done[c.id] ?? `Espèces déclarées · ${relativeDay(new Date(c.createdAt)).toLowerCase()} · ${fcfa(c.amount)}`}
                  </span>
                </span>
                {!done[c.id] && (
                  <>
                    <button type="button" aria-label={`Refuser le dépôt de ${c.name}`} disabled={pending} onClick={() => validate(c.id, 'refuse')} className="flex size-11 items-center justify-center border border-ink transition-colors hover:bg-ink/5 disabled:opacity-40">
                      <Close />
                    </button>
                    <button type="button" disabled={pending} onClick={() => validate(c.id, 'confirm')} className="min-h-11 bg-ink px-3.5 text-[9.5px] font-bold uppercase tracking-[.16em] text-paper transition-colors hover:bg-accent hover:text-white disabled:opacity-40">
                      Valider
                    </button>
                  </>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      {open && <PaySheet cycleId={cycleId} amount={amount} acceptsCash={acceptsCash} ctx={ctx} onClose={close} />}
    </>
  );
}
