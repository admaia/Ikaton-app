import { createHash } from 'node:crypto';

// Commit–reveal: commit(seed) is published before the draw and the seed after, so anyone can recompute the order.
export const commit = (seed: string) => createHash('sha256').update(seed).digest('hex');

export function drawOrder<T>(items: T[], seed: string): T[] {
  const out = [...items];
  let h = createHash('sha256').update(seed).digest();
  let k = 0;
  const next = () => {
    if (k + 4 > h.length) {
      h = createHash('sha256').update(h).digest();
      k = 0;
    }
    const v = h.readUInt32BE(k);
    k += 4;
    return v / 0x1_0000_0000;
  };
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(next() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}
