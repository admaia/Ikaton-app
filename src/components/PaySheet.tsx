'use client';
import { useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { fcfa } from '@/lib/money';
import { usePayment, type Method } from '@/hooks/usePayment';
import { PaymentStatusPanel } from './PaymentStatusPanel';
import { Button } from './ui/Button';
import { Eyebrow } from './ui/Type';

const DEMO = process.env.NEXT_PUBLIC_DEMO_MODE === 'true';
const METHODS: { id: Method; label: string; meta: string }[] = DEMO ? [
  { id: 'SANDBOX', label: 'Opérateur de démo', meta: 'Choisissez vous-même ce qui arrive : validé, refusé, doublon, fraude…' },
  { id: 'CASH', label: 'Espèces', meta: 'À remettre au gestionnaire, qui valide' },
] : [
  { id: 'WAVE', label: 'Wave', meta: 'Confirmation dans l’app Wave' },
  { id: 'ORANGE', label: 'Orange Money', meta: 'Confirmation par code Orange' },
  { id: 'CASH', label: 'Espèces', meta: 'À remettre au gestionnaire, qui valide' },
];

const ERR: Record<string, string> = {
  already_paid: 'Votre part de ce cycle est déjà au registre.',
  cycle_closed: 'Ce cycle est clôturé.',
  cash_refused: 'Ce cercle n’accepte pas les espèces.',
  provider_unavailable: 'Ce moyen n’est pas encore disponible.',
  network: 'Connexion perdue. Votre paiement n’a pas été doublé — réessayez.',
};

export function PaySheet({ cycleId, amount, acceptsCash, onClose }: { cycleId: string; amount: number; acceptsCash: boolean; onClose: () => void }) {
  const { payment, error, busy, start, check, cancel, retry } = usePayment(cycleId);
  const [method, setMethod] = useState<Method>(DEMO ? 'SANDBOX' : 'WAVE');
  const methods = METHODS.filter((m) => acceptsCash || m.id !== 'CASH');

  return (
    <AnimatePresence>
      <motion.div className="fixed inset-0 z-40 bg-black/50" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} />
      <motion.div
        role="dialog"
        aria-modal="true"
        aria-label="Cotiser"
        className="fixed inset-x-0 bottom-0 z-50 mx-auto max-w-[440px] bg-paper px-6 pb-8 pt-6"
        initial={{ y: '101%' }}
        animate={{ y: 0 }}
        exit={{ y: '101%' }}
        transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
      >
        <div className="mb-6 flex items-center justify-between">
          <Eyebrow tone="muted">Ma part · {fcfa(amount)} FCFA</Eyebrow>
          <button type="button" onClick={onClose} className="min-h-11 px-2 text-[10px] font-bold uppercase tracking-[.18em]">Fermer</button>
        </div>

        {payment ? (
          <PaymentStatusPanel p={payment} busy={busy} onCheck={check} onCancel={cancel} onRetry={retry} />
        ) : (
          <div className="flex flex-col gap-6">
            <h2 className="m-0 font-serif text-[32px] uppercase leading-none tracking-[-.02em]">Comment payer ?</h2>
            <ul className="m-0 flex list-none flex-col p-0" role="radiogroup">
              {methods.map((m) => (
                <li key={m.id} className="border-t border-line last:border-b">
                  <button
                    type="button"
                    role="radio"
                    aria-checked={method === m.id}
                    onClick={() => setMethod(m.id)}
                    className="flex min-h-16 w-full items-center justify-between gap-4 text-left"
                  >
                    <span className="flex flex-col">
                      <span className="text-[15px] font-bold">{m.label}</span>
                      <span className="text-[12px] text-muted">{m.meta}</span>
                    </span>
                    <span className={`block size-4 rounded-full border-[1.5px] border-ink ${method === m.id ? 'bg-ink' : ''}`} />
                  </button>
                </li>
              ))}
            </ul>
            {error && <p role="alert" className="m-0 bg-warn-bg px-4 py-3 text-[13px] font-semibold text-warn">{ERR[error] ?? ERR.network}</p>}
            <Button onClick={() => start(method)} disabled={busy}>
              {busy ? 'Un instant…' : `Payer ${fcfa(amount)} FCFA`}
            </Button>
          </div>
        )}
      </motion.div>
    </AnimatePresence>
  );
}
