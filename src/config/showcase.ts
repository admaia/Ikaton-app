export type Lang = 'en' | 'fr';

const shared = {
  author: 'Adama Aïssa Maïga',
  source: 'https://github.com/admaia/Ikaton-app',
  stack: ['Next.js 15', 'React 19', 'TypeScript', 'Tailwind 4', 'Motion', 'GSAP', 'Prisma', 'Supabase', 'PWA'],
};

export const showcase = {
  en: {
    ...shared,
    role: 'Design & development',
    pitch: 'A tontine app for West Africa. The savings circle everyone already knows, with a ledger no one can tamper with.',
    points: [
      { title: 'Every franc counted once', body: 'Payments expire, duplicate confirmations are ignored, forged ones are rejected. Try it: the demo operator lets you test every case.' },
      { title: 'Roles follow the circle', body: 'Manager in one circle, regular member in another. Permissions never leave the circle they belong to.' },
      { title: 'From 3 to 40 members', body: 'The gauge switches from segments to a single bar past 12 members; search appears past 13.' },
    ],
    sourceLabel: 'Source code',
    light: 'Light mode',
    dark: 'Dark mode',
    switchLang: 'Français',
    frameTitle: 'Ikàton — live demo',
    caption: 'Live app · click inside',
  },
  fr: {
    ...shared,
    role: 'Design & développement',
    pitch: 'Une app de tontine pour l’Afrique de l’Ouest. Le cercle d’épargne que tout le monde connaît, avec un carnet que personne ne peut falsifier.',
    points: [
      { title: 'Chaque franc compté une fois', body: 'Délais d’expiration, confirmations en double ignorées, fausses confirmations rejetées. Testez-le : l’opérateur de démo vous laisse tout essayer.' },
      { title: 'Le rôle suit le cercle', body: 'Gestionnaire dans un cercle, simple membre dans un autre. Les droits ne sortent jamais du cercle.' },
      { title: 'De 3 à 40 membres', body: 'La jauge passe de segments à une barre au-delà de 12, la recherche apparaît au-delà de 13.' },
    ],
    sourceLabel: 'Code source',
    light: 'Mode clair',
    dark: 'Mode sombre',
    switchLang: 'English',
    frameTitle: 'Ikàton — démo en direct',
    caption: 'L’app tourne en direct · cliquez dedans',
  },
} satisfies Record<Lang, unknown>;
