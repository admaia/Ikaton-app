'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';

const TABS = [
  { href: '/home', label: 'Accueil' },
  { href: '/tontines', label: 'Tontines' },
  { href: '/profile', label: 'Profil' },
];

export function BottomNav() {
  const path = usePathname();
  return (
    <nav className="fixed inset-x-0 bottom-0 z-30 mx-auto flex max-w-[440px] border-t border-line bg-paper/95 backdrop-blur" aria-label="Navigation principale">
      {TABS.map((t) => {
        const on = path.startsWith(t.href);
        return (
          <Link key={t.href} href={t.href} aria-current={on ? 'page' : undefined} className={`flex min-h-16 flex-1 flex-col items-center justify-center gap-1.5 text-[10px] font-bold uppercase tracking-[.18em] no-underline ${on ? 'text-ink' : 'text-muted'}`}>
            <span className={`block size-1.5 rounded-full ${on ? 'bg-accent' : 'bg-transparent'}`} />
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}

export function ThemeToggle() {
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
      {dark ? 'Mode clair' : 'Mode sombre'}
    </button>
  );
}
