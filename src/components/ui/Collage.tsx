'use client';
import Image from 'next/image';
import { motion } from 'motion/react';

export function Collage({ src, alt, width = 360, mask = 'linear', halo = true, className = '' }: {
  src: string; alt: string; width?: number; mask?: 'linear' | 'radial'; halo?: boolean; className?: string;
}) {
  const m =
    mask === 'radial'
      ? 'radial-gradient(closest-side, #000 62%, rgba(0,0,0,.45) 82%, transparent 100%)'
      : 'linear-gradient(to bottom, transparent 0%, rgba(0,0,0,.45) 11%, #000 28%, #000 62%, rgba(0,0,0,.4) 86%, transparent 100%)';
  return (
    <motion.div
      className={`relative ${className}`}
      style={{ width, aspectRatio: '1 / .97', WebkitMaskImage: m, maskImage: m }}
      initial={{ y: -14, rotate: -2, opacity: 0 }}
      animate={{ y: 0, rotate: 0, opacity: 1 }}
      transition={{ duration: 1.3, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
    >
      {halo && <div aria-hidden className="absolute inset-[8%] rounded-full bg-[radial-gradient(circle,rgba(201,91,48,.5)_0%,rgba(201,91,48,0)_64%)]" />}
      <Image src={src} alt="" aria-hidden width={width} height={width} className="absolute left-3 top-2.5 opacity-30 [filter:sepia(1)_saturate(5)_hue-rotate(-16deg)]" />
      <Image src={src} alt={alt} width={width} height={width} className="relative" priority />
    </motion.div>
  );
}
