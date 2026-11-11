'use client';
import { useState } from 'react';
import { fcfa, initials } from '@/lib/money';
import { delay } from '@/components/ui/Kit';
import type { ShareStatus } from '@/lib/data';

type Member = { id: string; name: string; turn: number | null; isMe: boolean; status: ShareStatus | null; method: string | null };

const R = 128;
const BOX = 304;
const DOT = 46;
const DASH = 654;

const LINE: Record<ShareStatus, (m: Member) => string> = {
  paid: (m) => `Part déposée${m.method ? ` — ${m.method}` : ''}`,
  pending: (m) => `${m.method === 'Espèces' ? 'Espèces déclarées' : 'Paiement'} — en vérification`,
  late: () => 'Part en retard',
  due: () => 'Part attendue avant l’échéance',
};
const TAG: Record<ShareStatus, [string, string]> = {
  paid: ['Payé', 'bg-accent text-white'],
  pending: ['Attente', 'border border-on-night/35 text-on-night'],
  late: ['Retard', 'bg-warn text-white'],
  due: ['À payer', 'border border-on-night/35 text-on-night'],
};

export function Ring({ members, paid, size, amount, beneficiaryId }: { members: Member[]; paid: number; size: number; amount: number; beneficiaryId: string }) {
  const [sel, setSel] = useState(beneficiaryId);
  const total = size * amount;
  const picked = members.find((m) => m.id === sel) ?? members[0];
  const crowd = members.length > 12;
  const me = members.findIndex((m) => m.isMe);

  const at = (i: number) => {
    const a = (i / members.length) * Math.PI * 2;
    return { left: BOX / 2 + R * Math.sin(a) - DOT / 2, top: BOX / 2 - R * Math.cos(a) - DOT / 2 };
  };

  return (
    <>
      <div className="relative mx-auto mt-[26px] size-[304px]">
        <svg viewBox="0 0 304 304" aria-hidden className="absolute inset-0 size-full -rotate-90">
          <circle cx="152" cy="152" r={R} fill="none" stroke="rgba(249,247,244,.34)" strokeWidth="2" />
          <circle cx="152" cy="152" r="104" fill="none" stroke="rgba(249,247,244,.1)" strokeWidth="9" />
          <circle
            cx="152" cy="152" r="104" fill="none" stroke="#C95B30" strokeWidth="9" strokeDasharray={DASH}
            strokeDashoffset={DASH * (1 - paid / size)}
            className="[animation:draw_1.7s_var(--ease)_.3s_both]"
          />
        </svg>
        <div className="a-clip-r absolute inset-0 flex flex-col items-center justify-center text-center" style={delay(0.6)}>
          <p className="m-0 text-[9px] font-bold uppercase tracking-[.28em] text-on-night-muted">Le pot du cycle</p>
          <p className="m-0 mt-2 whitespace-nowrap font-serif text-[54px] leading-[.85] tracking-[-.02em] text-on-night tabular-nums">{fcfa(paid * amount)}</p>
          <p className="m-0 mt-2 text-[9.5px] font-bold uppercase tracking-[.18em] text-on-night-muted">sur {fcfa(total)} FCFA</p>
          <span aria-hidden className="my-3 block h-px w-[34px] bg-on-night/35" />
          <p className="m-0 text-[10.5px] font-bold uppercase tracking-[.16em] text-accent-soft">{paid} sur {size} ont cotisé</p>
        </div>
        {!crowd && members.map((m, i) => {
          const isBen = m.id === beneficiaryId;
          const done = m.status === 'paid';
          const look = isBen
            ? 'bg-forest text-white border-2 border-night'
            : done
              ? 'bg-accent text-white border-2 border-night'
              : 'bg-night text-on-night border-2 border-dashed border-on-night';
          return (
            <button
              key={m.id}
              type="button"
              aria-pressed={sel === m.id}
              aria-label={`${m.name}${m.isMe ? ' (vous)' : ''}, tour ${m.turn ?? '—'}`}
              onClick={() => setSel(m.id)}
              className={`a-pop absolute flex size-[46px] items-center justify-center rounded-full p-0 text-[13px] font-bold transition-[box-shadow,transform] hover:scale-105 ${look} ${sel === m.id ? 'shadow-[0_0_0_4px_rgba(249,247,244,.9)]' : ''}`}
              style={{ ...at(i), ...delay(0.7 + i * 0.07) }}
            >
              {initials(m.name)}
            </button>
          );
        })}
        {!crowd && me >= 0 && (
          <span className="a-fade pointer-events-none absolute bg-on-night px-[9px] py-1 text-[8.5px] font-bold uppercase tracking-[.16em] text-night" style={{ left: at(me).left - 3, top: at(me).top + DOT + 2, ...delay(1.05) }}>
            Vous
          </span>
        )}
      </div>

      <div className="a-fade relative mx-5 mt-11 border-t border-on-night/24 pt-4" style={delay(1.25)} aria-live="polite">
        <div className="flex min-h-14 items-start justify-between gap-3.5">
          <div className="min-w-0">
            <p className="m-0 text-[9px] font-bold uppercase tracking-[.24em] text-on-night-muted">
              Tour {picked.turn ?? '—'}{picked.id === beneficiaryId ? ' — reçoit ce cycle' : ''}
            </p>
            <p className="m-0 mt-[7px] font-serif text-[26px] leading-none text-on-night">{picked.name}{picked.isMe ? ' — vous' : ''}</p>
            <p className="m-0 mt-2 text-[11.5px] font-semibold tracking-[.1em] text-on-night-muted">
              {picked.id === beneficiaryId ? `${fcfa(total)} FCFA dès le pot complet` : picked.status ? LINE[picked.status](picked) : ''}
            </p>
          </div>
          {picked.id === beneficiaryId ? (
            <span className="bg-forest px-2.5 py-1.5 text-[9px] font-bold uppercase tracking-[.16em] text-white">Reçoit</span>
          ) : picked.status && (
            <span className={`px-2.5 py-1.5 text-[9px] font-bold uppercase tracking-[.16em] ${TAG[picked.status][1]}`}>{TAG[picked.status][0]}</span>
          )}
        </div>
        {!crowd && <p className="m-0 mt-3.5 text-[9px] font-semibold uppercase tracking-[.2em] text-on-night-faint">Touchez un membre du cercle</p>}
      </div>
    </>
  );
}
