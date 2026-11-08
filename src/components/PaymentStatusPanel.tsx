'use client';
import { AnimatePresence, motion } from 'motion/react';
import { fcfa } from '@/lib/money';
import type { PublicPayment } from '@/lib/payments/status';
import { useCountdown } from '@/hooks/usePayment';
import { Button } from './ui/Button';
import { Eyebrow } from './ui/Type';

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

export function PaymentStatusPanel({ p, busy, onCheck, onCancel, onRetry }: {
  p: PublicPayment; busy: boolean; onCheck: () => void; onCancel: () => void; onRetry: () => void;
}) {
  const { left, label } = useCountdown(p.expiresAt);
  const who = NAME[p.provider] ?? p.provider;
  const isCash = p.provider === 'CASH';

  const view = (() => {
    switch (p.status) {
      case 'INITIATED':
      case 'PENDING':
        return {
          eyebrow: isCash ? 'Espèces déclarées' : `En attente de ${who}`,
          title: isCash ? 'À valider' : left > 0 ? 'Validez sur votre téléphone' : 'Dernière vérification',
          body: isCash
            ? `Remettez ${fcfa(p.amount)} FCFA au gestionnaire. Votre part sera comptée dès qu’il l’aura validée.`
            : left > 0
              ? `Confirmez le paiement dans ${who}. Sans réponse dans ${label}, il sera annulé et rien ne sera débité.`
              : `Le délai est passé. Nous demandons une dernière fois à ${who} ce qu’il en est.`,
          mark: <span className="block size-10 rounded-full border-2 border-dashed border-ink animate-spin [animation-duration:4s]" />,
          actions: isCash ? null : (
            <div className="flex flex-col gap-2">
              <Button variant="ink" onClick={onCheck} disabled={busy}>J’ai validé, vérifier</Button>
              <Button variant="line" arrow={false} onClick={onCancel} disabled={busy}>Annuler ce paiement</Button>
            </div>
          ),
          showTimer: !isCash && left > 0,
        };
      case 'CONFIRMED':
        return {
          eyebrow: 'Part reçue',
          title: 'Inscrite au registre',
          body: `${fcfa(p.amount)} FCFA, vérifiés auprès de ${who}. Comptés une seule fois, quoi qu’il arrive.`,
          mark: <span className="block size-10 rounded-full bg-ink" />,
          actions: null,
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
      case 'NEEDS_REVIEW':
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
    <AnimatePresence mode="wait">
      <motion.section
        key={p.status}
        role="status"
        aria-live="polite"
        className="flex flex-col gap-5"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -6 }}
        transition={{ duration: 0.4 }}
      >
        <div className="flex items-start justify-between gap-4">
          <div className="flex flex-col gap-2">
            <Eyebrow>{view.eyebrow}</Eyebrow>
            <h2 className="m-0 font-serif text-[32px] leading-none uppercase tracking-[-.02em]">{view.title}</h2>
          </div>
          {view.mark}
        </div>
        {view.showTimer && (
          <p className="m-0 font-serif text-[56px] leading-none tabular-nums" aria-label={`Temps restant ${label}`}>{label}</p>
        )}
        <p className="m-0 text-[15px] font-medium leading-relaxed">{view.body}</p>
        {view.actions}
      </motion.section>
    </AnimatePresence>
  );
}
