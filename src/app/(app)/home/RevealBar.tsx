'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';

export function RevealBar({ label, amount, href }: { label: string; amount: string; href: string }) {
  const [shown, setShown] = useState(false);

  useEffect(() => {
    const onScroll = () => setShown(window.scrollY > 260);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <div
      aria-hidden={!shown}
      className={`fixed inset-x-0 top-0 z-30 mx-auto flex h-[58px] max-w-[440px] items-center gap-3 bg-night pl-5 pr-3 transition-[opacity,transform] duration-300 ease-[cubic-bezier(.16,1,.3,1)] ${shown ? 'translate-y-0 opacity-100' : 'pointer-events-none -translate-y-3.5 opacity-0'}`}
    >
      <span className="min-w-0 flex-1">
        <span className="block text-[8.5px] font-bold uppercase tracking-[.2em] text-on-night-muted">{label}</span>
        <span className="mt-[3px] block font-serif text-[21px] leading-none text-on-night">{amount}</span>
      </span>
      <Link href={href} tabIndex={shown ? 0 : -1} className="flex min-h-11 items-center bg-accent px-[15px] text-[9.5px] font-bold uppercase tracking-[.16em] text-white no-underline hover:bg-accent-strong">
        Déposer
      </Link>
    </div>
  );
}
