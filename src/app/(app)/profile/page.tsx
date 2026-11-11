import { requireUser } from '@/lib/auth';
import { initials } from '@/lib/money';
import { ThemeToggle } from '@/components/BottomNav';
import { delay } from '@/components/ui/Kit';
import { getT } from '@/i18n/server';
import { LangSwitch } from './LangSwitch';
import { SignOut } from './SignOut';

export default async function Profile() {
  const user = await requireUser();
  const { t } = await getT();
  const demo = user.phone.startsWith('anon:');
  return (
    <main className="relative">
      <section className="bg-night px-[22px] pb-8 pt-[72px] text-on-night">
        <div className="flex items-center gap-4">
          <span className="flex size-16 items-center justify-center rounded-full bg-accent font-serif text-[24px] text-white">{initials(user.name)}</span>
          <div>
            <h1 className="a-clip m-0 font-serif text-[34px] font-normal leading-none" style={delay(0.1)}>{user.name}</h1>
            <p className="m-0 mt-2 text-[10px] font-bold uppercase tracking-[.2em] text-on-night-muted">{demo ? t.profile.demoAccount : user.phone}</p>
          </div>
        </div>
      </section>
      <div className="flex flex-col gap-6 px-[22px] pt-8">
        <div className="flex flex-col gap-2">
          <p className="m-0 text-[10px] font-bold uppercase tracking-[.26em]">{t.profile.display}</p>
          <div className="flex flex-wrap gap-2">
            <ThemeToggle />
            <LangSwitch />
          </div>
        </div>
        <SignOut demo={demo} />
      </div>
    </main>
  );
}
