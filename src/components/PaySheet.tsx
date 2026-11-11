'use client';
import { useEffect, useState } from 'react';
import { fcfa } from '@/lib/money';
import { usePayment, type Method } from '@/hooks/usePayment';
import { PaymentStatusPanel } from './PaymentStatusPanel';
import { ArrowRight, Close } from './ui/Kit';

export type PayContext = { circle: string; cycle: number; beneficiary: string; admin: string; size: number; paid: number; total: number; missing: string[] };

const DEMO = process.env.NEXT_PUBLIC_DEMO_MODE === 'true';

const ERR: Record<string, string> = {
  already_paid: 'Votre part de ce cycle est déjà au registre.',
  cycle_closed: 'Ce cycle est clôturé.',
  cash_refused: 'Ce cercle n’accepte pas les espèces.',
  provider_unavailable: 'Ce moyen n’est pas encore disponible.',
  network: 'Connexion perdue. Votre paiement n’a pas été doublé — réessayez.',
};

export function PaySheet({ cycleId, amount, acceptsCash, ctx, onClose }: { cycleId: string; amount: number; acceptsCash: boolean; ctx: PayContext; onClose: () => void }) {
  const { payment, error, busy, start, check, cancel, retry } = usePayment(cycleId);
  const cashBy = ctx.admin ? `À confirmer par ${ctx.admin}, gestionnaire` : 'Vous la validez vous-même, comme gestionnaire';
  const methods: { id: Method; label: string; meta: string }[] = [
    ...(DEMO
      ? [{ id: 'SANDBOX' as const, label: 'Mobile Money', meta: 'Opérateur de démo — vous décidez de sa réponse' }]
      : [
          { id: 'WAVE' as const, label: 'Wave', meta: 'Confirmation dans l’app Wave' },
          { id: 'ORANGE' as const, label: 'Orange Money', meta: 'Confirmation par code Orange' },
        ]),
    ...(acceptsCash ? [{ id: 'CASH' as const, label: 'Espèces', meta: cashBy }] : []),
  ];
  const [method, setMethod] = useState<Method>(methods[0].id);
  const [recap, setRecap] = useState(false);
  const chosen = methods.find((m) => m.id === method)!;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    addEventListener('keydown', onKey);
    return () => removeEventListener('keydown', onKey);
  }, [onClose]);

  const closeBtn = (night: boolean) => (
    <button type="button" aria-label="Fermer" onClick={onClose} className={`flex size-11 items-center justify-center border ${night ? 'border-on-night/35 text-on-night hover:bg-on-night/10' : 'border-ink text-ink hover:bg-ink/5'}`}>
      <Close />
    </button>
  );

  let body: React.ReactNode;
  if (payment?.status === 'CONFIRMED') {
    body = <PaymentStatusPanel p={payment} busy={busy} onCheck={check} onCancel={cancel} onRetry={retry} ctx={ctx} onDone={onClose} />;
  } else if (payment) {
    body = (
      <div className="px-[22px] pb-[30px] pt-[26px]">
        <div className="mb-5 flex items-center justify-between gap-3">
          <p className="m-0 text-[9.5px] font-bold uppercase tracking-[.26em]">{ctx.circle} — Cycle {ctx.cycle}</p>
          {closeBtn(false)}
        </div>
        <PaymentStatusPanel p={payment} busy={busy} onCheck={check} onCancel={cancel} onRetry={() => { retry(); setRecap(false); }} />
      </div>
    );
  } else if (recap) {
    const rows: [string, string][] = [
      ['Cercle', `${ctx.circle} — Cycle ${ctx.cycle}`],
      ['Bénéficiaire', ctx.beneficiary],
      ['Moyen', DEMO && method === 'SANDBOX' ? 'Mobile Money · démo' : chosen.label],
      ['Frais', '0 FCFA'],
    ];
    body = (
      <div className="px-[22px] pb-[30px] pt-[26px]">
        <div className="flex items-center justify-between gap-3">
          <p className="m-0 text-[9.5px] font-bold uppercase tracking-[.26em]">Vérification</p>
          {closeBtn(false)}
        </div>
        <h2 className="m-0 mb-5 mt-3.5 font-serif text-[32px] font-normal leading-none">On récapitule</h2>
        <dl className="m-0">
          {rows.map(([k, v], i) => (
            <div key={k} className={`flex items-baseline justify-between gap-3 py-[13px] ${i ? 'border-t border-dotted border-line-strong' : 'border-t-[1.5px] border-ink'}`}>
              <dt className="text-[10px] font-semibold uppercase tracking-[.16em] text-muted">{k}</dt>
              <dd className="m-0 text-right font-serif text-[17px]">{v}</dd>
            </div>
          ))}
          <div className="flex items-end justify-between gap-3 border-t-[1.5px] border-ink pt-4">
            <dt className="pb-1.5 text-[10px] font-bold uppercase tracking-[.2em]">Total</dt>
            <dd className="m-0 whitespace-nowrap font-serif text-[44px] leading-[.85] tabular-nums">{fcfa(amount)}</dd>
          </div>
        </dl>
        <p className="m-0 mt-[18px] text-[12.5px] font-medium leading-normal text-muted">
          {method === 'CASH'
            ? 'Remettez l’argent en main propre : la ligne sera inscrite au registre dès que le gestionnaire l’aura validée.'
            : `Votre part rejoint le pot du cycle. Les ${ctx.size} membres verront la ligne dans le registre.`}
        </p>
        {error && <p role="alert" className="m-0 mt-4 bg-warn-bg px-4 py-3 text-[13px] font-semibold text-warn">{ERR[error] ?? ERR.network}</p>}
        <div className="mt-5 flex gap-2.5">
          <button type="button" onClick={() => setRecap(false)} className="min-h-[58px] w-24 border border-ink text-[10px] font-bold uppercase tracking-[.16em] transition-colors hover:bg-ink/5">Retour</button>
          <button type="button" disabled={busy} onClick={() => start(method)} className="min-h-[58px] flex-1 bg-accent text-[11px] font-bold uppercase tracking-[.16em] text-white transition-colors hover:bg-accent-strong disabled:opacity-50">
            {busy ? 'Un instant…' : method === 'CASH' ? `Déclarer ${fcfa(amount)}` : `Confirmer ${fcfa(amount)}`}
          </button>
        </div>
      </div>
    );
  } else {
    body = (
      <>
        <div className="bg-night px-[22px] pb-[22px] pt-[26px] text-on-night">
          <div className="flex items-center justify-between gap-3">
            <p className="m-0 text-[9.5px] font-bold uppercase tracking-[.26em] text-on-night-muted">{ctx.circle} — Cycle {ctx.cycle}</p>
            {closeBtn(true)}
          </div>
          <h2 className="m-0 mt-4 font-serif text-[32px] font-normal leading-none">Déposer ma part</h2>
          <div className="mt-4 flex items-end gap-2.5 border-t border-on-night/25 pt-4">
            <span className="whitespace-nowrap font-serif text-[50px] leading-[.85] text-accent tabular-nums">{fcfa(amount)}</span>
            <span className="min-w-0 flex-1 pb-1.5 text-[10px] font-bold uppercase tracking-[.2em] text-on-night-muted">FCFA — montant du cercle</span>
          </div>
        </div>
        <div className="px-[22px] pb-[30px] pt-6">
          <p id="pay-how" className="m-0 mb-3.5 text-[9.5px] font-bold uppercase tracking-[.26em]">Comment payez-vous ?</p>
          <div role="radiogroup" aria-labelledby="pay-how">
            {methods.map((m, i) => (
              <button
                key={m.id}
                type="button"
                role="radio"
                aria-checked={method === m.id}
                onClick={() => setMethod(m.id)}
                className={`flex min-h-16 w-full items-center gap-3.5 border-t py-[18px] text-left last:border-b last:border-b-line-strong ${i === 0 ? 'border-ink' : 'border-line-strong'}`}
              >
                <span className="flex size-5 shrink-0 items-center justify-center rounded-full border-[1.5px] border-ink">
                  <span className={`block size-2.5 rounded-full transition-colors ${method === m.id ? 'bg-accent' : 'bg-transparent'}`} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block font-serif text-[20px] leading-[1.1]">{m.label}</span>
                  <span className="mt-[5px] block text-[10px] font-semibold uppercase tracking-[.14em] text-muted">{m.meta}</span>
                </span>
              </button>
            ))}
          </div>
          <button type="button" onClick={() => setRecap(true)} className="mt-6 flex min-h-[58px] w-full items-center justify-between bg-accent px-[22px] text-[11px] font-bold uppercase tracking-[.2em] text-white transition-colors hover:bg-accent-strong">
            Continuer <ArrowRight />
          </button>
        </div>
      </>
    );
  }

  return (
    <div className="fixed inset-0 z-50 mx-auto max-w-[440px]">
      <button type="button" aria-label="Fermer" onClick={onClose} className="a-fade absolute inset-0 bg-[rgba(14,16,15,.6)] [animation-duration:.3s]" />
      <div role="dialog" aria-modal="true" aria-label="Déposer ma part" className="a-sheet absolute inset-x-0 bottom-0 max-h-[97%] overflow-y-auto bg-paper">
        <div className="grain" />
        <div className="relative">{body}</div>
      </div>
    </div>
  );
}
