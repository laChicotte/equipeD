import type { Metadata } from 'next';
import { Onboarding } from '@/features/onboarding/onboarding';

export const metadata: Metadata = { title: 'Mon profil' };

export default function OnboardingPage() {
  return <Onboarding />;
}
