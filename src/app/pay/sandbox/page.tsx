'use client';
import { Suspense, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Eyebrow } from '@/components/ui/Type';

const ACTIONS = [
  { id: 'approve', label: 'Valider le paiement', meta: 'Le cas normal. La part est comptée.' },
  { id: 'decline', label: 'Refuser', meta: 'Solde insuffisant, code faux…' },
  { id: 'silent', label: 'Ne rien faire', meta: 'Aucune confirmation n’arrive. Le paiement expire au bout de 2 min.' },
  { id: 'double', label: 'Confirmer deux fois', meta: 'L’opérateur renvoie le même message. Comptée une seule fois ?' },
  { id: 'forge', label: 'Envoyer une fausse confirmation', meta: 'Un tiers prétend que vous avez payé, sans la clé secrète.' },
] as const;

const ANSWER: Record<string, string> = {
  confirmed: 'Vérifié auprès de l’opérateur → part comptée',
  duplicate: 'Déjà traité → ignoré, rien n’est compté deux fois',
  failed: 'Refus vérifié → rien n’est compté',
  invalid_signature: 'Signature invalide → rejeté, rien n’est touché',
  ignored: 'Rien à changer',
  needs_review: 'Mis de côté pour régularisation',
};

function Sandbox() {
  const id = useSearchParams().get('p');
  const [res, setRes] = useState<{ log: { label: string; http: number; answer: string }[]; status: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const run = async (action: string) => {
    setBusy(true);
    const r = await fetch(`/api/sandbox/${id}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action }) });
    setRes(await r.json());
    setBusy(false);
  };

  return (
    <main className="flex min-h-dvh flex-col gap-6 bg-ink px-6 pb-10 pt-20 text-paper">
      <div className="flex flex-col gap-3">
        <p className="m-0 text-[10px] font-bold uppercase tracking-[.3em] text-[#E89A72]">Opérateur de démonstration</p>
        <h1 className="m-0 font-serif text-[36px] uppercase leading-none">Vous êtes l’opérateur</h1>
        <p className="m-0 text-[14px] font-medium leading-relaxed opacity-90">Dans la vraie vie, c’est Wave ou Orange Money. Ici, choisissez ce qui arrive, puis regardez comment Ikàton réagit.</p>
      </div>

      {!res ? (
        <ul className="m-0 flex list-none flex-col p-0">
          {ACTIONS.map((a) => (
            <li key={a.id} className="border-t border-paper/25 last:border-b">
              <button type="button" disabled={busy} onClick={() => run(a.id)} className="flex min-h-16 w-full flex-col items-start gap-1 py-3 text-left text-paper hover:text-[#E89A72] disabled:opacity-50">
                <span className="text-[15px] font-bold">{a.label}</span>
                <span className="text-[12px] opacity-80">{a.meta}</span>
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <section className="flex flex-col gap-4" aria-live="polite">
          <Eyebrow tone="muted">Ce que le serveur d’Ikàton a répondu</Eyebrow>
          {res.log.length === 0 && <p className="m-0 text-[14px]">Aucun message envoyé. Ikàton attend, puis annulera le paiement à l’échéance.</p>}
          <ol className="m-0 flex list-none flex-col p-0">
            {res.log.map((l, i) => (
              <li key={i} className="flex flex-col gap-1 border-t border-paper/25 py-3 last:border-b">
                <span className="text-[10px] font-bold uppercase tracking-[.18em] opacity-80">{l.label} · HTTP {l.http}</span>
                <span className="text-[14px] font-semibold">{ANSWER[l.answer] ?? l.answer}</span>
              </li>
            ))}
          </ol>
        </section>
      )}

      <Link href={`/pay/return?p=${id}`} className="mt-auto flex min-h-14 items-center justify-between bg-accent px-5 text-[11px] font-bold uppercase tracking-[.22em] text-white no-underline hover:bg-accent-strong">
        Retour à Ikàton <span aria-hidden>→</span>
      </Link>
    </main>
  );
}

export default function Page() {
  return <Suspense><Sandbox /></Suspense>;
}
