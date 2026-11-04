/** Minuscules, sans accents ni espaces superflus : base de la recherche insensible aux accents. */
export function normalizeSearch(input: string): string {
  return input
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '') // retire les accents décomposés par NFD
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

/** Nettoie une liste de libellés libres : trim, suppression des vides et doublons (insensible à la casse). */
export function cleanTags(values: string[] | undefined): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of values ?? []) {
    const value = raw.trim().replace(/\s+/g, ' ');
    const key = normalizeSearch(value);
    if (value && !seen.has(key)) {
      seen.add(key);
      out.push(value);
    }
  }
  return out;
}
