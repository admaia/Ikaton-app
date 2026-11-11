'use client';
import { useState } from 'react';
import Link from 'next/link';
import { fcfa } from '@/lib/money';
import { dayMonth } from '@/lib/dates';
import { ArrowRight } from '@/components/ui/Kit';

type Row = { id: string; kind: string; text: string; meta: string | null; amount: number | null; at: string };
type Group = { key: string; title: string; aside: string; rows: Row[] };

const FILTERS = [
  ['all', 'Tout', () => true],
  ['in', 'Dépôts', (r: Row) => r.kind === 'in'],
  ['out', 'Versements', (r: Row) => r.kind === 'out'],
  ['note', 'Notes', (r: Row) => !['in', 'out'].includes(r.kind)],
] as const;

const BAR: Record<string, string> = { in: 'bg-ink', out: 'bg-accent', late: 'bg-warn', fix: 'bg-forest' };

export function Ledger({ groups, circleId, circleName }: { groups: Group[]; circleId: string; circleName: string }) {
  const [filter, setFilter] = useState<(typeof FILTERS)[number][0]>('all');
  const test = FILTERS.find((f) => f[0] === filter)![2];
  const shown = groups.map((g) => ({ ...g, rows: g.rows.filter(test) })).filter((g) => g.rows.length);

  const download = () => {
    const esc = (v: string) => `"${v.replace(/"/g, '""')}"`;
    const lines = [['Cycle', 'Date', 'Ligne', 'Détail', 'Montant (FCFA)'].join(';')];
    for (const g of groups) for (const r of g.rows) lines.push([esc(g.title), r.at.slice(0, 10), esc(r.text), esc(r.meta ?? ''), r.amount ?? ''].join(';'));
    const url = URL.createObjectURL(new Blob(['﻿' + lines.join('\n')], { type: 'text/csv;charset=utf-8' }));
    const a = Object.assign(document.createElement('a'), { href: url, download: `registre-${circleName.toLowerCase().replace(/\s+/g, '-')}.csv` });
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <>
      <div role="tablist" aria-label="Filtrer le registre" className="sticky top-0 z-20 flex border-b border-line-strong bg-paper">
        {FILTERS.map(([id, label]) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={filter === id}
            onClick={() => setFilter(id)}
            className={`min-h-[50px] flex-1 border-b-2 text-[9px] font-bold uppercase tracking-[.12em] transition-colors ${filter === id ? 'border-ink text-ink' : 'border-transparent text-muted hover:text-ink'}`}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="px-[22px] pb-[34px] pt-1">
        {shown.length === 0 && <p className="m-0 pt-8 text-[13px] font-medium text-muted">Aucune ligne de ce type pour l’instant.</p>}
        {shown.map((g) => (
          <section key={g.key} className="pt-[22px]">
            <div className="flex items-baseline justify-between gap-3 border-b-[1.5px] border-ink pb-2">
              <h2 className="m-0 text-[10px] font-bold uppercase tracking-[.24em]">{g.title}</h2>
              <span className="text-[9.5px] font-bold uppercase tracking-[.14em] text-muted">{g.aside}</span>
            </div>
            <ol className="m-0 list-none p-0">
              {g.rows.map((r) => (
                <li key={r.id} className="flex gap-[13px] border-b border-dotted border-line-strong py-3.5">
                  <span className="w-11 shrink-0 pt-0.5 text-[9px] font-bold uppercase tracking-[.06em] text-muted">{dayMonth(new Date(r.at))}</span>
                  <span aria-hidden className={`my-0.5 w-[3px] shrink-0 ${BAR[r.kind] ?? 'bg-line-strong'}`} />
                  <span className="min-w-0 flex-1">
                    <span className="block text-[13.5px] font-semibold leading-[1.4]">{r.text}</span>
                    {r.meta && <span className="mt-1 block text-[9.5px] font-semibold uppercase tracking-[.12em] text-muted">{r.meta}</span>}
                  </span>
                  {r.amount != null && <span className="whitespace-nowrap pt-px font-serif text-[17px]">{fcfa(r.amount)}</span>}
                </li>
              ))}
            </ol>
          </section>
        ))}

        <div className="mt-6 border border-line bg-sand p-[18px]">
          <p className="m-0 text-[9px] font-bold uppercase tracking-[.2em] text-muted">Pourquoi rien ne s’efface</p>
          <p className="m-0 mb-3.5 mt-2.5 text-[12.5px] font-medium leading-[1.55]">
            Une erreur se corrige par une ligne qui s’ajoute, jamais par une ligne qui disparaît. Le registre garde donc aussi la trace des corrections — c’est ce qui le rend opposable à tous.
          </p>
          <button type="button" onClick={download} className="min-h-[50px] w-full border border-ink text-[10px] font-bold uppercase tracking-[.18em] transition-colors hover:bg-ink hover:text-paper">
            Télécharger le registre
          </button>
        </div>

        <Link href={`/tontines/${circleId}`} className="mt-3.5 flex min-h-[58px] items-center gap-3.5 border border-ink px-4 py-3.5 text-[12.5px] font-bold text-ink no-underline transition-colors hover:bg-ink hover:text-paper">
          <span className="flex-1">Retour au cercle</span>
          <ArrowRight />
        </Link>
      </div>
    </>
  );
}
