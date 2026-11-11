'use client';
import { useT } from '@/i18n/client';
import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import type { PublicPayment } from '@/lib/payments/status';
import { isLive } from '@/lib/payments/status';
import { PaymentStatusPanel } from '@/components/PaymentStatusPanel';
import { Eyebrow } from '@/components/ui/Type';

// Anyone can open this URL, so only the server-verified status is shown.
function Return() {
  const id = useSearchParams().get('p');
  const t = useT().ret;
  const router = useRouter();
  const [p, setP] = useState<PublicPayment | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!id) return;
    let stop = false;
    const tick = async () => {
      const res = await fetch(`/api/payments/${id}`, { method: 'POST' });
      if (!res.ok || stop) return;
      const data: PublicPayment = await res.json();
      setP(data);
      if (isLive(data.status)) setTimeout(tick, 3000);
    };
    tick();
    return () => { stop = true; };
  }, [id]);

  const act = (method: 'POST' | 'DELETE') => async () => {
    setBusy(true);
    const res = await fetch(`/api/payments/${id}`, { method });
    if (res.ok) setP(await res.json());
    setBusy(false);
  };

  return (
    <main className="flex min-h-dvh flex-col gap-8 px-6 pt-24">
      {!p ? (
        <div className="flex flex-col gap-3" role="status" aria-live="polite">
          <Eyebrow>{t.eyebrow}</Eyebrow>
          <h1 className="m-0 font-serif text-[40px] uppercase leading-none">{t.title}</h1>
          <p className="m-0 text-[15px] font-medium">{t.body}</p>
        </div>
      ) : (
        <PaymentStatusPanel p={p} busy={busy} onCheck={act('POST')} onCancel={act('DELETE')} onRetry={() => router.push('/home')} />
      )}
    </main>
  );
}

export default function Page() {
  return <Suspense><Return /></Suspense>;
}
