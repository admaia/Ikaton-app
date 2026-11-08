'use client';
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { fcfa } from '@/lib/money';
import { PaySheet } from '@/components/PaySheet';
import { Button } from '@/components/ui/Button';
import { Eyebrow } from '@/components/ui/Type';

type Props = {
  cycleId: string;
  amount: number;
  acceptsCash: boolean;
  myStatus: 'paid' | 'pending' | 'late' | 'due' | 'receives';
  pendingCash: { id: string; name: string; amount: number }[];
};

export function CircleActions({ cycleId, amount, acceptsCash, myStatus, pendingCash }: Props) {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const [pending, start] = useTransition();
  const [done, setDone] = useState<Record<string, string>>({});

  const validate = (id: string, action: 'confirm' | 'refuse') =>
    start(async () => {
      const res = await fetch(`/api/cash/${id}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action }) });
      const { result } = await res.json();
      setDone((d) => ({ ...d, [id]: result === 'confirmed' ? 'Validé · inscrit au registre' : result === 'duplicate' ? 'Déjà validé' : result === 'needs_review' ? 'Part déjà payée — à rembourser' : 'Refusé · rien n’est inscrit' }));
      router.refresh();
    });

  return (
    <>
      {myStatus === 'paid' && <p className="m-0 border-y border-line py-4 text-[14px] font-semibold">Votre part de ce cycle est au registre.</p>}
      {myStatus === 'pending' && <Button variant="ink" onClick={() => setOpen(true)}>Suivre mon paiement</Button>}
      {(myStatus === 'due' || myStatus === 'late') && <Button onClick={() => setOpen(true)}>Déposer ma part · {fcfa(amount)}</Button>}

      {pendingCash.length > 0 && (
        <section className="flex flex-col gap-3" aria-label="Espèces à valider">
          <Eyebrow>{pendingCash.length} dépôt{pendingCash.length > 1 ? 's' : ''} en espèces à valider</Eyebrow>
          {pendingCash.map((c) => (
            <div key={c.id} className="flex flex-col gap-3 border border-ink bg-sand p-4">
              <p className="m-0 text-[15px] font-semibold">{c.name} déclare avoir remis {fcfa(c.amount)} FCFA</p>
              {done[c.id] ? (
                <p className="m-0 text-[13px] font-bold">{done[c.id]}</p>
              ) : (
                <div className="grid grid-cols-2 gap-2">
                  <Button variant="ink" arrow={false} disabled={pending} onClick={() => validate(c.id, 'confirm')}>Reçu</Button>
                  <Button variant="line" arrow={false} disabled={pending} onClick={() => validate(c.id, 'refuse')}>Pas reçu</Button>
                </div>
              )}
            </div>
          ))}
        </section>
      )}

      {open && <PaySheet cycleId={cycleId} amount={amount} acceptsCash={acceptsCash} onClose={() => { setOpen(false); router.refresh(); }} />}
    </>
  );
}
