'use client';
import Link from 'next/link';
import { fcfa } from '@/lib/money';
import type { PublicPayment } from '@/lib/payments/status';
import { useCountdown } from '@/hooks/usePayment';
import { Button } from './ui/Button';
import { ArrowRight, Picture, delay } from './ui/Kit';
import type { PayContext } from './PaySheet';

const NAME: Record<string, string> = { WAVE: 'Wave', ORANGE: 'Orange Money', CASH: 'le gestionnaire', MOOV: 'Moov Money', CARD: 'la banque', SANDBOX: 'l’opérateur de démo' };

const REASON: Record<string, string> = {
  declined_by_provider: 'L’opérateur a refusé le paiement. Rien n’a été débité.',
  provider_unreachable: 'L’opérateur ne répond pas. Rien n’a été débité — réessayez dans un instant.',
  cancelled_by_member: 'Vous avez annulé. Rien n’a été débité.',
  cash_refused_by_admin: 'Le gestionnaire n’a pas reçu ces espèces. Rien n’est inscrit au registre.',
  no_confirmation: 'Aucune confirmation reçue à temps. Si votre compte a été débité, la somme sera comptée ou rendue automatiquement.',
  cash_not_validated: 'Le gestionnaire n’a pas validé ce dépôt avant la limite. Reparlez-en avec lui.',
  amount_mismatch: 'Le montant reçu ne correspond pas à votre part. Le gestionnaire va régulariser — vous n’avez rien à faire.',
  share_already_paid: 'Votre part était déjà payée. Ce second paiement vous sera rendu ; il ne compte pas deux fois.',
};

function Success({ p, ctx, onDone }: { p: PublicPayment; ctx?: PayContext; onDone?: () => void }) {
  const after = ctx ? Math.min(ctx.size, ctx.paid + 1) : null;
  const note = !ctx
    ? `${fcfa(p.amount)} FCFA, vérifiés auprès de ${NAME[p.provider] ?? p.provider}. Comptés une seule fois, quoi qu’il arrive.`
    : ctx.missing.length === 0
      ? `Le pot est complet. ${ctx.beneficiary} va recevoir ${fcfa(ctx.total)} FCFA.`
      : ctx.missing.length === 1
        ? `Il ne manque plus que ${ctx.missing[0]}. ${ctx.beneficiary} recevra ${fcfa(ctx.total)} FCFA dès que le pot sera complet.`
        : `Il manque encore ${ctx.missing.length} parts. ${ctx.beneficiary} recevra ${fcfa(ctx.total)} FCFA dès que le pot sera complet.`;
  const cta = 'flex min-h-[58px] w-full items-center justify-between bg-accent px-[22px] text-[11px] font-bold uppercase tracking-[.2em] text-white no-underline transition-colors hover:bg-accent-strong';

  return (
    <section role="status" aria-live="polite" className="relative overflow-hidden bg-night px-[22px] py-[30px] text-on-night">
      <div className="a-press relative mx-auto size-[236px] [mask-image:radial-gradient(120%_108%_at_50%_44%,#000_42%,rgba(0,0,0,.75)_62%,rgba(0,0,0,.28)_82%,transparent_96%)]">
        <div aria-hidden className="collage-shadow absolute left-[15px] top-[11px]"><Picture name="sealed-envelope" alt="" width={228} /></div>
        <div className="absolute left-1 top-0 drop-shadow-[0_20px_24px_rgba(0,0,0,.45)]"><Picture name="sealed-envelope" alt="Une enveloppe scellée passe d’une main à l’autre" width={228} /></div>
      </div>
      <p className="a-fade relative m-0 mt-[18px] text-[9.5px] font-bold uppercase tracking-[.28em] text-accent-soft" style={delay(0.2)}>Ligne inscrite au registre</p>
      <h2 className="a-clip relative m-0 mt-3 font-serif text-[36px] font-normal leading-[.98]" style={delay(0.28)}>Votre part est<br />dans le pot.</h2>
      <dl className="a-up-sm relative m-0 mt-[22px] grid grid-cols-2 border-t border-on-night/28" style={delay(0.42)}>
        <div className="border-r border-on-night/28 py-3.5 pr-3.5">
          <dt className="text-[9px] font-bold uppercase tracking-[.18em] text-on-night-muted">Déposé</dt>
          <dd className="m-0 mt-1.5 whitespace-nowrap font-serif text-[26px]">{fcfa(p.amount)}</dd>
        </div>
        <div className="py-3.5 pl-3.5">
          <dt className="text-[9px] font-bold uppercase tracking-[.18em] text-on-night-muted">{ctx ? 'Le pot' : 'Vérifié par'}</dt>
          <dd className="m-0 mt-1.5 whitespace-nowrap font-serif text-[26px]">{ctx ? `${after} / ${ctx.size}` : p.provider === 'SANDBOX' ? 'Démo' : NAME[p.provider]}</dd>
        </div>
      </dl>
      <p className="a-fade relative m-0 mb-[22px] mt-4 text-[13px] font-medium leading-normal text-on-night-muted" style={delay(0.5)}>{note}</p>
      {onDone ? (
        <button type="button" onClick={onDone} className={cta}>Voir le cercle <ArrowRight /></button>
      ) : (
        <Link href="/tontines" className={cta}>Voir mes tontines <ArrowRight /></Link>
      )}
    </section>
  );
}

