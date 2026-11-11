import 'server-only';
import { cookies } from 'next/headers';
import { dict, LANG_COOKIE, parseLang } from './dict';

export async function getLang() {
  return parseLang((await cookies()).get(LANG_COOKIE)?.value);
}

export async function getT() {
  const lang = await getLang();
  return { lang, t: dict[lang] };
}
