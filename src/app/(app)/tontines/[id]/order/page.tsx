import { notFound } from 'next/navigation';
import { requireUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { Eyebrow, Title } from '@/components/ui/Type';
import { getT } from '@/i18n/server';
import { OrderReveal } from './OrderReveal';

export default async function OrderPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { t } = await getT();
  const id = (await params).id;
  const circle = await prisma.circle.findFirst({
    where: { id, memberships: { some: { userId: user.id } } },
    include: { memberships: { where: { leftAt: null }, include: { user: true }, orderBy: { turn: 'asc' } } },
  });
  if (!circle || !circle.orderSealedAt) notFound();

  return (
    <main className="flex flex-col gap-8 px-6 pt-24">
      <div className="flex flex-col gap-3">
        <Eyebrow>{circle.orderMode === 'DRAW' ? t.order.drawn : t.order.fixed} · {t.order.sealed}</Eyebrow>
        <Title>{t.order.titleA}<br />{t.order.titleB}</Title>
      </div>
      <OrderReveal rows={circle.memberships.map((m) => ({ id: m.id, turn: m.turn ?? 0, name: m.user.name, isMe: m.userId === user.id }))} you={t.you} />
      {circle.orderCommit && (
        <p className="m-0 break-all text-[11px] text-muted">{t.order.commit(circle.orderCommit, circle.orderSeed)}</p>
      )}
    </main>
  );
}
