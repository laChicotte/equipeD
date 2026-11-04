import type { Metadata, Viewport } from 'next';
import { Schibsted_Grotesk } from 'next/font/google';
import { Providers } from '@/components/providers';
import './globals.css';

const schibsted = Schibsted_Grotesk({
  variable: '--font-schibsted',
  subsets: ['latin'],
  weight: ['400', '500', '600', '800'],
  display: 'swap',
});

export const metadata: Metadata = {
  title: {
    default: 'Talents Connectés — Trouvez votre mentor en Guinée',
    template: '%s · Talents Connectés',
  },
  description:
    'Étudiants, jeunes diplômés, porteurs de projets : trouvez un mentor expérimenté, échangez en privé, planifiez vos séances et suivez vos objectifs.',
};

export const viewport: Viewport = {
  themeColor: '#172A46',
  width: 'device-width',
  initialScale: 1,
};

/** Active les animations d'entrée uniquement si JavaScript s'exécute (sinon tout reste visible). */
const enableMotion = "document.documentElement.classList.add('js')";

export default function RootLayout({ children }: LayoutProps<'/'>) {
  return (
    <html lang="fr" className={`${schibsted.variable} h-full`} suppressHydrationWarning>
      <body className="min-h-full">
        <script dangerouslySetInnerHTML={{ __html: enableMotion }} />
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
