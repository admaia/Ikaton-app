import { requireUser } from '@/lib/auth';
import { BottomNav } from '@/components/BottomNav';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  await requireUser();
  return (
    <>
      <div className="pb-28">{children}</div>
      <BottomNav />
    </>
  );
}
