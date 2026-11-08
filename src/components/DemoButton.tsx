'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabaseBrowser } from '@/lib/supabase/client';
import { Button } from './ui/Button';

export const DEMO = process.env.NEXT_PUBLIC_DEMO_MODE === 'true';

export function DemoButton({ variant = 'accent' }: { variant?: 'accent' | 'ink' | 'line' }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(false);
  if (!DEMO) return null;
  const go = async () => {
    setBusy(true);
    setErr(false);
    const sb = supabaseBrowser();
    const { data } = await sb.auth.getUser();
    if (!data.user) {
      const { error } = await sb.auth.signInAnonymously();
      if (error) { setBusy(false); setErr(true); return; }
    }
    const res = await fetch('/api/demo', { method: 'POST' });
    if (!res.ok) { setBusy(false); setErr(true); return; }
    router.replace('/home');
  };
  return (
    <div className="flex flex-col gap-2">
      <Button variant={variant} onClick={go} disabled={busy}>{busy ? 'Préparation des cercles…' : 'Essayer la démo'}</Button>
      {err && <p role="alert" className="m-0 text-[13px] font-semibold text-warn">La démo n’a pas pu démarrer. Réessayez.</p>}
    </div>
  );
}
