import type { Metadata, Viewport } from 'next';
import { DM_Serif_Display, Manrope } from 'next/font/google';
import { SmoothScroll } from '@/components/SmoothScroll';
import { DesktopShell } from '@/components/DesktopShell';
import { RegisterSW } from '@/components/RegisterSW';
import { LangProvider } from '@/i18n/client';
import { getLang } from '@/i18n/server';
import './globals.css';

const serif = DM_Serif_Display({ subsets: ['latin'], weight: '400', style: ['normal', 'italic'], variable: '--font-dm-serif' });
const sans = Manrope({ subsets: ['latin'], weight: ['400', '500', '600', '700', '800'], variable: '--font-manrope' });

export async function generateMetadata(): Promise<Metadata> {
  const fr = (await getLang()) === 'fr';
  return {
    title: fr ? 'Ikàton, la tontine en ligne' : 'Ikàton, the savings circle app',
    description: fr
      ? 'Chacun cotise, chacun reçoit son tour. Ikàton tient le carnet.'
      : 'Everyone pays in, everyone gets their turn. Ikàton keeps the book.',
    applicationName: 'Ikàton',
    appleWebApp: { capable: true, title: 'Ikàton', statusBarStyle: 'default' },
    icons: { icon: '/icons/icon-192.png', apple: '/icons/apple-touch-icon.png' },
    formatDetection: { telephone: false },
  };
}
export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#F9F7F4' },
    { media: '(prefers-color-scheme: dark)', color: '#121413' },
  ],
};

// Runs before paint so the theme and the desktop showcase never flash.
const bootScript = `try{var d=document.documentElement,t=localStorage.getItem('ikaton-theme')||(matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light');if(t==='dark')d.classList.add('dark');if(matchMedia('(min-width: 1024px)').matches&&window.self===window.top&&!matchMedia('(display-mode: standalone)').matches)d.dataset.shell='showcase'}catch(e){}`;

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const lang = await getLang();
  return (
    <html lang={lang} className={`${serif.variable} ${sans.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: bootScript }} />
      </head>
      <body className="min-h-dvh bg-paper text-ink">
        <SmoothScroll />
        <RegisterSW />
        <LangProvider lang={lang}>
          <DesktopShell>{children}</DesktopShell>
        </LangProvider>
      </body>
    </html>
  );
}
