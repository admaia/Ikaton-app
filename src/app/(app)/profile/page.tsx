import { requireUser } from '@/lib/auth';
import { Eyebrow, Title } from '@/components/ui/Type';
import { ThemeToggle } from '@/components/BottomNav';

export default async function Profile() {
  const user = await requireUser();
  return (
    <main className="flex flex-col gap-8 px-6 pt-24">
      <div className="flex flex-col gap-3">
        <Eyebrow>{user.phone}</Eyebrow>
        <Title>{user.name}</Title>
      </div>
      <ThemeToggle />
    </main>
  );
}
