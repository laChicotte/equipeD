import { DemoBanner } from '@/components/layout/demo-banner';
import { AuthLayout } from '@/features/auth/components/auth-layout';

/** Connexion, inscription, mot de passe : sans en-tête ni pied de page marketing. */
export default function AuthGroupLayout({ children }: LayoutProps<'/'>) {
  return (
    <div className="flex min-h-dvh flex-col">
      <DemoBanner />
      <AuthLayout>{children}</AuthLayout>
    </div>
  );
}
