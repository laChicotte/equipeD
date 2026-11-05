/**
 * Logique pure de l'assistance par IA : minimisation des données envoyées au fournisseur
 * et validation stricte de ses réponses. La sortie du modèle n'est jamais considérée comme fiable.
 */

/** Retire ce qui identifie directement une personne dans un texte libre. */
export function scrubPersonalData(text: string): string {
  return text
    .replace(/[\w.+-]+@[\w-]+(\.[\w-]+)+/g, '[email retiré]')
    .replace(/https?:\/\/\S+/gi, '[lien retiré]')
    .replace(/(?:\+|00)?\d(?:[\s.-]?\d){7,}/g, '[numéro retiré]')
    .trim();
}

const text = (value: unknown, max: number): string | null => {
  if (typeof value !== 'string') return null;
  const clean = value.replace(/\s+/g, ' ').trim();
  return clean.length > 0 ? clean.slice(0, max) : null;
};

const asArray = (value: unknown): unknown[] => (Array.isArray(value) ? value : []);

export interface OrientationResult {
  summary: string;
  domains: { id: string; slug: string; name: string; reason: string }[];
  skills: string[];
}

/** Domaines limités au catalogue réel : un domaine inventé par le modèle est écarté. */
export function parseOrientation(
  raw: unknown,
  catalog: { id: string; slug: string; name: string }[],
): OrientationResult | null {
  const data = (raw ?? {}) as Record<string, unknown>;
  const summary = text(data.summary, 400);
  const seen = new Set<string>();
  const domains: OrientationResult['domains'] = [];
  for (const item of asArray(data.domains)) {
    const entry = (item ?? {}) as Record<string, unknown>;
    const domain = catalog.find((d) => d.slug === entry.slug);
    const reason = text(entry.reason, 240);
    if (!domain || !reason || seen.has(domain.slug)) continue;
    seen.add(domain.slug);
    domains.push({ id: domain.id, slug: domain.slug, name: domain.name, reason });
  }
  const skills = [
    ...new Set(
      asArray(data.skills)
        .map((s) => text(s, 50))
        .filter((s): s is string => !!s && s.length >= 2),
    ),
  ].slice(0, 6);
  if (!summary || domains.length === 0) return null;
  return { summary, domains: domains.slice(0, 3), skills };
}

export function parseExplanation(raw: unknown): string | null {
  return text((raw as { explanation?: unknown } | null)?.explanation, 320);
}

export interface PathProposal {
  goals: { title: string; description: string; milestones: string[] }[];
}

/** Mêmes bornes que la création d'un objectif : la proposition reste applicable telle quelle. */
export function parsePathProposal(
  raw: unknown,
  existingTitles: string[] = [],
): PathProposal | null {
  const existing = new Set(existingTitles.map((t) => t.toLowerCase()));
  const goals: PathProposal['goals'] = [];
  for (const item of asArray((raw as { goals?: unknown } | null)?.goals)) {
    const entry = (item ?? {}) as Record<string, unknown>;
    const title = text(entry.title, 160);
    if (!title || title.length < 3 || existing.has(title.toLowerCase())) continue;
    const milestones = asArray(entry.milestones)
      .map((m) => text(m, 160))
      .filter((m): m is string => !!m && m.length >= 2)
      .slice(0, 6);
    if (milestones.length === 0) continue;
    existing.add(title.toLowerCase());
    goals.push({ title, description: text(entry.description, 600) ?? '', milestones });
  }
  return goals.length > 0 ? { goals: goals.slice(0, 3) } : null;
}
