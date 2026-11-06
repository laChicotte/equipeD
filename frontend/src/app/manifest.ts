import type { MetadataRoute } from 'next';

/** Manifeste de l'application installable (écran d'accueil du téléphone, sans magasin d'applications). */
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: '/',
    name: 'TalentsConnect — Mentorat',
    short_name: 'TalentsConnect',
    description:
      'Trouvez un mentor, échangez par messages ou par appel audio, planifiez vos séances et suivez vos objectifs.',
    lang: 'fr',
    start_url: '/tableau-de-bord',
    scope: '/',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#ffffff',
    theme_color: '#12342a',
    categories: ['education', 'productivity'],
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
      {
        src: '/icons/icon-maskable-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
    shortcuts: [
      { name: 'Messages', url: '/messages' },
      { name: 'Séances', url: '/seances' },
      { name: 'Trouver un mentor', url: '/mentors' },
    ],
  };
}
