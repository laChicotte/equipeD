'use client';

import { useEffect } from 'react';

/**
 * Fait apparaître une seule fois les éléments [data-reveal] et .shutter quand ils entrent dans
 * l'écran. Sans JavaScript (pas de classe `js`), le contenu reste visible : rien n'est masqué.
 * `deps` permet de réobserver les éléments rendus après un chargement de données.
 */
export function useReveal(deps: unknown[] = []) {
  useEffect(() => {
    const targets = document.querySelectorAll<HTMLElement>('[data-reveal]:not(.is-in), .shutter:not(.is-in)');
    if (!('IntersectionObserver' in window)) {
      targets.forEach((el) => el.classList.add('is-in'));
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            e.target.classList.add('is-in');
            io.unobserve(e.target);
          }
        }
      },
      { rootMargin: '0px 0px -10% 0px', threshold: 0.08 },
    );
    targets.forEach((el) => io.observe(el));
    return () => io.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}
