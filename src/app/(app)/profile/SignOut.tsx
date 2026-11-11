'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabaseBrowser } from '@/lib/supabase/client';
import { Button } from '@/components/ui/Button';
import { useT } from '@/i18n/client';

export function SignOut({ demo }: { demo: boolean }) {
  const router = useRouter();
  const t = useT().profile;
  const [busy, setBusy] = useState(false);
  const go = async () => {
    setBusy(true);
    await supabaseBrowser().auth.signOut();
    router.replace('/onboarding');
    router.refresh();
  };
  return (
    <div className="flex flex-col gap-2">
      <Button variant="line" onClick={go} disabled={busy}>{demo ? t.restart : t.signOut}</Button>
      {demo && <p className="m-0 text-[12px] font-medium leading-normal text-muted">{t.restartNote}</p>}
    </div>
  );
}
