import type { Metadata } from 'next';
import { Suspense } from 'react';
import { ResetPasswordForm } from '@/features/auth/components/password-reset';

export const metadata: Metadata = {
  title: 'Nouveau mot de passe',
  // Le jeton figure dans l'URL : pas d'indexation ni de référent transmis.
  robots: { index: false, follow: false },
  referrer: 'no-referrer',
};

export default function ResetPasswordPage() {
  return (
    <Suspense>
      <ResetPasswordForm />
    </Suspense>
  );
}
