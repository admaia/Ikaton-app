import { redirect } from 'next/navigation';
import { currentUser } from '@/lib/auth';

export default async function Root() {
  redirect((await currentUser()) ? '/home' : '/onboarding');
}
