'use client';
import { motion } from 'motion/react';
import { fcfa } from '@/lib/money';
import { gaugeMode } from '@/lib/tontine';

export function PotGauge({ size, paid, pending, amount }: { size: number; paid: number; pending: number; amount: number }) {
  const total = size * amount;
  const mode = gaugeMode(size);
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-baseline justify-between">
        <span className="font-serif text-[40px] tabular-nums tracking-[-.02em]">{fcfa(paid * amount)}</span>
        <span className="text-[10px] font-bold uppercase tracking-[.2em] text-muted">sur {fcfa(total)} FCFA</span>
      </div>
      {mode === 'segments' ? (
        <div className="flex gap-1" role="img" aria-label={`${paid} parts sur ${size} reçues, ${pending} en vérification`}>
          {Array.from({ length: size }, (_, i) => (
            <motion.span
              key={i}
              className={`block h-3 flex-1 origin-bottom ${
                i < paid ? 'bg-accent' : i < paid + pending ? 'bg-[repeating-linear-gradient(135deg,var(--accent)_0_2px,transparent_2px_5px)]' : 'bg-line'
              }`}
              initial={{ scaleY: 0 }}
              animate={{ scaleY: 1 }}
              transition={{ delay: 0.3 + i * 0.05, duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
            />
          ))}
        </div>
      ) : (
        <div className="relative h-3 bg-line" role="img" aria-label={`${paid} parts sur ${size} reçues`}>
          <motion.span className="absolute inset-y-0 left-0 bg-accent" initial={{ width: 0 }} animate={{ width: `${(paid / size) * 100}%` }} transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }} />
          <span className="absolute inset-y-0 bg-[repeating-linear-gradient(135deg,var(--accent)_0_2px,transparent_2px_5px)]" style={{ left: `${(paid / size) * 100}%`, width: `${(pending / size) * 100}%` }} />
        </div>
      )}
      <p className="m-0 text-[12px] font-medium text-muted">
        {paid} parts sur {size} reçues{pending ? ` · ${pending} en vérification, pas encore comptée${pending > 1 ? 's' : ''}` : ''}
      </p>
    </div>
  );
}
