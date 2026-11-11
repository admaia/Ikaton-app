'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { DEMO, DemoButton } from '@/components/DemoButton';
import { ArrowRight, Collage, Picture, delay, type Art } from '@/components/ui/Kit';
import { useT } from '@/i18n/client';

const ART: { art: Art; width: number; top: number; light?: boolean; list?: boolean }[] = [
  { art: 'four-hands-basket', width: 392, top: 288 },
  { art: 'calendar-mark', width: 376, top: 268, light: true },
  { art: 'phone-basket', width: 230, top: 236, list: true },
];

const FADE_DARK = 'linear-gradient(var(--night) 0%, rgba(22,25,24,.94) 26%, rgba(22,25,24,.12) 40%, rgba(22,25,24,0) 56%, rgba(22,25,24,.2) 66%, rgba(22,25,24,.88) 76%, var(--night) 86%)';
const FADE_LIGHT = 'linear-gradient(#f1ece5 0%, rgba(241,236,229,.94) 26%, rgba(241,236,229,.1) 40%, rgba(241,236,229,0) 56%, rgba(241,236,229,.18) 66%, rgba(241,236,229,.9) 77%, #f1ece5 87%)';
const MASK = 'linear-gradient(transparent 0%, rgba(0,0,0,.45) 11%, #000 28%, #000 62%, rgba(0,0,0,.4) 86%, transparent 100%)';

export default function Onboarding() {
  const t = useT();
  const [i, setI] = useState(-1);

  useEffect(() => {
    const timer = setTimeout(() => setI((v) => (v < 0 ? 0 : v)), 1600);
    return () => clearTimeout(timer);
  }, []);

  if (i < 0) {
    return (
      <button type="button" aria-label={t.onboarding.enter} onClick={() => setI(0)} className="relative flex min-h-dvh w-full items-center justify-center overflow-hidden bg-accent">
        <div className="a-fade" style={delay(0.15)}>
          <Picture name="ikaton-logo-full" alt="Ikàton" width={132} priority className="brightness-0 invert" />
        </div>
        <div className="grain" />
      </button>
    );
  }

  const a = ART[i];
  const s = t.onboarding.slides[i];
  const last = i === ART.length - 1;
  const fg = a.light ? 'text-[#161918]' : 'text-on-night';
  const skip = `flex min-h-11 items-center border px-3.5 text-[10px] font-bold uppercase tracking-[.18em] transition-colors ${a.light ? 'border-[#161918] text-[#161918] hover:bg-[#161918]/10' : 'border-on-night/40 text-on-night hover:bg-on-night/10'}`;

  return (
    <main key={i} className={`relative flex min-h-dvh flex-col overflow-hidden ${a.light ? 'bg-[#f1ece5]' : 'bg-night'}`}>
      <Collage
        name={a.art}
        alt={s.alt}
        width={a.width}
        glow={!a.light}
        priority
        mask={MASK}
        className={`left-1/2 ${a.light ? '[&_img]:mix-blend-multiply [&_.collage-shadow]:hidden' : ''}`}
        style={{ top: `min(${a.top}px, 34dvh)`, marginLeft: -a.width / 2 }}
      />
      <div aria-hidden className="absolute inset-0" style={{ background: a.light ? FADE_LIGHT : FADE_DARK }} />
      <div className="grain" />

      <header className="a-fade relative z-10 mx-[26px] mt-[72px] flex min-h-11 items-center justify-between gap-3">
        <Picture name="ikaton-logo-mark" alt="Ikàton" width={50} className={a.light ? '' : 'brightness-0 invert'} />
        {!(DEMO && last) && (
          DEMO ? (
            <button type="button" onClick={() => setI(ART.length - 1)} className={skip}>{t.onboarding.skip}</button>
          ) : (
            <Link href="/auth" className={`${skip} no-underline`}>{t.onboarding.skip}</Link>
          )
        )}
      </header>

      <div className="relative z-10 mx-[26px] mt-14">
        <p className={`a-up-sm m-0 text-[10px] font-bold uppercase tracking-[.3em] ${a.light ? 'text-[#a8481f]' : 'text-accent-soft'}`} style={delay(0.2)}>{s.n}</p>
        <h1 className={`a-clip m-0 mt-3 font-serif text-[46px] font-normal leading-[.98] tracking-[-.025em] ${fg}`} style={delay(0.3)}>
          {s.a}<br />{s.b}<br /><em className="text-accent">{s.em}</em>
        </h1>
      </div>

      <div aria-hidden className="min-h-[120px] flex-1" />

      <div className={`relative z-10 px-[26px] pb-[52px] ${a.light ? '' : 'bg-[linear-gradient(transparent,var(--night)_44px)] pt-11'}`}>
        {a.list ? (
          <ul className="a-up-sm m-0 list-none p-0" style={delay(0.42)}>
            {t.onboarding.methods.map(([name, meta], k) => (
              <li key={name} className="flex items-baseline gap-3 border-t border-on-night/28 py-[11px] last:border-b">
                <span className="w-[22px] font-serif text-[15px] text-accent-soft">{String(k + 1).padStart(2, '0')}</span>
                <span className="flex-1 text-[14.5px] font-bold text-on-night">{name}</span>
                <span className="text-[9px] font-bold uppercase tracking-[.16em] text-on-night-muted">{meta}</span>
              </li>
            ))}
          </ul>
        ) : (
          <span aria-hidden className={`a-rule block h-px ${a.light ? 'h-[1.5px] bg-[#161918]' : 'bg-on-night/28'}`} style={delay(0.4)} />
        )}
        <p className={`a-up-sm m-0 mb-5 max-w-[300px] font-semibold ${a.list ? 'mt-4 text-[15px] leading-[1.45]' : 'mt-[18px] text-[17px] leading-[1.42]'} ${fg}`} style={delay(0.5)}>
          {s.body}
        </p>
        {last ? (
          DEMO ? (
            <DemoButton />
          ) : (
            <Link href="/auth" className="flex min-h-14 w-full items-center justify-between bg-accent px-5 text-[11px] font-bold uppercase tracking-[.22em] text-white no-underline transition-colors hover:bg-accent-strong">
              {t.onboarding.enter} <ArrowRight />
            </Link>
          )
        ) : (
          <button type="button" onClick={() => setI(i + 1)} className={`flex min-h-14 w-full items-center justify-between px-5 text-[11px] font-bold uppercase tracking-[.22em] transition-colors ${a.light ? 'bg-[#161918] text-on-night hover:bg-accent' : 'bg-accent text-white hover:bg-accent-strong'}`}>
            {t.onboarding.next} <ArrowRight />
          </button>
        )}
      </div>

      <div aria-hidden className="absolute inset-x-[26px] bottom-6 z-10 flex gap-1.5">
        {ART.map((_, k) => (
          <span key={k} className={`block h-[3px] flex-1 ${k === i ? 'bg-accent' : a.light ? 'bg-[#161918]/20' : 'bg-on-night/28'}`} />
        ))}
      </div>
    </main>
  );
}
