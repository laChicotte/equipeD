/**
 * Recherche « intelligente » dans l'annuaire : sans accents ni casse, tolérante aux variantes
 * (développeur / développement), aux fautes de frappe et aux synonymes courants.
 * Fonctions pures, testées dans search.spec.ts.
 */
import { normalizeSearch } from '../../common/text.js';

/** Mots vides : ils n'aident pas à trouver un mentor (« je cherche un mentor en marketing »). */
const STOPWORDS = new Set(
  (
    'a au aux avec ce ces dans de des du en et je j la le les leur mon ma mes ne ou par pas pour ' +
    'qui que quoi sur un une vos votre veux voudrais cherche recherche besoin aide aider ' +
    'mentor mentors mentore mentorat trouver quelqu quelqu un d l qu s t y'
  ).split(' '),
);

/**
 * Synonymes et équivalents : chaque mot saisi est aussi cherché sous ces formes.
 * Clés et valeurs déjà normalisées (minuscules, sans accents).
 */
const SYNONYMS: Record<string, string[]> = {
  dev: ['developpement', 'developpeur', 'programmation'],
  developpeur: ['developpement', 'programmation'],
  programmeur: ['developpement', 'programmation'],
  code: ['developpement', 'programmation'],
  coder: ['developpement', 'programmation'],
  informatique: ['numerique', 'developpement', 'technologies'],
  tech: ['numerique', 'technologies'],
  digital: ['numerique', 'marketing'],
  site: ['web'],
  ia: ['intelligence artificielle'],
  ai: ['intelligence artificielle'],
  data: ['donnees'],
  securite: ['cybersecurite'],
  cyber: ['cybersecurite'],
  startup: ['entrepreneuriat', 'entreprise', 'levee de fonds'],
  entreprise: ['entrepreneuriat'],
  entrepreneur: ['entrepreneuriat'],
  business: ['entrepreneuriat', 'business plan', 'commercial'],
  argent: ['finance', 'levee de fonds'],
  financement: ['levee de fonds', 'finance'],
  compta: ['comptabilite', 'finance'],
  emploi: ['insertion professionnelle', 'cv', 'entretien'],
  job: ['insertion professionnelle', 'cv', 'entretien'],
  travail: ['insertion professionnelle', 'emploi'],
  stage: ['insertion professionnelle', 'cv'],
  curriculum: ['cv'],
  etudes: ['orientation', 'campus france'],
  france: ['campus france'],
  visa: ['campus france'],
  parler: ['prise de parole'],
  oral: ['prise de parole'],
  manager: ['management', 'leadership'],
  chef: ['management', 'gestion de projets'],
  ecrire: ['ecriture', 'edition'],
  livre: ['ecriture', 'edition'],
  culture: ['culturel', 'creatives'],
  english: ['anglais'],
};

export interface SearchTerm {
  /** Mot saisi (normalisé). */
  word: string;
  /** Formes acceptées : le mot et ses synonymes. */
  forms: string[];
}

export function tokenize(query: string): SearchTerm[] {
  const words = normalizeSearch(query)
    .split(/[^a-z0-9+#]+/)
    .filter((w) => w.length > 1 && !STOPWORDS.has(w));
  const unique = [...new Set(words)].slice(0, 8);
  // Un mot isolé de 2 lettres (« ia », « cv ») reste cherché, les autres sont trop vagues.
  return unique
    .filter((w) => w.length > 2 || SYNONYMS[w] || unique.length === 1)
    .map((word) => ({ word, forms: [word, ...(SYNONYMS[word] ?? [])] }));
}

/** Distance d'édition bornée (au-delà de `max`, renvoie max + 1). */
export function editDistance(a: string, b: string, max = 2): number {
  if (Math.abs(a.length - b.length) > max) return max + 1;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    let rowMin = i;
    for (let j = 1; j <= b.length; j++) {
      const v = Math.min(
        prev[j] + 1,
        cur[j - 1] + 1,
        prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
      cur.push(v);
      rowMin = Math.min(rowMin, v);
    }
    if (rowMin > max) return max + 1;
    prev = cur;
  }
  return prev[b.length];
}

const commonPrefix = (a: string, b: string) => {
  let i = 0;
  while (i < a.length && i < b.length && a[i] === b[i]) i++;
  return i;
};

/**
 * Force de la correspondance d'un mot avec un mot du profil (0 : aucune, 1 : exacte).
 * - préfixe : « dev » → « developpement », « market » → « marketing » ;
 * - même racine : « developpeur » ↔ « developpement » (6 premières lettres communes) ;
 * - faute de frappe : « markting » → « marketing », « cyberscurite » → « cybersecurite ».
 */
export function wordMatch(term: string, word: string): number {
  if (term === word) return 1;
  if (term.length >= 2 && word.startsWith(term)) return term.length >= 3 ? 0.9 : 0.6;
  const prefix = commonPrefix(term, word);
  if (prefix >= 6 || (prefix >= 5 && prefix >= Math.min(term.length, word.length) - 2)) return 0.8;
  if (term.length >= 5) {
    const tolerance = term.length >= 8 ? 2 : 1;
    // Compare aussi au début du mot du profil (« markt » ~ « marketing »).
    const d = Math.min(
      editDistance(term, word, tolerance),
      editDistance(term, word.slice(0, term.length), tolerance),
    );
    if (d <= tolerance) return 0.7 - 0.1 * d;
  }
  return 0;
}

function formScore(form: string, words: string[], text: string): number {
  // Expression de plusieurs mots (« levee de fonds ») : recherchée telle quelle.
  if (form.includes(' ')) return text.includes(form) ? 0.95 : 0;
  let best = 0;
  for (const w of words) {
    const s = wordMatch(form, w);
    if (s > best) best = s;
    if (best === 1) break;
  }
  return best;
}

export interface TextMatch {
  /** Nombre de mots de la recherche retrouvés dans le profil. */
  matched: number;
  /** Pertinence (plus haut = meilleur). */
  score: number;
}

/** `text` : texte de recherche du profil (déjà normalisé, voir mentorSearchText). */
export function matchText(text: string, terms: SearchTerm[], phrase = ''): TextMatch {
  const words = [...new Set(text.split(/[^a-z0-9+#]+/).filter(Boolean))];
  let matched = 0;
  let score = 0;
  for (const t of terms) {
    let best = 0;
    for (const [i, form] of t.forms.entries()) {
      // Un synonyme compte un peu moins que le mot saisi.
      const s = formScore(form, words, text) * (i === 0 ? 1 : 0.85);
      if (s > best) best = s;
    }
    if (best > 0) {
      matched += 1;
      score += best;
    }
  }
  if (phrase.length > 3 && text.includes(phrase)) score += 1;
  return { matched, score };
}

/** Mot du vocabulaire le plus proche d'un mot saisi : « Vouliez-vous dire… ? ». */
export function closestWord(term: string, vocabulary: Iterable<string>): string | null {
  let best: { word: string; d: number } | null = null;
  for (const v of vocabulary) {
    if (v.length < 3) continue;
    const d = editDistance(term, normalizeSearch(v), 3);
    if (d <= 3 && d < Math.max(2, term.length / 2) && (!best || d < best.d)) best = { word: v, d };
  }
  return best?.word ?? null;
}
