import Image from 'next/image';
import type { ReactNode } from 'react';
import { photos } from '@/lib/photos';

const points = [
  'Des mentors choisis selon vos objectifs, avec des suggestions expliquées.',
  'Une conversation privée, ouverte dès que le mentor accepte.',
  'Des séances réservées sur des créneaux réellement libres.',
  'Des objectifs découpés en jalons et suivis à deux.',
];

/** Connexion et inscription : le formulaire à droite, une photographie du programme à gauche. */
export function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="grid min-h-[calc(100dvh-6rem)] lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <section className="relative hidden overflow-hidden bg-ink-900 lg:block">
        <Image
          src={photos.mentor.src}
          alt={photos.mentor.alt}
          fill
          sizes="50vw"
          priority
          className="photo object-cover object-[50%_30%] opacity-90"
        />
        <div className="absolute inset-x-0 bottom-0 bg-ink-950/80 p-10 text-white">
          <h2 className="max-w-[18ch] font-display text-4xl leading-[1.05] font-semibold tracking-[-0.03em]">
            Connecter les talents, transmettre les expériences.
          </h2>
          <ul className="mt-6 grid max-w-[46ch] gap-2 text-[17px] leading-snug text-ink-100">
            {points.map((p) => (
              <li key={p}>{p}</li>
            ))}
          </ul>
          <p className="mt-6 text-sm text-ink-100/70">
            Photo : {photos.mentor.caption} · {photos.mentor.creator}, {photos.mentor.license}
          </p>
        </div>
      </section>
      <section className="page-frame flex flex-col justify-center py-12 lg:px-16 xl:px-24">
        <div className="mx-auto w-full max-w-[440px]">{children}</div>
      </section>
    </div>
  );
}
