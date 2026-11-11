'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabaseBrowser } from '@/lib/supabase/client';
import { Button } from '@/components/ui/Button';

export function SignOut({ demo }: { demo: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const go = async () => {
    setBusy(true);
    await supabaseBrowser().auth.signOut();
    router.replace('/onboarding');
    router.refresh();
  };
  return (
    <div className="flex flex-col gap-2">
      <Button variant="line" onClick={go} disabled={busy}>{demo ? 'Recommencer la démo' : 'Se déconnecter'}</Button>
      {demo && <p className="m-0 text-[12px] font-medium leading-normal text-muted">Vous repartez de zéro : de nouveaux cercles sont créés à la prochaine entrée.</p>}
    </div>
  );
}
