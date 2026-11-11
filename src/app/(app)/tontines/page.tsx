import Link from 'next/link';
import { requireUser } from '@/lib/auth';
import { getOverview, RHYTHM_LABEL, type ShareStatus } from '@/lib/data';
import { fcfa } from '@/lib/money';
import { dayMonth } from '@/lib/dates';
import { gaugeMode } from '@/lib/tontine';
import { Picture, Tag, delay } from '@/components/ui/Kit';

const WORDS = ['aucun', 'un', 'deux', 'trois', 'quatre', 'cinq', 'six', 'sept', 'huit', 'neuf', 'dix'];
const word = (n: number) => WORDS[n] ?? String(n);
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

const AVATAR: Record<ShareStatus, string> = { paid: 'bg-accent', pending: 'bg-forest', late: 'bg-warn', due: 'bg-ink' };

type Item = Awaited<ReturnType<typeof getOverview>>['circles'][number];

function state(c: Item): { tag: string; tone: 'ink' | 'forest'; foot: string } {
  if (!c.cycle) return { tag: 'Démarre', tone: 'ink', foot: `Démarre à ${c.size} membres` };
  if (c.cashToValidate) return { tag: 'À valider', tone: 'ink', foot: `${c.cashToValidate} espèce${c.cashToValidate > 1 ? 's' : ''} à valider` };
  if (c.myStatus === 'paid') {
    return { tag: 'Payé', tone: 'forest', foot: c.cycle.iReceive ? 'Vous recevez ce cycle' : `${c.cycle.beneficiary} reçoit` };
  }
  if (c.myStatus === 'pending') return { tag: 'En route', tone: 'ink', foot: 'Paiement en vérification' };
  return { tag: c.myStatus === 'late' ? 'En retard' : 'À payer', tone: 'ink', foot: `Avant le ${dayMonth(c.cycle.dueAt)}` };
}

export default async function Tontines() {
  const user = await requireUser();
  const { circles } = await getOverview(user.id);
  const managed = circles.filter((c) => c.role === 'ADMIN').length;

  return (
    <main className="relative overflow-hidden pt-[60px]">
      <div className="grain" />
      <div className="px-[22px]">
        <p className="a-fade m-0 text-[10px] font-bold uppercase tracking-[.26em] text-muted">
          {cap(word(circles.length))} cercle{circles.length > 1 ? 's' : ''}{managed ? ` — ${word(managed)} que vous gérez` : ''}
        </p>
        <h1 className="a-clip m-0 mt-3.5 font-serif text-[44px] font-normal leading-[.95] tracking-[-.025em]" style={delay(0.1)}>Mes<br />tontines</h1>
        <span aria-hidden className="a-rule mt-5 block h-[1.5px] bg-ink" style={delay(0.2)} />
      </div>

      <ul className="m-0 list-none p-0">
        {circles.map((c, i) => {
          const s = state(c);
          const filled = c.cycle ? c.cycle.paid : c.joined;
          const pending = c.cycle?.pending ?? 0;
          const shown = c.members.slice(0, 3);
          return (
            <li key={c.id} className="a-up border-b border-line" style={delay(0.18 + i * 0.08)}>
              <Link href={`/tontines/${c.id}`} className="block px-[22px] py-6 text-ink no-underline transition-colors hover:bg-ink/[.03]">
                <span className="flex items-baseline gap-3.5">
                  <span className="font-serif text-[15px]">{String(i + 1).padStart(2, '0')}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block font-serif text-[29px] leading-none tracking-[-.02em]">{c.name}</span>
                    <span className="mt-2 block text-[11px] font-semibold uppercase tracking-[.14em] text-muted">
                      {c.size} membres — {fcfa(c.amount)} / {RHYTHM_LABEL[c.rhythm]}{c.cycle ? ` — cycle ${c.cycle.index}` : ''}
                    </span>
                  </span>
                  <span className="flex flex-col items-end gap-[5px]">
                    {c.role === 'ADMIN' ? <Tag tone="accent">Gestionnaire</Tag> : <Tag tone="outline">Membre</Tag>}
                    <Tag tone={s.tone}>{s.tag}</Tag>
                  </span>
                </span>

                {gaugeMode(c.size) === 'segments' ? (
                  <span aria-hidden className="mt-[18px] flex gap-[3px]">
                    {Array.from({ length: c.size }, (_, k) => (
                      <span key={k} className={`block h-2 flex-1 ${k < filled ? 'bg-accent' : k < filled + pending ? 'bg-ink/22' : 'bg-line'}`} />
                    ))}
                  </span>
                ) : (
                  <span aria-hidden className="relative mt-[18px] block h-2 bg-line">
                    <span className="absolute inset-y-0 left-0 bg-accent" style={{ width: `${(filled / c.size) * 100}%` }} />
                  </span>
                )}

                <span className="mt-[9px] flex items-center justify-between gap-2.5 text-[10px] font-bold uppercase tracking-[.14em]">
                  <span className="flex min-w-0 items-center gap-2.5">
                    <span aria-hidden className="flex shrink-0">
                      {shown.map((m, k) => (
                        <span key={m.id} className={`block size-[23px] rounded-full border-[1.5px] border-paper ${m.status ? AVATAR[m.status] : 'bg-accent'} ${k ? '-ml-2' : ''}`} />
                      ))}
                      {c.joined > 3 && (
                        <span className="-ml-2 flex size-[23px] items-center justify-center rounded-full border-[1.5px] border-paper bg-sand text-[8.5px] font-bold">+{c.joined - 3}</span>
                      )}
                    </span>
                    <span>{c.cycle ? `${c.cycle.paid} / ${c.size} ont cotisé` : `${c.joined} / ${c.size} ont rejoint`}</span>
                  </span>
                  <span className="text-right">{s.foot}</span>
                </span>
              </Link>
            </li>
          );
        })}
      </ul>

      <div className="px-[22px] pt-[26px]">
        <div className="flex items-center gap-4 border-b border-line py-5 opacity-80" aria-disabled="true">
          <Picture name="empty-basket" alt="" width={68} className="mix-blend-multiply drop-shadow-[0_9px_11px_rgba(22,25,24,.24)] dark:mix-blend-normal" />
          <span className="min-w-0 flex-1">
            <span className="block font-serif text-[20px] leading-[1.1]">Ouvrir un cercle</span>
            <span className="mt-[5px] block text-[10.5px] font-semibold uppercase tracking-[.14em] text-muted">Ou rejoindre avec un code</span>
          </span>
          <Tag tone="outline">Bientôt</Tag>
        </div>
      </div>
    </main>
  );
}
