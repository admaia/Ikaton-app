'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useT } from '@/i18n/client';

export function BottomNav() {
  const path = usePathname();
  const t = useT();
  const tabs = [
    { href: '/home', label: t.nav.home },
    { href: '/tontines', label: t.nav.circles },
    { href: '/profile', label: t.nav.profile },
  ];
  return (
    <nav className="fixed inset-x-0 bottom-0 z-30 mx-auto flex max-w-[440px] bg-night px-1.5 pb-[max(18px,env(safe-area-inset-bottom))]" aria-label={t.nav.label}>
      {tabs.map((tab) => {
        const on = path.startsWith(tab.href);
        return (
          <Link key={tab.href} href={tab.href} aria-current={on ? 'page' : undefined} className={`flex min-h-[62px] flex-1 flex-col items-center justify-end gap-2 pt-3 text-[9px] font-bold uppercase tracking-[.18em] no-underline transition-colors hover:text-on-night ${on ? 'text-on-night' : 'text-on-night-faint'}`}>
            <span className={`block size-1.5 rounded-full ${on ? 'bg-accent' : 'bg-transparent'}`} />
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}

export function ThemeToggle() {
  const t = useT();
  const [dark, setDark] = useState(false);
  useEffect(() => setDark(document.documentElement.classList.contains('dark')), []);
  const flip = () => {
    const next = !dark;
    document.documentElement.classList.toggle('dark', next);
    localStorage.setItem('ikaton-theme', next ? 'dark' : 'light');
    setDark(next);
  };
  return (
    <button type="button" onClick={flip} className="flex min-h-11 items-center gap-2 border border-ink px-3.5 text-[10px] font-bold uppercase tracking-[.18em]" aria-pressed={dark}>
      <span className="block size-2.5 rounded-full border-[1.5px] border-ink bg-[linear-gradient(90deg,var(--ink)_50%,transparent_50%)]" />
      {dark ? t.theme.light : t.theme.dark}
    </button>
  );
}
