/**
 * Photographies réelles de Guinée issues de Wikimedia Commons (licences CC0 et CC BY-SA 4.0).
 * Elles montrent le monde du programme (Conakry, ateliers, jeunes en formation) et ne sont jamais
 * présentées comme des utilisateurs de la plateforme. Crédits complets : public/images/credits.json.
 */
export interface Photo {
  src: string;
  width: number;
  height: number;
  /** Description de ce que montre l'image (texte alternatif). */
  alt: string;
  /** Légende courte affichée sous l'image quand la mise en page le permet. */
  caption: string;
  creator: string;
  license: 'CC0' | 'CC BY-SA 4.0';
  page: string;
}

export const photos = {
  conakry: {
    src: '/images/conakry-vue-aerienne.jpg',
    width: 1920,
    height: 1440,
    alt: 'Vue aérienne de Conakry, ses immeubles et la mer, avec les îles de Loos à l’horizon',
    caption: 'Conakry et les îles de Loos',
    creator: 'Alpha hmd',
    license: 'CC BY-SA 4.0',
    page: 'https://commons.wikimedia.org/w/index.php?curid=77343543',
  },
  autrices: {
    src: '/images/atelier-autrices-conakry.jpg',
    width: 1920,
    height: 1440,
    alt: 'Des participantes réunies autour d’une table lors d’un atelier, une tablette à la main',
    caption: 'Atelier de la Quinzaine des autrices francophones, Conakry, 2024',
    creator: 'M keita1321',
    license: 'CC0',
    page: 'https://commons.wikimedia.org/wiki/File:Quinzaine_des_autrices_francophone_2024_Guin%C3%A9e_Conakry_12.jpg',
  },
  portrait: {
    src: '/images/atelier-celpac-portrait.jpg',
    width: 1920,
    height: 2560,
    alt: 'Une jeune femme en veste rayée, assise à une table de formation, attentive',
    caption: 'Atelier de formation au centre de lecture publique (CELPAC), Conakry, 2024',
    creator: 'M keita1321',
    license: 'CC0',
    page: 'https://commons.wikimedia.org/wiki/File:Atelier_de_formation_Wikip%C3%A9dia_au_centre_de_lecture_publique_et_d%27animation_culturelle_33.jpg',
  },
  formation: {
    src: '/images/formation-madina-wora.jpg',
    width: 1920,
    height: 1280,
    alt: 'Un intervenant de dos s’adresse à un groupe assis qui l’écoute',
    caption: 'Formation à la maison des jeunes de Madina Wora, 2021',
    creator: 'Aboubacarkhoraa',
    license: 'CC BY-SA 4.0',
    page: 'https://commons.wikimedia.org/wiki/File:Formation_a_la_maison_des_jeunes_de_Madina_Wora,_Guin%C3%A9e_16.jpg',
  },
  jeunes: {
    src: '/images/jeunes-wikimedia-guinee.jpg',
    width: 1920,
    height: 1440,
    alt: 'Un groupe de jeunes souriants pose dans une rue, une montagne en arrière-plan',
    caption: 'Bénévoles de Wikimedia Guinée, 2020',
    creator: 'Sayd224',
    license: 'CC BY-SA 4.0',
    page: 'https://commons.wikimedia.org/wiki/File:Wikimedien_de_Guin%C3%A9e.jpg',
  },
  classe: {
    src: '/images/lycee-hamdallaye-kamsar.jpg',
    width: 1920,
    height: 1277,
    alt: 'Une salle de classe remplie de jeunes assis à leurs bancs, concentrés',
    caption: 'Atelier Wiki Loves Africa au lycée Hamdallaye, Kamsar, 2019',
    creator: 'Aboubacarkhoraa',
    license: 'CC BY-SA 4.0',
    page: 'https://commons.wikimedia.org/wiki/File:Wiki_loves_Africa_au_lyc%C3%A9e_Hamdallaye_kamsar.jpg',
  },
} satisfies Record<string, Photo>;

export const allPhotos: Photo[] = Object.values(photos);
