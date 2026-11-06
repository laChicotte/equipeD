import { closestWord, matchText, tokenize, wordMatch } from './search.js';

const fatoumata =
  'fatoumata camara developpeuse full stack developpement web react typescript node.js portfolio numerique et technologies';
const thierno =
  'thierno diallo entrepreneur business plan levee de fonds modele economique developpement commercial entrepreneuriat';

describe('recherche de mentors', () => {
  it('ignore les mots vides et garde les mots utiles', () => {
    expect(tokenize('Je cherche un mentor en marketing digital').map((t) => t.word)).toEqual([
      'marketing',
      'digital',
    ]);
    expect(tokenize('CV').map((t) => t.word)).toEqual(['cv']);
  });

  it('reconnaît les variantes, les préfixes et les fautes de frappe', () => {
    expect(wordMatch('developpeur', 'developpement')).toBeGreaterThan(0);
    expect(wordMatch('dev', 'developpement')).toBeGreaterThan(0);
    expect(wordMatch('markting', 'marketing')).toBeGreaterThan(0);
    expect(wordMatch('typscript', 'typescript')).toBeGreaterThan(0);
    expect(wordMatch('jardin', 'javascript')).toBe(0);
  });

  it('trouve un profil par synonyme et classe le plus pertinent devant', () => {
    const terms = tokenize('développeur web');
    expect(matchText(fatoumata, terms).matched).toBe(2);
    expect(matchText(thierno, terms).matched).toBe(1);
    expect(matchText(fatoumata, terms).score).toBeGreaterThan(matchText(thierno, terms).score);
    expect(matchText(thierno, tokenize('startup')).matched).toBe(1);
    expect(matchText(fatoumata, tokenize('ia')).matched).toBe(0);
  });

  it('propose une correction pour une faute de frappe', () => {
    expect(closestWord('cybersecurit', ['Cybersécurité', 'Marketing'])).toBe('Cybersécurité');
    expect(closestWord('zzzzzz', ['Cybersécurité', 'Marketing'])).toBeNull();
  });
});
