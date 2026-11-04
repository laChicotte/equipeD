import Link from 'next/link';
import { LogoMark } from '@/components/layout/logo';
import { Button } from '@/components/ui/button';

export default function NotFound() {
  return (
    <main id="contenu" className="flex min-h-dvh flex-col items-center justify-center px-6 text-center">
      <LogoMark className="size-12" />
      <p className="mt-8 text-sm font-semibold text-teal-700">Erreur 404</p>
      <h1 className="mt-2 text-4xl font-display font-semibold tracking-[-0.03em] text-ink-900">Cette page n’existe pas</h1>
      <p className="mt-3 max-w-md text-muted-foreground">
        Le lien est peut-être incorrect, ou la page a été déplacée.
      </p>
      <div className="mt-8 flex flex-col gap-3 sm:flex-row">
        <Button asChild>
          <Link href="/">Retour à l’accueil</Link>
        </Button>
        <Button asChild variant="secondary">
          <Link href="/mentors">Trouver un mentor</Link>
        </Button>
      </div>
    </main>
  );
}
