import Image from 'next/image';
import Link from 'next/link';
import type { CSSProperties, ReactNode } from 'react';

export const delay = (s: number) => ({ '--d': `${s}s` }) as CSSProperties;

export const ArrowRight = () => (
  <svg width="22" height="9" viewBox="0 0 22 9" fill="none" stroke="currentColor" strokeWidth="1.4" aria-hidden="true">
    <path d="M0 4.5h20M16 1l4 3.5-4 3.5" />
  </svg>
);

export const Close = () => (
  <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
    <path d="M1 1l12 12M13 1L1 13" />
  </svg>
);

export function BackLink({ href, label }: { href: string; label: string }) {
  return (
    <Link href={href} aria-label={label} className="flex size-11 items-center justify-center border border-on-night/35 text-on-night transition-colors hover:bg-on-night/10">
      <svg width="20" height="9" viewBox="0 0 20 9" fill="none" stroke="currentColor" strokeWidth="1.4" aria-hidden="true">
        <path d="M20 4.5H2M6 1L2 4.5 6 8" />
      </svg>
    </Link>
  );
}

const TAG = {
  outline: 'border border-muted px-2 py-1 text-[8.5px] text-muted',
  'outline-night': 'border border-on-night/35 px-2.5 py-1.5 text-[9px] text-on-night',
  accent: 'bg-accent px-2 py-1 text-[8.5px] text-white',
  ink: 'bg-ink px-2.5 py-[5px] text-[9px] text-paper',
  night: 'bg-night px-2.5 py-1.5 text-[9.5px] text-on-night',
  forest: 'bg-forest px-2.5 py-[5px] text-[9px] text-white',
  paper: 'bg-on-night px-2 py-1 text-[8.5px] text-night',
};

export function Tag({ tone, children, className = '' }: { tone: keyof typeof TAG; children: ReactNode; className?: string }) {
  return <span className={`inline-block font-bold uppercase tracking-[.14em] ${TAG[tone]} ${className}`}>{children}</span>;
}

export function SectionHead({ title, aside, className = '' }: { title: string; aside?: ReactNode; className?: string }) {
  return (
    <div className={`flex items-baseline justify-between gap-3 border-b-[1.5px] border-ink pb-2.5 ${className}`}>
      <h2 className="m-0 text-[10px] font-bold uppercase tracking-[.26em]">{title}</h2>
      {aside && <span className="text-[10px] font-bold uppercase tracking-[.14em] text-muted">{aside}</span>}
    </div>
  );
}

export function Stats({ items, night = false, className = '' }: { items: { label: string; value: ReactNode }[]; night?: boolean; className?: string }) {
  return (
    <dl className={`m-0 grid ${night ? 'border-t border-on-night/28' : 'border-t-[1.5px] border-ink'} ${className}`} style={{ gridTemplateColumns: `repeat(${items.length}, minmax(0, 1fr))` }}>
      {items.map((it, i) => (
        <div key={it.label} className={`py-3.5 ${i ? 'pl-3.5' : ''} ${i < items.length - 1 ? (night ? 'border-r border-on-night/28' : 'border-r border-line-strong') : ''}`}>
          <dt className={`text-[9px] font-bold uppercase tracking-[.18em] ${night ? 'text-on-night-muted' : 'text-muted'}`}>{it.label}</dt>
          <dd className="m-0 mt-1.5">{it.value}</dd>
        </div>
      ))}
    </dl>
  );
}

const ART = {
  'four-hands-basket': [456, 443],
  'calendar-mark': [403, 388],
  'phone-basket': [402, 492],
  'pot-received': [912, 1044],
  'phone-flatlay': [657, 1061],
  'ikaton-logo-full': [410, 395],
  'ikaton-logo-mark': [361, 217],
  'empty-basket': [456, 623],
  'circle-hands': [375, 384],
  'sealed-envelope': [456, 451],
  'drawn-lots': [942, 1055],
  'envelope-hands': [441, 486],
} as const;
export type Art = keyof typeof ART;

export function Picture({ name, alt, width, className = '', priority = false }: { name: Art; alt: string; width: number; className?: string; priority?: boolean }) {
  const [w, h] = ART[name];
  return <Image src={`/assets/${name}.png`} alt={alt} width={w} height={h} sizes={`${width}px`} priority={priority} className={`block h-auto ${className}`} style={{ width }} />;
}

export function Collage({ name, alt, width, className = '', mask, glow = true, style, priority = false }: {
  name: Art; alt: string; width: number; className?: string; mask?: string; glow?: boolean; style?: CSSProperties; priority?: boolean;
}) {
  return (
    <div className={`a-press pointer-events-none absolute ${className}`} style={{ width, WebkitMaskImage: mask, maskImage: mask, ...style }}>
      {glow && <div aria-hidden className="absolute inset-[6%] rounded-full bg-[radial-gradient(circle,rgba(201,91,48,.5)_0%,rgba(201,91,48,0)_64%)]" />}
      <div aria-hidden className="collage-shadow absolute left-2.5 top-2"><Picture name={name} alt="" width={width} priority={priority} /></div>
      <div className="relative"><Picture name={name} alt={alt} width={width} priority={priority} /></div>
    </div>
  );
}
