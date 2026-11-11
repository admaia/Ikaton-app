'use client';
import { useRef } from 'react';
import gsap from 'gsap';
import { useGSAP } from '@gsap/react';
import { initials } from '@/lib/money';

gsap.registerPlugin(useGSAP);

export function OrderReveal({ rows, you }: { rows: { id: string; turn: number; name: string; isMe: boolean }[]; you: string }) {
  const ref = useRef<HTMLOListElement>(null);
  useGSAP(() => {
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const tl = gsap.timeline({ defaults: { ease: 'expo.out' } });
    tl.from('[data-row]', { y: 18, opacity: 0, duration: 0.7, stagger: 0.06 })
      .from('[data-num]', { scale: 1.5, rotate: -8, opacity: 0, duration: 0.5, stagger: 0.06 }, 0.15)
      .to('[data-me]', { backgroundColor: 'var(--sand)', duration: 0.4 }, '>-0.1');
  }, { scope: ref });

  return (
    <ol ref={ref} className="m-0 flex list-none flex-col p-0">
      {rows.map((r) => (
        <li key={r.id} data-row {...(r.isMe ? { 'data-me': '' } : {})} className="-mx-3 flex min-h-16 items-center gap-4 border-t border-line px-3 last:border-b">
          <span data-num className={`w-8 font-serif text-[24px] tabular-nums ${r.isMe ? 'text-accent-text' : ''}`}>{String(r.turn).padStart(2, '0')}</span>
          <span className={`flex size-9 items-center justify-center rounded-full text-[11px] font-bold ${r.isMe ? 'bg-accent text-white' : 'bg-sand'}`}>{initials(r.name)}</span>
          <span className="flex-1 text-[15px] font-semibold">{r.name}{r.isMe ? ` — ${you}` : ''}</span>
        </li>
      ))}
    </ol>
  );
}
