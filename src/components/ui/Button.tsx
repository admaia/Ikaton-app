import Link from 'next/link';
import type { ComponentProps, ReactNode } from 'react';

const base =
  'group flex w-full min-h-14 items-center justify-between gap-3 px-5 text-[11px] font-bold uppercase tracking-[.22em] transition-[background,padding] duration-300 hover:pr-3.5 disabled:opacity-40 disabled:pointer-events-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent';
const variants = {
  accent: 'bg-accent text-white hover:bg-accent-strong',
  ink: 'bg-ink text-paper hover:bg-accent hover:text-white',
  line: 'border border-ink text-ink hover:bg-ink/5',
};

export const Arrow = () => (
  <svg width="22" height="9" viewBox="0 0 22 9" fill="none" stroke="currentColor" strokeWidth="1.4" aria-hidden="true">
    <path d="M0 4.5h20M16 1l4 3.5-4 3.5" />
  </svg>
);

type Common = { variant?: keyof typeof variants; children: ReactNode; arrow?: boolean };

export function Button({ variant = 'accent', arrow = true, children, className = '', ...rest }: Common & ComponentProps<'button'>) {
  return (
    <button type="button" className={`${base} ${variants[variant]} ${className}`} {...rest}>
      {children}
      {arrow && <Arrow />}
    </button>
  );
}

export function LinkButton({ variant = 'accent', arrow = true, children, className = '', ...rest }: Common & ComponentProps<typeof Link>) {
  return (
    <Link className={`${base} ${variants[variant]} no-underline ${className}`} {...rest}>
      {children}
      {arrow && <Arrow />}
    </Link>
  );
}
