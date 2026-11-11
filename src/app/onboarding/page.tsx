'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { DEMO, DemoButton } from '@/components/DemoButton';
import { ArrowRight, Collage, Picture, delay, type Art } from '@/components/ui/Kit';

type Slide = { n: string; title: React.ReactNode; body?: string; art: Art; alt: string; width: number; top: number; light?: boolean; list?: boolean };

const SLIDES: Slide[] = [
  {
    n: '1 — La pratique',
    title: <>Le cercle<br />que vous<br /><em className="text-accent">connaissez déjà.</em></>,
    body: 'Chacun cotise, chacun reçoit son tour — Ikàton tient le carnet.',
    art: 'four-hands-basket', alt: 'Quatre mains déposent des billets dans un panier tressé', width: 392, top: 288,
  },
  {
    n: '2 — La règle',
    title: <>Payez avant<br />la date. <em className="text-accent">Pas à<br />une date.</em></>,
    body: 'Aucun jour n’est imposé. Le cycle a une seule échéance — tant que votre part arrive avant, tout va bien.',
    art: 'calendar-mark', alt: 'Une main coche des cases sur un calendrier posé sur des billets', width: 376, top: 268, light: true,
  },
  {
    n: '3 — Le paiement',
    title: <>Payez comme<br />vous payez<br /><em className="text-accent">déjà.</em></>,
    art: 'phone-basket', alt: 'Une main tend un téléphone au-dessus d’un panier rempli de billets', width: 230, top: 236, list: true,
  },
];

const METHODS = [['Orange Money', 'Instantané'], ['Moov Money', 'Instantané'], ['Espèces', 'Validées par le gestionnaire']];

const FADE_DARK = 'linear-gradient(var(--night) 0%, rgba(22,25,24,.94) 26%, rgba(22,25,24,.12) 40%, rgba(22,25,24,0) 56%, rgba(22,25,24,.2) 66%, rgba(22,25,24,.88) 76%, var(--night) 86%)';
const FADE_LIGHT = 'linear-gradient(#f1ece5 0%, rgba(241,236,229,.94) 26%, rgba(241,236,229,.1) 40%, rgba(241,236,229,0) 56%, rgba(241,236,229,.18) 66%, rgba(241,236,229,.9) 77%, #f1ece5 87%)';
const MASK = 'linear-gradient(transparent 0%, rgba(0,0,0,.45) 11%, #000 28%, #000 62%, rgba(0,0,0,.4) 86%, transparent 100%)';

