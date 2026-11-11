'use client';
import { useState, useTransition } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { fcfa, initials } from '@/lib/money';
import { daysLeft, longDate, relativeDay } from '@/lib/dates';
import { PaySheet, type PayContext } from '@/components/PaySheet';
import { ArrowRight, Close, SectionHead } from '@/components/ui/Kit';
import type { ShareStatus } from '@/lib/data';
import { useLang, useT } from '@/i18n/client';

type Props = {
  cycleId: string;
  amount: number;
  acceptsCash: boolean;
  myStatus: ShareStatus;
  dueAt: string;
  pendingCash: { id: string; name: string; amount: number; createdAt: string }[];
  autoOpen: boolean;
  ctx: PayContext;
};

export function CircleActions({ cycleId, amount, acceptsCash, myStatus, dueAt, pendingCash, autoOpen, ctx }: Props) {
  const t = useT();
  const lang = useLang();
  const sh = t.circle.share;
  const cs = t.circle.cash;
  const [open, setOpen] = useState(autoOpen && myStatus !== 'paid');
  const router = useRouter();
  const path = usePathname();
  const [pending, start] = useTransition();
  const [done, setDone] = useState<Record<string, string>>({});
  const due = new Date(dueAt);
  const left = daysLeft(due);

  const close = () => {
    setOpen(false);
    router.replace(path, { scroll: false });
    router.refresh();
  };

  const validate = (id: string, action: 'confirm' | 'refuse') =>
    start(async () => {
      const res = await fetch(`/api/cash/${id}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action }) });
      const { result } = await res.json();
      setDone((d) => ({ ...d, [id]: cs.result[result] ?? cs.result.refused }));
      router.refresh();
    });

  const box = {
    due: { mark: 'border-[1.5px] border-ink', head: sh.dueHead, body: sh.dueBody(longDate(due, lang), left), cta: sh.pay },
    late: { mark: 'rotate-45 rounded-none bg-warn', head: sh.lateHead, body: sh.lateBody(longDate(due, lang)), cta: sh.pay },
    pending: { mark: 'border-[1.5px] border-dashed border-ink animate-spin [animation-duration:4s]', head: sh.pendingHead, body: sh.pendingBody, cta: sh.track },
    paid: { mark: 'bg-accent', head: sh.paidHead, body: sh.paidBody(ctx.cycle), cta: null },
  }[myStatus];

  return (
    <>
      <section className="a-up-sm border-[1.5px] border-ink p-5" aria-label={sh.aria}>
        <div className="flex items-center gap-2.5">
          <span aria-hidden className={`block size-3 shrink-0 rounded-full ${box.mark}`} />
          <p className="m-0 text-[9.5px] font-bold uppercase tracking-[.22em]">{box.head}</p>
        </div>
        <div className="mt-4 flex items-end gap-2.5">
          <span className="whitespace-nowrap font-serif text-[46px] leading-[.85] tabular-nums">{fcfa(amount)}</span>
          <span className="min-w-0 flex-1 pb-[5px] text-[10px] font-bold uppercase tracking-[.2em] text-muted">FCFA</span>
        </div>
        <p className={`m-0 mt-3.5 text-[13px] font-medium leading-normal text-muted ${box.cta ? 'mb-[18px]' : ''}`}>{box.body}</p>
        {box.cta && (
          <button type="button" onClick={() => setOpen(true)} className="flex min-h-14 w-full items-center justify-between bg-ink px-5 text-[11px] font-bold uppercase tracking-[.2em] text-paper transition-colors hover:bg-accent hover:text-white">
            {box.cta} <ArrowRight />
          </button>
        )}
      </section>

      {pendingCash.length > 0 && (
        <section className="mt-[34px]" aria-label={cs.title}>
          <SectionHead title={cs.title} aside={cs.waiting(pendingCash.length)} />
          <p className="m-0 mt-3.5 text-[12.5px] font-medium leading-normal text-muted">
            {cs.note}
          </p>
          <ul className="m-0 mt-3 flex list-none flex-col gap-2 p-0">
            {pendingCash.map((c) => (
              <li key={c.id} className="flex min-h-16 items-center gap-3 border border-ink p-3">
                <span className="flex size-[34px] shrink-0 items-center justify-center bg-sand text-[11px] font-bold">{initials(c.name)}</span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[14px] font-bold">{c.name}</span>
                  <span className="mt-0.5 block text-[9.5px] font-semibold uppercase tracking-[.12em] text-muted">
                    {done[c.id] ?? cs.declared(relativeDay(new Date(c.createdAt), lang).toLowerCase(), fcfa(c.amount))}
                  </span>
                </span>
                {!done[c.id] && (
                  <>
                    <button type="button" aria-label={cs.refuse(c.name)} disabled={pending} onClick={() => validate(c.id, 'refuse')} className="flex size-11 items-center justify-center border border-ink transition-colors hover:bg-ink/5 disabled:opacity-40">
                      <Close />
                    </button>
                    <button type="button" disabled={pending} onClick={() => validate(c.id, 'confirm')} className="min-h-11 bg-ink px-3.5 text-[9.5px] font-bold uppercase tracking-[.16em] text-paper transition-colors hover:bg-accent hover:text-white disabled:opacity-40">
                      {cs.validate}
                    </button>
                  </>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      {open && <PaySheet cycleId={cycleId} amount={amount} acceptsCash={acceptsCash} ctx={ctx} onClose={close} />}
    </>
  );
}
