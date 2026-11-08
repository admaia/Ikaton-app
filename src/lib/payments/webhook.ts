import 'server-only';
import type { Prisma, Provider } from '@prisma/client';
import { prisma } from '@/lib/prisma';

export async function claimEvent(provider: Provider, eventId: string, signatureOk: boolean, payload: Prisma.InputJsonValue) {
  const ev = await prisma.webhookEvent.upsert({
    where: { provider_eventId: { provider, eventId } },
    update: {},
    create: { provider, eventId, signatureOk, payload },
  });
  return ev.processedAt ? null : ev;
}

export const markProcessed = (id: string, result: string) =>
  prisma.webhookEvent.update({ where: { id }, data: { processedAt: new Date(), result } });
