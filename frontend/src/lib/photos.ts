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
  license: 'CC0' | 'CC BY 4.0' | 'CC BY-SA 4.0';
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
  lyceennes: {
    src: '/images/lyceennes-ordinateur.jpg',
    width: 1920,
    height: 1279,
    alt: 'Cinq lycéennes réunies autour d’un ordinateur portable, en plein air, souriantes',
    caption: 'Lycéennes autour d’un ordinateur, Ghana, 2024',
    creator: 'Bright Kwame Ayisi',
    license: 'CC0',
    page: 'https://commons.wikimedia.org/wiki/File:A_group_of_female_students_looking_on_a_laptop_01.jpg',
  },
  eleves: {
    src: '/images/eleves-ordinateur.jpg',
    width: 1920,
    height: 1279,
    alt: 'Des élèves penchés ensemble sur un ordinateur portable, concentrés et souriants',
    caption: 'Élèves au travail sur un ordinateur, Ghana, 2024',
    creator: 'Bright Kwame Ayisi',
    license: 'CC0',
    page: 'https://commons.wikimedia.org/wiki/File:Students_using_a_computer_laptop_01.jpg',
  },
  mentor: {
    src: '/images/mentor-accompagne.jpg',
    width: 1430,
    height: 1000,
    alt: 'Un formateur se penche vers l’écran d’une participante pour la guider, dans une salle équipée d’ordinateurs',
    caption: 'Formation Wiki Mentor Africa Hackathon, Tamale (Ghana)',
    creator: 'Ruky Wunpini',
    license: 'CC BY 4.0',
    page: 'https://commons.wikimedia.org/wiki/File:Wiki_Mentor_Africa_Hackathon_Training_in_Tamale_01.jpg',
  },
  communaute: {
    src: '/images/communaute-atelier.jpg',
    width: 1430,
    height: 1000,
    alt: 'Un grand groupe de participants souriants fait un signe de la main à la fin d’un atelier',
    caption: 'Participants d’un atelier Wiki Mentor Africa, Tamale (Ghana)',
    creator: 'Ruky Wunpini',
    license: 'CC BY 4.0',
    page: 'https://commons.wikimedia.org/wiki/File:Wiki_Mentor_Africa_Hackathon_Training_in_Tamale_17.jpg',
  },
  conakryCentre: {
    src: '/images/conakry-centre.jpg',
    width: 1920,
    height: 1085,
    alt: 'Vue aérienne du centre de Conakry, ses immeubles, ses toits colorés, une mosquée et la mer',
    caption: 'Le centre de Conakry vu du ciel, 2021',
    creator: 'Boubacar Bila Diao Balde',
    license: 'CC BY-SA 4.0',
    page: 'https://commons.wikimedia.org/wiki/File:Ville_de_Conaky.jpg',
  },
  loos: {
    src: '/images/iles-de-loos.jpg',
    width: 1280,
    height: 2048,
    alt: 'Image satellite de la presqu’île de Conakry et des îles de Loos dans une mer turquoise',
    caption: 'La presqu’île de Conakry et les îles de Loos vues par satellite',
    creator: 'Axelspace Corporation',
    license: 'CC BY-SA 4.0',
    page: 'https://commons.wikimedia.org/w/index.php?curid=76430075',
  },
} satisfies Record<string, Photo>;

export const allPhotos: Photo[] = Object.values(photos);
