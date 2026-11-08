'use client';
import { motion } from 'motion/react';
import type { ReactNode } from 'react';

export const Eyebrow = ({ children, tone = 'accent' }: { children: ReactNode; tone?: 'accent' | 'muted' }) => (
  <p className={`m-0 text-[10px] font-bold uppercase tracking-[.3em] ${tone === 'accent' ? 'text-accent-text' : 'text-muted'}`}>{children}</p>
);

export const Rule = ({ delay = 0, strong = false }: { delay?: number; strong?: boolean }) => (
  <motion.span
    aria-hidden
    className={`block origin-left ${strong ? 'h-[1.5px] bg-ink' : 'h-px bg-line'}`}
    initial={{ scaleX: 0 }}
    animate={{ scaleX: 1 }}
    transition={{ duration: 0.9, delay, ease: [0.16, 1, 0.3, 1] }}
  />
);

export const Title = ({ children, className = '' }: { children: ReactNode; className?: string }) => (
  <motion.h1
    className={`m-0 font-serif text-[44px] leading-[.98] tracking-[-.025em] uppercase ${className}`}
    initial={{ clipPath: 'inset(0 0 100% 0)' }}
    animate={{ clipPath: 'inset(0 0 0% 0)' }}
    transition={{ duration: 1, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
  >
    {children}
  </motion.h1>
);

export const Amount = ({ value, size = 'lg', unit = true }: { value: string; size?: 'md' | 'lg' | 'xl'; unit?: boolean }) => (
  <span className="inline-flex items-baseline gap-1.5">
    <span className={`font-serif tabular-nums tracking-[-.02em] ${{ md: 'text-[26px]', lg: 'text-[40px]', xl: 'text-[64px] leading-none' }[size]}`}>{value}</span>
    {unit && <span className="text-[10px] font-bold uppercase tracking-[.2em] text-muted">FCFA</span>}
  </span>
);

/** Status is always shape + word, never color alone. */
export function StatusMark({ kind }: { kind: 'paid' | 'pending' | 'late' | 'due' | 'receives' }) {
  const map = {
    paid: { label: 'Payé', shape: <span className="block size-2.5 rounded-full bg-ink" /> },
    pending: { label: 'En vérification', shape: <span className="block size-2.5 rounded-full border-[1.5px] border-dashed border-ink animate-spin [animation-duration:3s]" /> },
    late: { label: 'En retard', shape: <span className="block size-2.5 rotate-45 bg-warn" /> },
    due: { label: 'Attendu', shape: <span className="block size-2.5 rounded-full border-[1.5px] border-ink" /> },
    receives: { label: 'Reçoit', shape: <span className="block size-2.5 bg-accent" /> },
  }[kind];
  return (
    <span className="inline-flex items-center gap-2 text-[10px] font-bold uppercase tracking-[.18em]">
      {map.shape}
      {map.label}
    </span>
  );
}
