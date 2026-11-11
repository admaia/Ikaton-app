'use client';
import { useEffect, useState } from 'react';
import { dict, LANG_COOKIE, parseLang } from '@/i18n/dict';

export default function Offline() {
  const [t, setT] = useState(dict.en.offline);
  useEffect(() => {
    const m = document.cookie.match(new RegExp(`(?:^|; )${LANG_COOKIE}=([^;]*)`));
    setT(dict[parseLang(m?.[1])].offline);
  }, []);
  return (
    <main className="flex min-h-dvh flex-col justify-center gap-5 px-6">
      <p className="m-0 text-[10px] font-bold uppercase tracking-[.3em] text-accent-text">{t.eyebrow}</p>
      <h1 className="m-0 font-serif text-[44px] leading-[.98] tracking-[-.025em]">{t.title}</h1>
      <p className="m-0 text-[15px] font-medium leading-relaxed">{t.body}</p>
    </main>
  );
}
