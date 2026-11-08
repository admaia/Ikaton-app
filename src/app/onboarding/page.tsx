'use client';
import { useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import Link from 'next/link';
import { Collage } from '@/components/ui/Collage';
import { Button, LinkButton } from '@/components/ui/Button';
import { DEMO, DemoButton } from '@/components/DemoButton';
import { Eyebrow, Rule } from '@/components/ui/Type';

const SLIDES = [
  { n: '1 — La pratique', title: <>Le cercle<br />que vous<br /><em className="text-accent">connaissez déjà.</em></>, body: 'Chacun cotise, chacun reçoit son tour — Ikàton tient le carnet.', img: '/assets/four-hands-basket.png', alt: 'Quatre mains déposent des billets dans un panier tressé' },
  { n: '2 — La règle', title: <>Payez avant<br />la date. <em className="text-accent">Pas à<br />une date.</em></>, body: 'Aucun jour n’est imposé. Le cycle a une seule échéance — tant que votre part arrive avant, tout va bien.', img: '/assets/calendar-mark.png', alt: 'Une main coche des cases sur un calendrier posé sur des billets' },
  { n: '3 — La confiance', title: <>Tout le monde<br />voit <em className="text-accent">le même<br />carnet.</em></>, body: 'Chaque dépôt est vérifié auprès de l’opérateur avant d’être inscrit. Rien n’est compté deux fois.', img: '/assets/circle-hands.png', alt: 'Des mains forment un cercle autour de billets' },
];

export default function Onboarding() {
  const [i, setI] = useState(0);
  const s = SLIDES[i];
  const last = i === SLIDES.length - 1;
  return (
    <main className="relative min-h-dvh overflow-hidden bg-sand">
      <AnimatePresence mode="wait">
        <motion.div key={i} className="absolute inset-0" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.4 }}>
          <div className="absolute left-1/2 top-[33%] -translate-x-1/2">
            <Collage src={s.img} alt={s.alt} width={380} halo={i !== 1} />
          </div>
          <div aria-hidden className="absolute inset-0 bg-[linear-gradient(180deg,var(--sand)_0%,color-mix(in_oklab,var(--sand)_94%,transparent)_26%,transparent_42%,transparent_60%,color-mix(in_oklab,var(--sand)_90%,transparent)_76%,var(--sand)_87%)]" />
          <div className="grain" />
          <div className="absolute inset-x-6 top-[150px] z-10 flex flex-col gap-3">
            <Eyebrow>{s.n}</Eyebrow>
            <h1 className="m-0 font-serif text-[46px] leading-[.98] tracking-[-.025em]">{s.title}</h1>
          </div>
        </motion.div>
      </AnimatePresence>

      <header className="absolute inset-x-6 top-14 z-20 flex items-center justify-between">
        <img src="/assets/ikaton-logo-mark.png" alt="Ikàton" className="h-[30px] w-auto dark:invert" />
        <Link href="/auth" className="flex min-h-11 items-center border border-ink px-3.5 text-[10px] font-bold uppercase tracking-[.18em] text-ink no-underline hover:bg-ink/10">Passer</Link>
      </header>

      <div className="absolute inset-x-6 bottom-12 z-20 flex flex-col gap-5">
        <Rule delay={0.4} />
        <p className="m-0 max-w-[300px] text-[17px] font-semibold leading-snug">{s.body}</p>
        {last ? (
          DEMO ? (
            <div className="flex flex-col gap-2">
              <DemoButton />
              <LinkButton href="/auth" variant="line">Avec mon numéro</LinkButton>
            </div>
          ) : (
            <LinkButton href="/auth">Commencer</LinkButton>
          )
        ) : (
          <Button onClick={() => setI(i + 1)}>Continuer</Button>
        )}
        <div className="flex gap-1.5" aria-hidden>
          {SLIDES.map((_, k) => <span key={k} className={`block h-[3px] flex-1 ${k === i ? 'bg-accent' : 'bg-ink/20'}`} />)}
        </div>
      </div>
    </main>
  );
}