export default function Onboarding() {
  const [i, setI] = useState(-1);

  useEffect(() => {
    const t = setTimeout(() => setI((v) => (v < 0 ? 0 : v)), 1600);
    return () => clearTimeout(t);
  }, []);

  if (i < 0) {
    return (
      <button type="button" aria-label="Entrer dans Ikàton" onClick={() => setI(0)} className="relative flex min-h-dvh w-full items-center justify-center overflow-hidden bg-accent">
        <div className="a-fade" style={delay(0.15)}>
          <Picture name="ikaton-logo-full" alt="Ikàton" width={132} priority className="brightness-0 invert" />
        </div>
        <div className="grain" />
      </button>
    );
  }

  const s = SLIDES[i];
  const last = i === SLIDES.length - 1;
  const fg = s.light ? 'text-[#161918]' : 'text-on-night';

  return (
    <main key={i} className={`relative min-h-dvh overflow-hidden ${s.light ? 'bg-[#f1ece5]' : 'bg-night'}`}>
      <Collage
        name={s.art}
        alt={s.alt}
        width={s.width}
        glow={!s.light}
        priority
        mask={MASK}
        className={`left-1/2 ${s.light ? '[&_img]:mix-blend-multiply [&_.collage-shadow]:hidden' : ''}`}
        style={{ top: `min(${s.top}px, 34dvh)`, marginLeft: -s.width / 2 }}
      />
      <div aria-hidden className="absolute inset-0" style={{ background: s.light ? FADE_LIGHT : FADE_DARK }} />
      <div className="grain" />

      <header className="a-fade absolute inset-x-[26px] top-[72px] z-10 flex items-center justify-between gap-3">
        <Picture name="ikaton-logo-mark" alt="Ikàton" width={50} className={s.light ? '' : 'brightness-0 invert'} />
        <Link href="/auth" className={`flex min-h-11 items-center border px-3.5 text-[10px] font-bold uppercase tracking-[.18em] no-underline transition-colors ${s.light ? 'border-[#161918] text-[#161918] hover:bg-[#161918]/10' : 'border-on-night/40 text-on-night hover:bg-on-night/10'}`}>
          Passer
        </Link>
      </header>

      <div className="absolute inset-x-[26px] top-[172px] z-10">
        <p className={`a-up-sm m-0 text-[10px] font-bold uppercase tracking-[.3em] ${s.light ? 'text-[#a8481f]' : 'text-accent-soft'}`} style={delay(0.2)}>{s.n}</p>
        <h1 className={`a-clip m-0 mt-3 font-serif text-[46px] font-normal leading-[.98] tracking-[-.025em] ${fg}`} style={delay(0.3)}>{s.title}</h1>
      </div>

      <div className={`absolute inset-x-0 bottom-0 z-10 px-[26px] pb-[52px] ${s.light ? '' : 'bg-[linear-gradient(transparent,var(--night)_44px)] pt-11'}`}>
        {s.list ? (
          <ul className="a-up-sm m-0 list-none p-0" style={delay(0.42)}>
            {METHODS.map(([name, meta], k) => (
              <li key={name} className="flex items-baseline gap-3 border-t border-on-night/28 py-[11px] last:border-b">
                <span className="w-[22px] font-serif text-[15px] text-accent-soft">{String(k + 1).padStart(2, '0')}</span>
                <span className="flex-1 text-[14.5px] font-bold text-on-night">{name}</span>
                <span className="text-[9px] font-bold uppercase tracking-[.16em] text-on-night-muted">{meta}</span>
              </li>
            ))}
          </ul>
        ) : (
          <span aria-hidden className={`a-rule block h-px ${s.light ? 'h-[1.5px] bg-[#161918]' : 'bg-on-night/28'}`} style={delay(0.4)} />
        )}
        <p className={`a-up-sm m-0 mb-5 max-w-[300px] font-semibold ${s.list ? 'mt-4 text-[15px] leading-[1.45]' : 'mt-[18px] text-[17px] leading-[1.42]'} ${fg}`} style={delay(0.5)}>
          {s.list ? 'Vous remettez l’argent en main propre ? Le gestionnaire le valide, et la ligne s’inscrit au registre comme les autres.' : s.body}
        </p>
        {last ? (
          DEMO ? (
            <div className="flex flex-col gap-2">
              <DemoButton />
              <Link href="/auth" className="flex min-h-12 items-center justify-center text-[10px] font-bold uppercase tracking-[.18em] text-on-night-muted no-underline hover:text-on-night">
                Entrer avec mon numéro
              </Link>
            </div>
          ) : (
            <Link href="/auth" className="flex min-h-14 w-full items-center justify-between bg-accent px-5 text-[11px] font-bold uppercase tracking-[.22em] text-white no-underline transition-colors hover:bg-accent-strong">
              Entrer dans Ikàton <ArrowRight />
            </Link>
          )
        ) : (
          <button type="button" onClick={() => setI(i + 1)} className={`flex min-h-14 w-full items-center justify-between px-5 text-[11px] font-bold uppercase tracking-[.22em] transition-colors ${s.light ? 'bg-[#161918] text-on-night hover:bg-accent' : 'bg-accent text-white hover:bg-accent-strong'}`}>
            Continuer <ArrowRight />
          </button>
        )}
      </div>

      <div aria-hidden className="absolute inset-x-[26px] bottom-6 z-10 flex gap-1.5">
        {SLIDES.map((_, k) => (
          <span key={k} className={`block h-[3px] flex-1 ${k === i ? 'bg-accent' : s.light ? 'bg-[#161918]/20' : 'bg-on-night/28'}`} />
        ))}
      </div>
    </main>
  );
}
