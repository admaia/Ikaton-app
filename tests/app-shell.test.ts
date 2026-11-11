import { describe, expect, it, vi } from 'vitest';
import manifest from '@/app/manifest';
import { showcase } from '@/config/showcase';

vi.mock('@prisma/client', () => ({ PrismaClient: class {} }));

describe('web app manifest', () => {
  const m = manifest();

  it('installs as a standalone app that opens on home', () => {
    expect(m).toMatchObject({ name: 'Ikàton', display: 'standalone', start_url: '/home', scope: '/' });
  });

  it('ships the icon sizes phones ask for, including a maskable one', () => {
    expect(m.icons?.map((i) => i.sizes)).toEqual(['192x192', '512x512', '512x512']);
    expect(m.icons?.some((i) => i.purpose === 'maskable')).toBe(true);
  });
});

describe('showcase page', () => {
  it('has the same content in both languages', () => {
    expect(Object.keys(showcase.fr)).toEqual(Object.keys(showcase.en));
    expect(showcase.fr.points).toHaveLength(showcase.en.points.length);
  });

  it('links to the code and the case study over https', () => {
    expect(showcase.en.source).toMatch(/^https:\/\/github\.com\/admaia\//);
    expect(showcase.en.caseStudy).toMatch(/^https:\/\/www\.behance\.net\//);
  });
});

describe('database client', () => {
  it('is created once and reused across reloads in development', async () => {
    const first = (await import('@/lib/prisma')).prisma;
    vi.resetModules();
    expect((await import('@/lib/prisma')).prisma).toBe(first);
  });
});
