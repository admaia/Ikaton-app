import { beforeEach, describe, expect, it, vi } from 'vitest';

const db = vi.hoisted(() => ({ upsert: vi.fn(), update: vi.fn() }));

vi.mock('server-only', () => ({}));
vi.mock('@/lib/prisma', () => ({ prisma: { webhookEvent: { upsert: db.upsert, update: db.update } } }));

import { claimEvent, markProcessed } from '@/lib/payments/webhook';

beforeEach(() => vi.clearAllMocks());

describe('webhook events', () => {
  it('claims an event the first time it is seen', async () => {
    const row = { id: 'event-1', processedAt: null };
    db.upsert.mockResolvedValue(row);
    expect(await claimEvent('WAVE', 'evt_1', true, { id: 'evt_1' })).toBe(row);
    expect(db.upsert).toHaveBeenCalledWith({
      where: { provider_eventId: { provider: 'WAVE', eventId: 'evt_1' } },
      update: {},
      create: { provider: 'WAVE', eventId: 'evt_1', signatureOk: true, payload: { id: 'evt_1' } },
    });
  });

  it('refuses an event that was already processed', async () => {
    db.upsert.mockResolvedValue({ id: 'event-1', processedAt: new Date() });
    expect(await claimEvent('WAVE', 'evt_1', true, {})).toBeNull();
  });

  it('records the outcome with the time it was processed', async () => {
    await markProcessed('event-1', 'confirmed');
    expect(db.update).toHaveBeenCalledWith({ where: { id: 'event-1' }, data: { processedAt: expect.any(Date), result: 'confirmed' } });
  });
});
