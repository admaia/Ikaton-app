import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

type CookieAdapter = { getAll: () => unknown[]; setAll: (list: { name: string; value: string; options: object }[]) => void };

const mocks = vi.hoisted(() => ({
  getUser: vi.fn(),
  upsert: vi.fn(),
  redirect: vi.fn((to: string) => {
    throw new Error(`redirect:${to}`);
  }),
  cookieStore: { getAll: vi.fn(() => [{ name: 'sb', value: 'token' }]), set: vi.fn(), get: vi.fn() },
  createServerClient: vi.fn(),
  createBrowserClient: vi.fn(() => 'browser-client'),
}));

vi.mock('server-only', () => ({}));
vi.mock('next/navigation', () => ({ redirect: mocks.redirect }));
vi.mock('next/headers', () => ({ cookies: async () => mocks.cookieStore }));
vi.mock('@supabase/ssr', () => ({ createServerClient: mocks.createServerClient, createBrowserClient: mocks.createBrowserClient }));
vi.mock('@/lib/prisma', () => ({ prisma: { user: { upsert: mocks.upsert } } }));

import { currentUser, requireUser } from '@/lib/auth';
import { supabaseServer } from '@/lib/supabase/server';
import { supabaseBrowser } from '@/lib/supabase/client';
import { getLang, getT } from '@/i18n/server';
import { middleware } from '@/middleware';

const adapter = () => (mocks.createServerClient.mock.calls.at(-1)![2] as { cookies: CookieAdapter }).cookies;

beforeEach(() => {
  vi.clearAllMocks();
  mocks.createServerClient.mockReturnValue({ auth: { getUser: mocks.getUser } });
  mocks.getUser.mockResolvedValue({ data: { user: null } });
  mocks.upsert.mockImplementation(async ({ create }: { create: object }) => create);
});

describe('currentUser', () => {
  it('is null without a session', async () => {
    expect(await currentUser()).toBeNull();
    expect(mocks.upsert).not.toHaveBeenCalled();
  });

  it('creates the profile of a phone user with a normalised number', async () => {
    mocks.getUser.mockResolvedValue({ data: { user: { id: 'u-1', phone: '22370000000', user_metadata: {} } } });
    expect(await currentUser()).toEqual({ id: 'u-1', phone: '+22370000000', name: '+22370000000' });
    expect(mocks.upsert).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 'u-1' }, update: {} }));
  });

  it('does not double the plus sign', async () => {
    mocks.getUser.mockResolvedValue({ data: { user: { id: 'u-1', phone: '+22370000000', user_metadata: { name: 'Aminata B.' } } } });
    expect(await currentUser()).toEqual({ id: 'u-1', phone: '+22370000000', name: 'Aminata B.' });
  });

  it('gives a demo visitor a placeholder phone and a neutral name', async () => {
    mocks.getUser.mockResolvedValue({ data: { user: { id: 'anon-1', is_anonymous: true } } });
    expect(await currentUser()).toEqual({ id: 'anon-1', phone: 'anon:anon-1', name: 'Vous' });
  });
});

describe('requireUser', () => {
  it('sends a signed-out visitor to sign in', async () => {
    await expect(requireUser()).rejects.toThrow('redirect:/auth');
  });

  it('returns the user when there is one', async () => {
    mocks.getUser.mockResolvedValue({ data: { user: { id: 'u-1', phone: '22370000000' } } });
    expect(await requireUser()).toMatchObject({ id: 'u-1' });
  });
});

describe('Supabase clients', () => {
  it('reads and writes the session through the request cookies', async () => {
    await supabaseServer();
    expect(adapter().getAll()).toEqual([{ name: 'sb', value: 'token' }]);
    adapter().setAll([{ name: 'sb', value: 'fresh', options: { path: '/' } }]);
    expect(mocks.cookieStore.set).toHaveBeenCalledWith('sb', 'fresh', { path: '/' });
  });

  it('does not crash where cookies are read-only', async () => {
    mocks.cookieStore.set.mockImplementationOnce(() => {
      throw new Error('read-only');
    });
    await supabaseServer();
    expect(() => adapter().setAll([{ name: 'sb', value: 'fresh', options: {} }])).not.toThrow();
  });

  it('builds a browser client', () => {
    expect(supabaseBrowser()).toBe('browser-client');
  });
});

describe('language', () => {
  it('reads the language cookie and defaults to English', async () => {
    mocks.cookieStore.get.mockReturnValue(undefined);
    expect(await getLang()).toBe('en');
    mocks.cookieStore.get.mockReturnValue({ value: 'fr' });
    expect(await getLang()).toBe('fr');
    expect(mocks.cookieStore.get).toHaveBeenCalledWith('ikaton-lang');
  });

  it('returns the matching texts', async () => {
    mocks.cookieStore.get.mockReturnValue({ value: 'fr' });
    const { lang, t } = await getT();
    expect(lang).toBe('fr');
    expect(t.today).toBe('Aujourd’hui');
  });
});

describe('middleware', () => {
  const visit = (path: string) => middleware(new NextRequest(`https://ikaton.test${path}`));

  it('sends a signed-out visitor to onboarding', async () => {
    const res = await visit('/home');
    expect(res.status).toBe(307);
    expect(res.headers.get('location')).toBe('https://ikaton.test/onboarding');
  });

  it('answers 401 on a private API route instead of redirecting', async () => {
    const res = await visit('/api/payments');
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: 'unauthorized' });
  });

  it.each(['/onboarding', '/auth', '/offline', '/api/webhooks/wave', '/api/cron/expire-payments', '/manifest.webmanifest', '/sw.js'])(
    'leaves %s open to everyone',
    async (path) => {
      expect((await visit(path)).status).toBe(200);
    },
  );

  it('lets a signed-in member through', async () => {
    mocks.getUser.mockResolvedValue({ data: { user: { id: 'u-1' } } });
    expect((await visit('/home')).status).toBe(200);
  });

  it('passes a refreshed session cookie on to the browser', async () => {
    mocks.getUser.mockImplementation(async () => {
      adapter().setAll([{ name: 'sb', value: 'fresh', options: { path: '/' } }]);
      return { data: { user: { id: 'u-1' } } };
    });
    const res = await visit('/home');
    expect(res.cookies.get('sb')?.value).toBe('fresh');
    expect(adapter().getAll()).toEqual(expect.arrayContaining([expect.objectContaining({ name: 'sb', value: 'fresh' })]));
  });
});
