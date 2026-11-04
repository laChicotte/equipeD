import { cleanTags, normalizeSearch } from './text.js';

describe('normalizeSearch', () => {
  it('retire les accents, met en minuscules et compacte les espaces', () => {
    expect(normalizeSearch('  Développement   WEB, Aïssatou Élève ')).toBe(
      'developpement web, aissatou eleve',
    );
  });

  it('rend équivalentes les saisies avec et sans accents', () => {
    expect(normalizeSearch('Accompagnement des candidats Campus France')).toBe(
      normalizeSearch('accompagnement des candidats campus france'),
    );
    expect(normalizeSearch('Écriture et édition')).toBe('ecriture et edition');
  });
});

describe('cleanTags', () => {
  it('supprime les vides et les doublons sans tenir compte de la casse ni des accents', () => {
    expect(cleanTags(['  React ', 'react', '', 'Développement web', 'developpement WEB'])).toEqual([
      'React',
      'Développement web',
    ]);
  });
});
