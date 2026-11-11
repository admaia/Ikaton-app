'use client';
import { useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import { motion } from 'motion/react';
import { showcase, type Lang } from '@/config/showcase';
import { saveLang, useLang } from '@/i18n/client';

export function DesktopShell({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  const [shell, setShell] = useState<boolean | null>(null);

  useEffect(() => {
    const mq = matchMedia('(min-width: 1024px)');
    const decide = () => {
      const on = mq.matches && window.self === window.top && !matchMedia('(display-mode: standalone)').matches;
      document.documentElement.dataset.shell = on ? 'showcase' : 'app';
      setShell(on);
    };
    decide();
    mq.addEventListener('change', decide);
    return () => mq.removeEventListener('change', decide);
  }, []);

  useEffect(() => {
    if (window.self !== window.top) window.parent.postMessage({ type: 'ikaton:path', path: location.pathname + location.search }, location.origin);
  }, [path]);

  if (shell) return <Showcase />;
  return (
    <div data-app-root className="relative mx-auto min-h-dvh max-w-[440px]">
      {children}
    </div>
  );
}

function Showcase() {
  const frame = useRef<HTMLIFrameElement>(null);
  const [src] = useState(() => (location.pathname === '/' ? '/onboarding' : location.pathname + location.search));
  const [dark, setDark] = useState(false);
  const [lang, setLang] = useState<Lang>(useLang());
  const t = showcase[lang];

  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);

  useEffect(() => {
    setDark(document.documentElement.classList.contains('dark'));
    const onMsg = (e: MessageEvent) => {
      if (e.origin !== location.origin) return;
      if (e.data?.type === 'ikaton:path') history.replaceState(null, '', e.data.path);
      if (e.data?.type === 'ikaton:lang') setLang(e.data.lang === 'fr' ? 'fr' : 'en');
    };
    addEventListener('message', onMsg);
    return () => removeEventListener('message', onMsg);
  }, []);

  const flip = () => {
    const next = !dark;
    localStorage.setItem('ikaton-theme', next ? 'dark' : 'light');
    document.documentElement.classList.toggle('dark', next);
    frame.current?.contentDocument?.documentElement.classList.toggle('dark', next);
    setDark(next);
  };

  const switchLang = () => {
    const next = lang === 'en' ? 'fr' : 'en';
    saveLang(next);
    setLang(next);
    frame.current?.contentWindow?.location.reload();
  };

  return (
    <div className="relative grid min-h-dvh grid-cols-[minmax(0,1fr)_auto] items-center gap-16 overflow-hidden bg-sand px-[max(48px,6vw)] py-12">
      <div className="grain" />
      <motion.section
        className="relative z-10 flex max-w-[520px] flex-col gap-8"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
      >
        <img src="/assets/ikaton-logo-mark.png" alt="" className="h-9 w-auto self-start dark:invert" />
        <div className="flex flex-col gap-4">
          <p className="m-0 text-[10px] font-bold uppercase tracking-[.3em] text-accent-text">{t.role} · {t.author}</p>
          <h1 className="m-0 font-serif text-[clamp(56px,6vw,96px)] uppercase leading-[.92] tracking-[-.03em]">
            Ikàton
          </h1>
          <p className="m-0 max-w-[460px] text-[18px] font-semibold leading-snug">{t.pitch}</p>
        </div>

        <ol className="m-0 flex list-none flex-col p-0">
          {t.points.map((p, i) => (
            <li key={p.title} className="grid grid-cols-[36px_minmax(0,1fr)] gap-x-3 border-t border-ink/15 py-4 last:border-b">
              <span className="font-serif text-[20px] text-accent-text">{String(i + 1).padStart(2, '0')}</span>
              <span className="flex flex-col gap-1">
                <span className="text-[14px] font-bold">{p.title}</span>
                <span className="text-[13px] font-medium leading-relaxed text-muted">{p.body}</span>
              </span>
            </li>
          ))}
        </ol>

        <p className="m-0 text-[11px] font-bold uppercase tracking-[.16em] text-muted">{t.stack.join(' · ')}</p>

        <div className="flex flex-wrap items-center gap-3">
          <a href={t.caseStudy} target="_blank" rel="noreferrer" className="flex min-h-11 items-center bg-ink px-4 text-[10px] font-bold uppercase tracking-[.18em] text-paper no-underline hover:bg-accent">
            {t.caseStudyLabel}
          </a>
          <a href={t.source} target="_blank" rel="noreferrer" className="flex min-h-11 items-center border border-ink px-4 text-[10px] font-bold uppercase tracking-[.18em] text-ink no-underline hover:bg-ink hover:text-paper">
            {t.sourceLabel}
          </a>
          <button type="button" onClick={flip} aria-pressed={dark} className="flex min-h-11 items-center gap-2 px-2 text-[10px] font-bold uppercase tracking-[.18em]">
            <span className="block size-2.5 rounded-full border-[1.5px] border-ink bg-[linear-gradient(90deg,var(--ink)_50%,transparent_50%)]" />
            {dark ? t.light : t.dark}
          </button>
          <button type="button" onClick={switchLang} lang={lang === 'en' ? 'fr' : 'en'} className="flex min-h-11 items-center px-2 text-[10px] font-bold uppercase tracking-[.18em]">
            {t.switchLang}
          </button>
        </div>
      </motion.section>

      <motion.div
        className="relative z-10 justify-self-center"
        initial={{ opacity: 0, y: 40, rotate: 1.5 }}
        animate={{ opacity: 1, y: 0, rotate: 0 }}
        transition={{ duration: 1.2, delay: 0.15, ease: [0.16, 1, 0.3, 1] }}
      >
        <div className="rounded-[56px] bg-[#0E100F] p-2.5 shadow-[0_50px_100px_-30px_rgba(22,25,24,.55),0_0_0_1px_rgba(22,25,24,.7)]" style={{ height: 'min(864px, calc(100dvh - 96px))', aspectRatio: '390 / 844' }}>
          <iframe ref={frame} src={src} title={t.frameTitle} className="block size-full rounded-[46px] border-0 bg-paper" allow="clipboard-write" />
        </div>
        <p className="m-0 mt-4 text-center text-[10px] font-bold uppercase tracking-[.2em] text-muted">{t.caption}</p>
      </motion.div>
    </div>
  );
}
