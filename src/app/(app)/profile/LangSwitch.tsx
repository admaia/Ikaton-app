'use client';
import { useRouter } from 'next/navigation';
import { saveLang, useLang, useT } from '@/i18n/client';

export function LangSwitch() {
  const router = useRouter();
  const lang = useLang();
  const t = useT();
  const next = lang === 'en' ? 'fr' : 'en';
  const flip = () => {
    saveLang(next);
    if (window.self !== window.top) window.parent.postMessage({ type: 'ikaton:lang', lang: next }, location.origin);
    router.refresh();
  };
  return (
    <button type="button" onClick={flip} lang={next} className="flex min-h-11 items-center border border-ink px-3.5 text-[10px] font-bold uppercase tracking-[.18em]">
      {t.profile.other}
    </button>
  );
}
