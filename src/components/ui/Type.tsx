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
