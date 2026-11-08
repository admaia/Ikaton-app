'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabaseBrowser } from '@/lib/supabase/client';
import { Button } from '@/components/ui/Button';
import { Eyebrow, Rule, Title } from '@/components/ui/Type';
import { DemoButton } from '@/components/DemoButton';

export default function Auth() {
  const router = useRouter();
  const [step, setStep] = useState<'phone' | 'code'>('phone');
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const full = `+223${phone.replace(/\D/g, '')}`;

  const send = async () => {
    setBusy(true); setErr(null);
    const { error } = await supabaseBrowser().auth.signInWithOtp({ phone: full });
    setBusy(false);
    if (error) return setErr('Ce numéro n’a pas pu recevoir de code. Vérifiez-le et réessayez.');
    setStep('code');
  };
  const verify = async () => {
    setBusy(true); setErr(null);
    const { error } = await supabaseBrowser().auth.verifyOtp({ phone: full, token: code, type: 'sms' });
    setBusy(false);
    if (error) return setErr('Code incorrect ou expiré.');
    router.replace('/home');
  };

  const field = 'w-full min-h-14 border-0 border-b-[1.5px] border-ink bg-transparent font-serif text-[32px] tracking-[.04em] outline-none focus:border-accent';

  return (
    <main className="flex min-h-dvh flex-col gap-8 px-6 pb-10 pt-28">
      <div className="flex flex-col gap-3">
        <Eyebrow>{step === 'phone' ? 'Entrer dans l’app' : 'Code SMS'}</Eyebrow>
        <Title>{step === 'phone' ? <>Votre<br />numéro</> : <>Le code<br />reçu</>}</Title>
      </div>
      <Rule />
      {step === 'phone' ? (
        <label className="flex flex-col gap-2">
          <span className="text-[10px] font-bold uppercase tracking-[.2em] text-muted">Mali · +223</span>
          <input className={field} inputMode="tel" autoComplete="tel-national" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="76 12 34 56" />
        </label>
      ) : (
        <label className="flex flex-col gap-2">
          <span className="text-[10px] font-bold uppercase tracking-[.2em] text-muted">Envoyé au {full}</span>
          <input className={field} inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))} />
        </label>
      )}
      {err && <p role="alert" className="m-0 bg-warn-bg px-4 py-3 text-[13px] font-semibold text-warn">{err}</p>}
      <div className="mt-auto flex flex-col gap-2">
        {step === 'phone' && <DemoButton variant="line" />}
        {step === 'phone' ? (
          <Button onClick={send} disabled={busy || phone.replace(/\D/g, '').length !== 8}>Recevoir le code</Button>
        ) : (
          <Button onClick={verify} disabled={busy || code.length < 6}>Entrer</Button>
        )}
      </div>
    </main>
  );
}
