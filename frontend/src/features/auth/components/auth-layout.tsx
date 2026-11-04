import { CalendarCheck2, MessagesSquare, Target, Users } from 'lucide-react';
import type { ReactNode } from 'react';

const points = [
  { icon: Users, title: 'Des mentors choisis selon vos objectifs', text: 'Recherche par domaine, compétence, langue et disponibilité.' },
  { icon: MessagesSquare, title: 'Une conversation privée', text: 'Ouverte dès que le mentor accepte votre demande.' },
  { icon: CalendarCheck2, title: 'Des séances sans conflit', text: 'Réservation sur les créneaux réellement libres.' },
  { icon: Target, title: 'Des objectifs suivis', text: 'Jalons, progression et retours du mentor.' },
];

export function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="mx-auto grid w-full max-w-6xl gap-10 px-4 py-10 sm:px-8 lg:grid-cols-[minmax(0,1fr)_440px] lg:gap-16 lg:py-16">
      <section className="relative hidden overflow-hidden rounded-xl bg-ink-900 p-10 text-white lg:flex lg:flex-col lg:justify-between">
        <div className="pointer-events-none absolute inset-0 [background-size:32px_32px] [background-image:linear-gradient(to_right,rgb(255_255_255/0.05)_1px,transparent_1px),linear-gradient(to_bottom,rgb(255_255_255/0.05)_1px,transparent_1px)]" />
        <div className="pointer-events-none absolute -top-24 -right-24 size-80 rounded-full bg-teal-600/30 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-32 -left-16 size-72 rounded-full bg-amber-400/15 blur-3xl" />
        <div className="relative">
          <p className="text-sm font-semibold text-teal-200">Programme « Talents connectés »</p>
          <h2 className="mt-3 max-w-md text-3xl leading-tight font-semibold tracking-tight">
            Connecter les talents, transmettre les expériences.
          </h2>
        </div>
        <ul className="relative mt-10 grid gap-5">
          {points.map(({ icon: Icon, title, text }) => (
            <li key={title} className="flex gap-4">
              <span className="inline-flex size-10 shrink-0 items-center justify-center rounded-md bg-white/10 ring-1 ring-white/15">
                <Icon className="size-5 text-teal-200" aria-hidden />
              </span>
              <div>
                <p className="font-semibold">{title}</p>
                <p className="mt-0.5 text-sm text-ink-100/80">{text}</p>
              </div>
            </li>
          ))}
        </ul>
      </section>
      <section className="flex flex-col justify-center">{children}</section>
    </div>
  );
}
