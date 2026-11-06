import type { Metadata, Viewport } from 'next';
import localFont from 'next/font/local';
import { Providers } from '@/components/providers';
import { dataSaverBootScript } from '@/lib/data-saver-boot';
import './globals.css';

// Polices intégrées au dépôt (licence SIL OFL, fichiers Fontsource) : la construction ne dépend
// pas de Google Fonts, et aucune requête vers Google n'est faite à l'affichage.
const schibsted = localFont({
  src: './fonts/schibsted-grotesk-latin.woff2',
  variable: '--font-schibsted',
  weight: '400 900',
  display: 'swap',
});

const lexend = localFont({
  src: './fonts/lexend-latin.woff2',
  variable: '--font-lexend',
  weight: '100 900',
  display: 'swap',
});

export const metadata: Metadata = {
  title: {
    default: 'TalentsConnect — Trouvez votre mentor en Guinée',
    template: '%s · TalentsConnect',
  },
  description:
    'Étudiants, jeunes diplômés, porteurs de projets : trouvez un mentor expérimenté, échangez en privé, planifiez vos séances et suivez vos objectifs.',
  applicationName: 'TalentsConnect',
  appleWebApp: { capable: true, title: 'TalentsConnect', statusBarStyle: 'default' },
  icons: { apple: '/icons/apple-touch-icon.png' },
};

export const viewport: Viewport = {
  themeColor: '#12342a',
  width: 'device-width',
  initialScale: 1,
};

/** Active les animations d'entrée uniquement si JavaScript s'exécute (sinon tout reste visible). */
const enableMotion = "document.documentElement.classList.add('js');";

export default function RootLayout({ children }: LayoutProps<'/'>) {
  return (
    <html
      lang="fr"
      className={`${schibsted.variable} ${lexend.variable} h-full`}
      data-scroll-behavior="smooth"
      suppressHydrationWarning
    >
      {/* suppressHydrationWarning : certaines extensions (ColorZilla…) ajoutent des attributs au body. */}
      <body className="min-h-full" suppressHydrationWarning>
        <script dangerouslySetInnerHTML={{ __html: enableMotion + dataSaverBootScript }} />
        <a
          href="#contenu"
          className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-[80] focus:rounded-md focus:bg-ink-900 focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-white"
        >
          Aller au contenu
        </a>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
