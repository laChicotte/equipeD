import type { Metadata } from 'next';
import { ForgotPassword } from '@/features/auth/components/password-reset';

export const metadata: Metadata = { title: 'Mot de passe oublié' };

export default function ForgotPasswordPage() {
  return <ForgotPassword />;
}
