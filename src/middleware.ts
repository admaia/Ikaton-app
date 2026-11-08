import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

const PUBLIC = ['/onboarding', '/auth', '/offline', '/api/webhooks', '/api/cron', '/manifest.webmanifest', '/sw.js', '/icons'];

export async function middleware(req: NextRequest) {
  let res = NextResponse.next({ request: req });
  const supabase = createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    cookies: {
      getAll: () => req.cookies.getAll(),
      setAll: (list: { name: string; value: string; options: CookieOptions }[]) => {
        list.forEach(({ name, value }) => req.cookies.set(name, value));
        res = NextResponse.next({ request: req });
        list.forEach(({ name, value, options }) => res.cookies.set(name, value, options));
      },
    },
  });
  const { data } = await supabase.auth.getUser();
  const path = req.nextUrl.pathname;
  if (!data.user && !PUBLIC.some((p) => path.startsWith(p))) {
    if (path.startsWith('/api')) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    return NextResponse.redirect(new URL('/onboarding', req.url));
  }
  return res;
}

export const config = { matcher: ['/((?!_next/static|_next/image|assets|favicon.ico).*)'] };
