import { notFound } from 'next/navigation';
import { requireUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { Eyebrow, Title } from '@/components/ui/Type';
import { OrderReveal } from './OrderReveal';

export default async function OrderPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const id = (await params).id;
  const circle = await prisma.circle.findFirst({
    where: { id, memberships: { some: { userId: user.id } } },
    include: { memberships: { where: { leftAt: null }, include: { user: true }, orderBy: { turn: 'asc' } } },
  });
  if (!circle || !circle.orderSealedAt) notFound();

  return (
    <main className="flex flex-col gap-8 px-6 pt-24">
      <div className="flex flex-col gap-3">
        <Eyebrow>{circle.orderMode === 'DRAW' ? 'Tiré au sort' : 'Fixé par le gestionnaire'} · scellé</Eyebrow>
        <Title>L’ordre<br />des tours</Title>
      </div>
      <OrderReveal rows={circle.memberships.map((m) => ({ id: m.id, turn: m.turn ?? 0, name: m.user.name, isMe: m.userId === user.id }))} />
      {circle.orderCommit && (
        <p className="m-0 break-all text-[11px] text-muted">Empreinte publiée avant le tirage : {circle.orderCommit}{circle.orderSeed ? ` · graine : ${circle.orderSeed}` : ''}</p>
      )}
    </main>
  );
}
