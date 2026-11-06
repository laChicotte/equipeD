import { PublicAssistant } from '@/features/ai/assistant-widget';
import { AuthLayout } from '@/features/auth/components/auth-layout';

/** Connexion, inscription, mot de passe : sans en-tête ni pied de page marketing. */
export default function AuthGroupLayout({ children }: LayoutProps<'/'>) {
  return (
    <div className="flex min-h-dvh flex-col">
      <AuthLayout>{children}</AuthLayout>
      <PublicAssistant />
    </div>
  );
}
