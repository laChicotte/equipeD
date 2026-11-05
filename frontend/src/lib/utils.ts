import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

export const isDemoMode = process.env.NEXT_PUBLIC_DEMO_MODE === 'true';

/** Membre de l'équipe de la plateforme (administrateur ou super-administrateur). */
export function isStaff(role: string | undefined | null): boolean {
  return role === 'ADMIN' || role === 'SUPER_ADMIN';
}