export function PaymentStatusPanel({ p, busy, onCheck, onCancel, onRetry, ctx, onDone }: {
  p: PublicPayment; busy: boolean; onCheck: () => void; onCancel: () => void; onRetry: () => void; ctx?: PayContext; onDone?: () => void;
}) {
  const { left, label } = useCountdown(p.expiresAt);
  if (p.status === 'CONFIRMED') return <Success p={p} ctx={ctx} onDone={onDone} />;

  const who = NAME[p.provider] ?? p.provider;
  const isCash = p.provider === 'CASH';

  const view = (() => {
    switch (p.status) {
      case 'INITIATED':
      case 'PENDING':
        return {
          eyebrow: isCash ? 'Espèces déclarées' : `En attente de ${who}`,
          title: isCash ? 'Le gestionnaire va valider' : left > 0 ? 'Validez sur votre téléphone' : 'Dernière vérification',
          body: isCash
            ? `Remettez ${fcfa(p.amount)} FCFA au gestionnaire. Votre part sera comptée dès qu’il l’aura validée.`
            : left > 0
              ? `Confirmez le paiement dans ${who}. Sans réponse dans ${label}, il sera annulé et rien ne sera débité.`
              : `Le délai est passé. Nous demandons une dernière fois à ${who} ce qu’il en est.`,
          mark: <span className="block size-10 animate-spin rounded-full border-2 border-dashed border-ink [animation-duration:4s]" />,
          actions: isCash ? null : (
            <div className="flex flex-col gap-2">
              <Button variant="ink" onClick={onCheck} disabled={busy}>J’ai validé, vérifier</Button>
              <Button variant="line" arrow={false} onClick={onCancel} disabled={busy}>Annuler ce paiement</Button>
            </div>
          ),
          timer: !isCash && left > 0,
        };
      case 'FAILED':
        return {
          eyebrow: 'Paiement refusé',
          title: 'Rien n’a été débité',
          body: REASON[p.failureReason ?? ''] ?? REASON.declined_by_provider,
          mark: <span className="relative block size-10 border-2 border-ink before:absolute before:left-1/2 before:top-1/2 before:h-[2px] before:w-[130%] before:-translate-x-1/2 before:-translate-y-1/2 before:rotate-45 before:bg-ink" />,
          actions: <Button onClick={onRetry}>Réessayer</Button>,
        };
      case 'EXPIRED':
        return {
          eyebrow: 'Délai dépassé',
          title: 'Paiement annulé',
          body: REASON[p.failureReason ?? 'no_confirmation'],
          mark: <span className="block size-10 rounded-full border-2 border-ink [clip-path:polygon(0_0,100%_0,100%_50%,0_50%)]" />,
          actions: <Button onClick={onRetry}>Payer à nouveau</Button>,
        };
      default:
        return {
          eyebrow: 'À régulariser',
          title: 'On s’en occupe',
          body: REASON[p.failureReason ?? ''] ?? 'Ce paiement demande une vérification. Le gestionnaire est prévenu.',
          mark: <span className="block size-10 rotate-45 bg-warn" />,
          actions: null,
        };
    }
  })();

  return (
    <section key={p.status} role="status" aria-live="polite" className="a-up-sm flex flex-col gap-5">
      <div className="flex items-start justify-between gap-4 border-t-[1.5px] border-ink pt-4">
        <div className="flex flex-col gap-2.5">
          <p className="m-0 text-[9.5px] font-bold uppercase tracking-[.26em] text-accent-text">{view.eyebrow}</p>
          <h2 className="m-0 font-serif text-[32px] font-normal leading-none">{view.title}</h2>
        </div>
        {view.mark}
      </div>
      {'timer' in view && view.timer && (
        <p className="m-0 font-serif text-[56px] leading-none tabular-nums" aria-label={`Temps restant ${label}`}>{label}</p>
      )}
      <p className="m-0 text-[14px] font-medium leading-relaxed text-muted">{view.body}</p>
      {view.actions}
    </section>
  );
}
