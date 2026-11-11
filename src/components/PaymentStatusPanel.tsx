'use client';
import Link from 'next/link';
import { fcfa } from '@/lib/money';
import type { PublicPayment } from '@/lib/payments/status';
import { useCountdown } from '@/hooks/usePayment';
import { useT } from '@/i18n/client';
import { Button } from './ui/Button';
import { ArrowRight, Picture, delay } from './ui/Kit';
import type { PayContext } from './PaySheet';

function Success({ p, ctx, onDone }: { p: PublicPayment; ctx?: PayContext; onDone?: () => void }) {
  const st = useT().status;
  const after = ctx ? Math.min(ctx.size, ctx.paid + 1) : null;
  const note = !ctx
    ? st.generic(fcfa(p.amount), st.who[p.provider] ?? p.provider)
    : ctx.missing.length === 0
      ? st.complete(ctx.beneficiary, fcfa(ctx.total))
      : ctx.missing.length === 1
        ? st.oneLeft(ctx.missing[0], ctx.beneficiary, fcfa(ctx.total))
        : st.someLeft(ctx.missing.length, ctx.beneficiary, fcfa(ctx.total));
  const cta = 'flex min-h-[58px] w-full items-center justify-between bg-accent px-[22px] text-[11px] font-bold uppercase tracking-[.2em] text-white no-underline transition-colors hover:bg-accent-strong';

  return (
    <section role="status" aria-live="polite" className="relative overflow-hidden bg-night px-[22px] py-[30px] text-on-night">
      <div className="a-press relative mx-auto size-[236px] [mask-image:radial-gradient(120%_108%_at_50%_44%,#000_42%,rgba(0,0,0,.75)_62%,rgba(0,0,0,.28)_82%,transparent_96%)]">
        <div aria-hidden className="collage-shadow absolute left-[15px] top-[11px]"><Picture name="sealed-envelope" alt="" width={228} /></div>
        <div className="absolute left-1 top-0 drop-shadow-[0_20px_24px_rgba(0,0,0,.45)]"><Picture name="sealed-envelope" alt={st.art} width={228} /></div>
      </div>
      <p className="a-fade relative m-0 mt-[18px] text-[9.5px] font-bold uppercase tracking-[.28em] text-accent-soft" style={delay(0.2)}>{st.written}</p>
      <h2 className="a-clip relative m-0 mt-3 font-serif text-[36px] font-normal leading-[.98]" style={delay(0.28)}>{st.inPotA}<br />{st.inPotB}</h2>
      <dl className="a-up-sm relative m-0 mt-[22px] grid grid-cols-2 border-t border-on-night/28" style={delay(0.42)}>
        <div className="border-r border-on-night/28 py-3.5 pr-3.5">
          <dt className="text-[9px] font-bold uppercase tracking-[.18em] text-on-night-muted">{st.deposited}</dt>
          <dd className="m-0 mt-1.5 whitespace-nowrap font-serif text-[26px]">{fcfa(p.amount)}</dd>
        </div>
        <div className="py-3.5 pl-3.5">
          <dt className="text-[9px] font-bold uppercase tracking-[.18em] text-on-night-muted">{ctx ? st.pot : st.verifiedBy}</dt>
          <dd className="m-0 mt-1.5 whitespace-nowrap font-serif text-[26px]">{ctx ? `${after} / ${ctx.size}` : p.provider === 'SANDBOX' ? st.demo : st.who[p.provider]}</dd>
        </div>
      </dl>
      <p className="a-fade relative m-0 mb-[22px] mt-4 text-[13px] font-medium leading-normal text-on-night-muted" style={delay(0.5)}>{note}</p>
      {onDone ? (
        <button type="button" onClick={onDone} className={cta}>{st.seeCircle} <ArrowRight /></button>
      ) : (
        <Link href="/tontines" className={cta}>{st.seeCircles} <ArrowRight /></Link>
      )}
    </section>
  );
}

export function PaymentStatusPanel({ p, busy, onCheck, onCancel, onRetry, ctx, onDone }: {
  p: PublicPayment; busy: boolean; onCheck: () => void; onCancel: () => void; onRetry: () => void; ctx?: PayContext; onDone?: () => void;
}) {
  const st = useT().status;
  const { left, label } = useCountdown(p.expiresAt);
  if (p.status === 'CONFIRMED') return <Success p={p} ctx={ctx} onDone={onDone} />;

  const who = st.who[p.provider] ?? p.provider;
  const isCash = p.provider === 'CASH';

  const view = (() => {
    switch (p.status) {
      case 'INITIATED':
      case 'PENDING':
        return {
          eyebrow: isCash ? st.cashDeclared : st.waitingFor(who),
          title: isCash ? st.adminWill : left > 0 ? st.approve : st.lastCheck,
          body: isCash ? st.cashBody(fcfa(p.amount)) : left > 0 ? st.approveBody(who, label) : st.lastBody(who),
          mark: <span className="block size-10 animate-spin rounded-full border-2 border-dashed border-ink [animation-duration:4s]" />,
          actions: isCash ? null : (
            <div className="flex flex-col gap-2">
              <Button variant="ink" onClick={onCheck} disabled={busy}>{st.checkNow}</Button>
              <Button variant="line" arrow={false} onClick={onCancel} disabled={busy}>{st.cancel}</Button>
            </div>
          ),
          timer: !isCash && left > 0,
        };
      case 'FAILED':
        return {
          eyebrow: st.refused,
          title: st.nothing,
          body: st.reason[p.failureReason ?? ''] ?? st.reason.declined_by_provider,
          mark: <span className="relative block size-10 border-2 border-ink before:absolute before:left-1/2 before:top-1/2 before:h-[2px] before:w-[130%] before:-translate-x-1/2 before:-translate-y-1/2 before:rotate-45 before:bg-ink" />,
          actions: <Button onClick={onRetry}>{st.retry}</Button>,
        };
      case 'EXPIRED':
        return {
          eyebrow: st.expired,
          title: st.cancelled,
          body: st.reason[p.failureReason ?? 'no_confirmation'] ?? st.reason.no_confirmation,
          mark: <span className="block size-10 rounded-full border-2 border-ink [clip-path:polygon(0_0,100%_0,100%_50%,0_50%)]" />,
          actions: <Button onClick={onRetry}>{st.payAgain}</Button>,
        };
      default:
        return {
          eyebrow: st.review,
          title: st.handling,
          body: st.reason[p.failureReason ?? ''] ?? st.reviewBody,
          mark: <span className="block size-10 rotate-45 bg-warn" />,
          actions: null,
        };
    }
  })();

  return (
    <section key={p.status} role="status" aria-live="polite" className="a-up-sm flex flex-col gap-5">
      <div className="flex items-start justify-between gap-4 border-t-[1.5px] border-ink pt-4">
        <div className="flex flex-col gap-2.5">
          <p className="m-0 text-[9.5px] font-bold uppercase tracking-[.26em] text-accent-text">{view.eyebrow}</p>
          <h2 className="m-0 font-serif text-[32px] font-normal leading-none">{view.title}</h2>
        </div>
        {view.mark}
      </div>
      {'timer' in view && view.timer && (
        <p className="m-0 font-serif text-[56px] leading-none tabular-nums" aria-label={st.timeLeft(label)}>{label}</p>
      )}
      <p className="m-0 text-[14px] font-medium leading-relaxed text-muted">{view.body}</p>
      {view.actions}
    </section>
  );
}
