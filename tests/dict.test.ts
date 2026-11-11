import { describe, expect, it } from 'vitest';
import { dict, parseLang } from '@/i18n/dict';

type Node = string | number | boolean | null | ((...args: unknown[]) => unknown) | Node[] | { [key: string]: Node };

function walk(node: Node, path: string, visit: (path: string, value: Node) => void) {
  visit(path, node);
  if (node && typeof node === 'object') {
    for (const [key, child] of Object.entries(node)) walk(child as Node, path ? `${path}.${key}` : key, visit);
  }
}

const shape = (root: Node) => {
  const out: Record<string, string> = {};
  walk(root, '', (path, value) => {
    out[path] = typeof value === 'function' ? `function/${value.length}` : Array.isArray(value) ? `array/${value.length}` : typeof value;
  });
  return out;
};

const rendered = (root: Node) => {
  const out: [string, string][] = [];
  walk(root, '', (path, value) => {
    if (typeof value === 'string') out.push([path, value]);
    if (typeof value === 'function') {
      out.push([`${path}(2)`, String(value(2, 3, 4))]);
      out.push([`${path}(1)`, String(value(1, 0, 0))]);
    }
  });
  return out;
};

describe('translations', () => {
  it('falls back to English for anything that is not French', () => {
    expect(parseLang('fr')).toBe('fr');
    expect(parseLang('en')).toBe('en');
    expect(parseLang('de')).toBe('en');
    expect(parseLang(undefined)).toBe('en');
    expect(parseLang(null)).toBe('en');
  });

  it('French and English have exactly the same entries', () => {
    expect(shape(dict.en as unknown as Node)).toEqual(shape(dict.fr as unknown as Node));
  });

  it.each(['fr', 'en'] as const)('every %s line renders without a gap or an em dash', (lang) => {
    for (const [path, text] of rendered(dict[lang] as unknown as Node)) {
      expect(text, path).not.toMatch(/undefined|NaN|\[object/);
      expect(text, path).not.toContain('—');
    }
  });

  it('agrees nouns with the count in both languages', () => {
    expect(dict.fr.home.days(1)).toBe('1 jour');
    expect(dict.fr.home.days(3)).toBe('3 jours');
    expect(dict.en.home.days(1)).toBe('1 day');
    expect(dict.en.home.days(3)).toBe('3 days');
    expect(dict.en.list.cash(1)).toBe('1 cash payment to confirm');
    expect(dict.en.list.cash(2)).toBe('2 cash payments to confirm');
  });

  it('spells small circle counts and mentions managed circles only when there are some', () => {
    expect(dict.fr.list.count(4, 2)).toBe('Quatre cercles, deux gérés par vous');
    expect(dict.en.list.count(4, 2)).toBe('Four circles, two you organise');
    expect(dict.en.list.count(1, 0)).toBe('One circle');
    expect(dict.en.list.count(14, 0)).toBe('14 circles');
  });

  it('mentions waiting actions only when there are some', () => {
    expect(dict.en.home.managed(2, 3)).toBe('2 circles you organise · 3 actions waiting');
    expect(dict.en.home.managed(1, 0)).toBe('1 circle you organise');
  });
});
