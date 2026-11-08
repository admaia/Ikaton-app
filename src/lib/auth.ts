import 'server-only';
import { redirect } from 'next/navigation';
import { prisma } from './prisma';
import { supabaseServer } from './supabase/server';

export async function currentUser() {
  const sb = await supabaseServer();
  const { data } = await sb.auth.getUser();
  if (!data.user) return null;
  const phone = data.user.phone ? `+${data.user.phone.replace(/^\+/, '')}` : `anon:${data.user.id}`;
  return prisma.user.upsert({
    where: { id: data.user.id },
    update: {},
    create: { id: data.user.id, phone, name: (data.user.user_metadata?.name as string) || (data.user.is_anonymous ? 'Vous' : phone) },
  });
}

export async function requireUser() {
  const u = await currentUser();
  if (!u) redirect('/auth');
  return u;
}
