'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabaseBrowser } from '@/lib/supabase/client';
import { Button } from '@/components/ui/Button';
import { DEMO, DemoButton } from '@/components/DemoButton';
import { Collage, Picture, delay } from '@/components/ui/Kit';

const FADE = 'linear-gradient(var(--night) 0%, rgba(22,25,24,.92) 22%, rgba(22,25,24,.1) 36%, rgba(22,25,24,0) 48%, rgba(22,25,24,.4) 58%, rgba(22,25,24,.94) 68%, var(--night) 78%)';
const MASK = 'radial-gradient(112% 92% at 50% 42%, #000 38%, rgba(0,0,0,.82) 58%, rgba(0,0,0,.32) 78%, transparent 96%)';

export default function Auth() {
  const router = useRouter();
  const [step, setStep] = useState<'phone' | 'code'>('phone');
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const digits = phone.replace(/\D/g, '');
  const full = `+223${digits}`;

  const send = async () => {
    setBusy(true); setErr(null);
    const { error } = await supabaseBrowser().auth.signInWithOtp({ phone: full });
    setBusy(false);
    if (error) return setErr(DEMO ? 'Les SMS sont coupés dans la démo. Utilisez « Essayer la démo ».' : 'Ce numéro n’a pas pu recevoir de code. Vérifiez-le et réessayez.');
    setStep('code');
  };
  const verify = async () => {
    setBusy(true); setErr(null);
    const { error } = await supabaseBrowser().auth.verifyOtp({ phone: full, token: code, type: 'sms' });
    setBusy(false);
    if (error) return setErr('Code incorrect ou expiré.');
    router.replace('/home');
  };

  return (
    <main className="relative min-h-dvh overflow-hidden bg-night text-on-night">
      <Collage name="phone-flatlay" alt="Un téléphone posé à plat sur un pagne tissé, un doigt sur l’écran" width={286} priority mask={MASK} className="left-1/2 top-[174px] -ml-[143px]" />
      <div aria-hidden className="absolute inset-0 top-[31px]" style={{ background: FADE }} />
      <div className="grain" />

      <div className="absolute inset-x-[26px] top-[72px] z-10">
        <div className="a-fade"><Picture name="ikaton-logo-mark" alt="Ikàton" width={50} className="brightness-0 invert" /></div>
        <h1 className="a-clip m-0 mt-[30px] font-serif text-[42px] font-normal leading-[.98] tracking-[-.025em]" style={delay(0.2)}>
          {step === 'phone' ? <>Votre numéro,<br />et c’est <em className="text-accent">tout.</em></> : <>Le code<br />est <em className="text-accent">parti.</em></>}
        </h1>
      </div>

      <div className="absolute inset-x-[26px] bottom-11 z-10 flex flex-col">
        <p className="a-up-sm m-0 mb-[18px] max-w-[300px] text-[14.5px] font-semibold leading-normal" style={delay(0.4)}>
          {step === 'phone'
            ? 'Pas de mot de passe. Vous recevez un code par SMS, et votre numéro devient votre identité dans les cercles.'
            : `Six chiffres envoyés au ${full}.`}
        </p>

        {step === 'phone' ? (
          <label className="a-up-sm flex items-stretch border border-on-night/40 focus-within:border-accent" style={delay(0.48)}>
            <span className="flex items-center border-r border-on-night/40 px-3.5 text-[13px] font-bold text-on-night-muted">+223</span>
            <span className="sr-only">Numéro de téléphone au Mali</span>
            <input
              className="min-h-[58px] w-full min-w-0 bg-transparent px-3.5 font-serif text-[24px] tracking-[.04em] text-on-night outline-none placeholder:text-on-night-faint"
              inputMode="tel" autoComplete="tel-national" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="76 12 34 56"
            />
          </label>
        ) : (
          <label className="a-up-sm flex border border-on-night/40 focus-within:border-accent">
            <span className="sr-only">Code reçu par SMS</span>
            <input
              className="min-h-[58px] w-full bg-transparent px-3.5 font-serif text-[30px] tracking-[.5em] text-on-night outline-none"
              inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
            />
          </label>
        )}

        {err && <p role="alert" className="m-0 mt-3 text-[13px] font-semibold text-accent-soft">{err}</p>}

        <div className="mt-3.5 flex flex-col gap-2">
          {step === 'phone' ? (
            <>
              {DEMO && <DemoButton />}
              <Button variant={DEMO ? 'line-night' : 'accent'} onClick={send} disabled={busy || digits.length !== 8}>Recevoir le code</Button>
            </>
          ) : (
            <>
              <Button onClick={verify} disabled={busy || code.length < 6}>Entrer</Button>
              <Button variant="line-night" arrow={false} onClick={() => { setStep('phone'); setCode(''); setErr(null); }}>Changer de numéro</Button>
            </>
          )}
        </div>
        <p className="m-0 mt-3.5 text-[11.5px] font-medium leading-normal text-on-night-faint">
          En continuant vous acceptez que votre numéro soit visible par les membres de vos cercles.
        </p>
      </div>
    </main>
  );
}
