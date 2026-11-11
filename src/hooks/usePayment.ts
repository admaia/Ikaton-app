'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { isLive, type PublicPayment } from '@/lib/payments/status';

export type Method = 'WAVE' | 'ORANGE' | 'CASH' | 'SANDBOX';
export type OperatorAction = 'approve' | 'decline' | 'silent' | 'double' | 'forge';
export type OperatorLine = { label: string; http: number; answer: string };

// One idempotency key per attempt, so double taps and retries hit the same payment.
export function usePayment(cycleId: string) {
  const [payment, setPayment] = useState<PublicPayment | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const key = useRef<string | null>(null);

  const load = useCallback(async (init?: RequestInit, url = payment ? `/api/payments/${payment.id}` : `/api/payments?cycleId=${cycleId}`) => {
    const res = await fetch(url, init);
    const data = await res.json().catch(() => null);
    if (!res.ok) throw new Error(data?.error ?? 'network');
    setPayment(data);
    return data as PublicPayment | null;
  }, [cycleId, payment]);

  useEffect(() => {
    load(undefined, `/api/payments?cycleId=${cycleId}`).catch(() => {});
  }, [cycleId]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!payment || !isLive(payment.status)) return;
    const t = setInterval(() => load().catch(() => {}), 4000);
    const onVis = () => document.visibilityState === 'visible' && load().catch(() => {});
    document.addEventListener('visibilitychange', onVis);
    return () => {
      clearInterval(t);
      document.removeEventListener('visibilitychange', onVis);
    };
  }, [payment, load]);

  const start = async (provider: Method) => {
    if (busy) return;
    setBusy(true);
    setError(null);
    key.current ??= crypto.randomUUID();
    try {
      const p = await load(
        { method: 'POST', headers: { 'content-type': 'application/json', 'idempotency-key': key.current }, body: JSON.stringify({ cycleId, provider }) },
        '/api/payments',
      );
      if (p?.checkoutUrl) window.location.assign(p.checkoutUrl);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const wrap = (fn: () => Promise<unknown>) => async () => {
    setBusy(true);
    try { await fn(); } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  };

  const operate = async (action: OperatorAction) => {
    if (!payment) return [];
    setBusy(true);
    try {
      const res = await fetch(`/api/sandbox/${payment.id}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action }) });
      const { log } = (await res.json()) as { log: OperatorLine[] };
      await load(undefined, `/api/payments/${payment.id}`);
      return log ?? [];
    } catch {
      setError('network');
      return [];
    } finally {
      setBusy(false);
    }
  };

  return {
    payment, error, busy, start, operate,
    check: wrap(() => load({ method: 'POST' })),
    cancel: wrap(() => load({ method: 'DELETE' })),
    retry: () => { key.current = null; setPayment(null); setError(null); },
  };
}

export function useCountdown(iso?: string) {
  const [left, setLeft] = useState(0);
  useEffect(() => {
    if (!iso) return;
    const tick = () => setLeft(Math.max(0, new Date(iso).getTime() - Date.now()));
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, [iso]);
  const m = Math.floor(left / 60000);
  const s = Math.floor((left % 60000) / 1000);
  return { left, label: `${m}:${String(s).padStart(2, '0')}` };
}
