import {
  BookOpen,
  Code,
  Compass,
  GraduationCap,
  Landmark,
  Rocket,
  Sparkles,
  Layers,
  type LucideIcon,
} from 'lucide-react';

const icons: Record<string, LucideIcon> = {
  rocket: Rocket,
  code: Code,
  compass: Compass,
  'book-open': BookOpen,
  landmark: Landmark,
  sparkles: Sparkles,
  'graduation-cap': GraduationCap,
};

export function DomainIcon({ name, className }: { name: string; className?: string }) {
  const Icon = icons[name] ?? Layers;
  return <Icon className={className} aria-hidden />;
}
