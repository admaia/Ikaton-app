import { beforeEach, describe, expect, it, vi } from 'vitest';

type Rows = Record<string, unknown>[];
const env = vi.hoisted(() => ({ DEMO_MODE: true }));
const mocks = vi.hoisted(() => ({ currentUser: vi.fn(), getLang: vi.fn(), count: vi.fn(), userUpdate: vi.fn() }));
const seeded = vi.hoisted(() => ({ tables: {} as Record<string, Record<string, unknown>[]> }));

vi.mock('server-only', () => ({}));
vi.mock('@/lib/env', () => ({ env }));
vi.mock('@/lib/auth', () => ({ currentUser: mocks.currentUser }));
vi.mock('@/i18n/server', () => ({ getLang: mocks.getLang }));
vi.mock('@/lib/prisma', () => {
  const table = (name: string) => ({
    createMany: async ({ data }: { data: Record<string, unknown>[] }) => {
      seeded.tables[name] = data;
    },
  });
  const tx = {
    user: { ...table('user'), update: mocks.userUpdate },
    circle: table('circle'),
    membership: table('membership'),
    cycle: table('cycle'),
    contribution: table('contribution'),
    payment: table('payment'),
    ledgerEntry: table('ledgerEntry'),
  };
  return { prisma: { membership: { count: mocks.count }, $transaction: async (fn: (t: typeof tx) => Promise<void>) => fn(tx) } };
});

import { POST } from '@/app/api/demo/route';

const t = (name: string) => seeded.tables[name] as Rows;
const ids = (name: string) => new Set(t(name).map((r) => r.id));
const circle = (name: string) => t('circle').find((c) => c.name === name)!;
const openCycle = (circleId: unknown) => t('cycle').find((c) => c.circleId === circleId && c.status === 'OPEN')!;
const mine = (circleId: unknown) => t('membership').find((m) => m.circleId === circleId && m.userId === 'me')!;

beforeEach(() => {
  vi.clearAllMocks();
  env.DEMO_MODE = true;
  seeded.tables = {};
  mocks.currentUser.mockResolvedValue({ id: 'me' });
  mocks.getLang.mockResolvedValue('en');
  mocks.count.mockResolvedValue(0);
});

describe('POST /api/demo', () => {
  it('does not exist outside demo mode', async () => {
    env.DEMO_MODE = false;
    expect((await POST()).status).toBe(404);
  });

  it('requires a session', async () => {
    mocks.currentUser.mockResolvedValue(null);
    expect((await POST()).status).toBe(401);
  });

  it('never seeds the same visitor twice', async () => {
    mocks.count.mockResolvedValue(4);
    expect(await (await POST()).json()).toEqual({ ok: true });
    expect(seeded.tables).toEqual({});
  });

  it('creates the four circles, named in the visitor’s language', async () => {
    await POST();
    expect(t('circle').map((c) => c.name)).toEqual(['Nafa Circle', 'Market Tontine', 'Badalabougou Sisters', 'Sènè Circle']);
    mocks.getLang.mockResolvedValue('fr');
    await POST();
    expect(t('circle').map((c) => c.name)).toEqual(['Cercle Nafa', 'Tontine du marché', 'Les sœurs de Badalabougou', 'Cercle Sènè']);
  });

  it('puts the visitor in every circle and makes them organiser of two', async () => {
    await POST();
    const memberships = t('circle').map((c) => mine(c.id));
    expect(memberships.every(Boolean)).toBe(true);
    expect(memberships.map((m) => m.role)).toEqual(['MEMBER', 'MEMBER', 'ADMIN', 'ADMIN']);
    expect(mocks.userUpdate).toHaveBeenCalledWith({ where: { id: 'me' }, data: { name: 'Aminata B.' } });
  });

  it('leaves the visitor one share to pay, in the Nafa circle', async () => {
    await POST();
    const nafa = circle('Nafa Circle');
    const cycle = openCycle(nafa.id);
    const paid = t('contribution').filter((c) => c.cycleId === cycle.id);
    expect(cycle.index).toBe(3);
    expect(paid).toHaveLength(6);
    expect(paid.some((c) => c.membershipId === mine(nafa.id).id)).toBe(false);
    expect(t('ledgerEntry').some((l) => l.cycleId === cycle.id && l.kind === 'late')).toBe(true);
  });

  it('shows a complete cycle in the market tontine and a past payout to the visitor', async () => {
    await POST();
    const market = circle('Market Tontine');
    const cycle = openCycle(market.id);
    expect(t('contribution').filter((c) => c.cycleId === cycle.id)).toHaveLength(12);
    const myTurn = t('cycle').find((c) => c.circleId === market.id && c.beneficiaryId === mine(market.id).id)!;
    expect(myTurn).toMatchObject({ index: 4, status: 'PAID_OUT' });
    const payout = t('ledgerEntry').find((l) => l.cycleId === myTurn.id && l.kind === 'out')!;
    expect(payout).toMatchObject({ text: 'Le pot a été versé à Aminata B.', amount: 120000, meta: 'Orange Money · 120 000' });
  });

  it('leaves two cash deposits for the visitor to validate in the Sènè circle', async () => {
    await POST();
    const cycle = openCycle(circle('Sènè Circle').id);
    const cash = t('payment').filter((p) => p.cycleId === cycle.id);
    expect(cash).toHaveLength(2);
    expect(cash.every((p) => p.provider === 'CASH' && p.status === 'PENDING')).toBe(true);
    expect(t('payment')).toHaveLength(3);
  });

  it('starts the Badalabougou circle unsealed, with no cycle and one seat free', async () => {
    await POST();
    const sisters = circle('Badalabougou Sisters');
    expect(sisters.orderSealedAt).toBeNull();
    expect(t('cycle').some((c) => c.circleId === sisters.id)).toBe(false);
    const members = t('membership').filter((m) => m.circleId === sisters.id);
    expect(members).toHaveLength(5);
    expect(members.every((m) => m.turn === null)).toBe(true);
  });

  it('only writes rows that point at rows it created', async () => {
    await POST();
    const users = new Set([...ids('user'), 'me']);
    const circles = ids('circle');
    const memberships = ids('membership');
    const cycles = ids('cycle');
    expect(t('membership').every((m) => users.has(m.userId) && circles.has(m.circleId))).toBe(true);
    expect(t('cycle').every((c) => circles.has(c.circleId) && memberships.has(c.beneficiaryId))).toBe(true);
    expect(t('contribution').every((c) => memberships.has(c.membershipId) && cycles.has(c.cycleId))).toBe(true);
    expect(t('payment').every((p) => memberships.has(p.membershipId) && cycles.has(p.cycleId))).toBe(true);
    expect(t('ledgerEntry').every((l) => circles.has(l.circleId) && (!l.cycleId || cycles.has(l.cycleId)))).toBe(true);
  });

  it('never counts the same share twice', async () => {
    await POST();
    const keys = t('contribution').map((c) => `${c.membershipId}:${c.cycleId}`);
    expect(new Set(keys).size).toBe(keys.length);
  });
});
