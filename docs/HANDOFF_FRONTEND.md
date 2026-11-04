# Passation frontend — Talents Connectés

> Document destiné à la session Claude Code qui construit le **frontend Next.js** sur un autre poste.
> À lire **en entier** avec `CLAUDE.md`, puis `PROMPT_CLAUDE_CODE_HACKATHON_MENTORAT_2026.md` (cahier de mission)
> et `TDR_Hackathon_Talents_Connectes_Mentorat_2026.md` (termes de référence, source métier prioritaire).

---

## 1. Résumé : où en est le projet (4 novembre 2026)

**Produit :** plateforme de mentorat professionnel pour le hackathon « Talents connectés » (Conakry, 4–7 novembre 2026).
Nom provisoire et remplaçable : « Talents Connectés » (ce n'est ni une marque déposée ni un nom officiel).

**Monorepo pnpm :**

```text
mentorat/  (dépôt GitHub laChicotte/equipeD)
├── backend/    NestJS 12 + Prisma 7 + PostgreSQL 17   ← TERMINÉ (P0 + l'essentiel du P1, testé)
│               (+ docker-compose.yml : PostgreSQL, port 127.0.0.1:5450)
├── frontend/   Next.js 16.4.5 (scaffold create-next-app) ← À CONSTRUIRE (ta mission)
├── docs/       documentation (ce fichier)
├── CLAUDE.md   conventions et état du projet
└── package.json / pnpm-workspace.yaml
```

### Backend : état vérifié

Tout ce qui suit a été **réellement exécuté** contre PostgreSQL, à l'aide d'un test de fumée HTTP (27 vérifications, toutes au vert) :

| Fonction | État |
|---|---|
| Inscription / connexion / déconnexion / `me` (cookie HttpOnly, Argon2id) | ✅ |
| Doublon d'email → 409 ; formulaire invalide → 422 avec le détail par champ ; mauvais mot de passe → 401 | ✅ |
| Catalogue des 7 domaines des TDR | ✅ |
| Annuaire avec filtres, recherche insensible aux accents (« developpement web » trouve « Développement web ») | ✅ |
| Suggestions explicables (score déterministe et raisons lisibles) | ✅ |
| Demande motivée → PENDING ; deuxième demande → 409 ; décision par un tiers → 403 | ✅ |
| Acceptation (idempotente) → création du mentorat ACTIVE ; refus après acceptation → 409 | ✅ |
| Protection CSRF : requête depuis une origine étrangère → 403 | ✅ |
| Réservation : **2 requêtes simultanées sur le même créneau → 201 + 409** | ✅ |
| Réservation sans mentorat actif → 403 ; confirmation par le mentor → CONFIRMED | ✅ |
| Messagerie privée persistée ; lecture par un tiers → 403 | ✅ |
| Objectifs et jalons : progression recalculée ; retour du mentor réservé au mentor (sinon 403) | ✅ |
| Tableau de bord par rôle ; 401 sans session ; Swagger sur `/api/docs` | ✅ |
| Admin minimal (vue d'ensemble, utilisateurs, suspension, vérification et publication des mentors) | ✅ (API seulement) |

Tests : **8 unitaires et 70 e2e** (Vitest et supertest sur un vrai PostgreSQL de test), typecheck, lint et build OK. CI GitHub Actions dans `.github/workflows/ci.yml`.
Évaluation des séances (note 1 à 5 et commentaire) disponible, avec la note moyenne affichée sur les fiches mentor.
**Pas encore fait côté backend :** ressources partagées, notifications, emails.
→ **Ne crée pas de faux écrans pour ces fonctions.** Si l'une d'elles devient nécessaire, demande d'abord qu'on ajoute l'endpoint.

---

## 2. Démarrer l'environnement sur ton poste

Prérequis : Node ≥ 22.12 (testé avec 24.13), pnpm 10.22, Docker Desktop démarré.

```bash
git clone https://github.com/laChicotte/equipeD.git mentorat && cd mentorat
pnpm install
pnpm db:up                                  # PostgreSQL 17 sur 127.0.0.1:5450
cp backend/.env.example backend/.env        # puis remplacer SESSION_SECRET (voir commentaire dans le fichier)
pnpm db:deploy                              # applique les migrations
pnpm db:seed                                # domaines + comptes fictifs + créneaux (idempotent)
pnpm dev:backend                            # API sur http://localhost:4000/api/v1, docs sur /api/docs
pnpm dev:frontend                           # Next.js sur http://localhost:3000
```

Si le port 5450 est occupé, change `POSTGRES_PORT` **et** `DATABASE_URL` dans `backend/.env`.
Pour remettre le parcours de démo à zéro (supprime les relations d'Aminata et les comptes `@example.test`) : `pnpm db:demo-reset`.

### Comptes de démonstration (développement uniquement, données fictives)

Mot de passe commun : **`Mentorat2026!`**

| Rôle | Email | Remarque |
|---|---|---|
| Mentorée | `aminata@demo.talents-connectes.test` | **Parcours principal** : aucune relation au départ |
| Mentorée | `mohamed@demo.talents-connectes.test` | Déjà accompagné par Thierno (objectif et messages existants) |
| Mentore | `fatoumata@demo.talents-connectes.test` | Développement web, vérifiée : la cible de la démo |
| Mentor | `thierno@demo.talents-connectes.test` | Entrepreneuriat et finance |
| Mentore | `mariama@demo.talents-connectes.test` | Campus France et orientation |
| Mentor | `sekou@demo.talents-connectes.test` | Cybersécurité et IA (vérification en attente) |
| Mentore | `aissatou@demo.talents-connectes.test` | Édition et création de contenu |
| Mentor | `lansana@demo.talents-connectes.test` | Leadership et prise de parole |
| Admin | `admin@demo.talents-connectes.test` | Modération |

---

## 3. Règles d'intégration frontend ↔ API (impératives)

1. **Proxy même origine.** Le navigateur ne parle **qu'à Next.js** : configure `rewrites` dans `frontend/next.config.ts`,
   `/api/v1/:path*` → `${API_URL}/api/v1/:path*` (avec `API_URL=http://localhost:4000` dans `frontend/.env.local`).
   Le cookie de session `tc_session` (HttpOnly, SameSite=Lax) devient ainsi first-party et il n'y a pas de CORS dans le navigateur.
2. **Aucun jeton côté JavaScript.** Ni JWT ni localStorage. Le cookie est géré par le navigateur ; `fetch('/api/v1/...', { credentials: 'same-origin' })`.
3. **NestJS est l'autorité.** Le frontend n'accède jamais à PostgreSQL et ne réimplémente pas les règles d'autorisation.
   Masquer un bouton relève de l'ergonomie, pas de la sécurité. Affiche toujours l'erreur renvoyée par l'API.
4. **Protection des routes.** Dans Next 16, le middleware s'appelle `proxy.ts` (vérifie-le dans `node_modules/next/dist/docs/`).
   On peut y rediriger vers `/connexion` si le cookie est absent, mais l'état réel vient de `GET /auth/me` (401 → déconnecté).
5. **CSRF.** L'API refuse toute requête modifiante dont l'en-tête `Origin` n'est pas dans `WEB_ORIGINS` (par défaut `http://localhost:3000`).
   Si le frontend tourne sur une autre URL (IP du réseau local pendant la démo, par exemple), ajoute-la à `WEB_ORIGINS` dans `backend/.env`.
6. **Format d'erreur unique**, à exploiter partout :

```ts
interface ApiError {
  statusCode: number;     // 401, 403, 404, 409, 422, 429, 500…
  code: string;           // code métier stable, ex. 'REQUEST_ALREADY_PENDING'
  message: string;        // message français prêt à afficher
  details?: { field: string; messages: string[] }[]; // présent sur 422 VALIDATION_FAILED
  path: string;
  timestamp: string;
}
```

   → sur une erreur 422, mappe `details[].field` vers `setError` de React Hook Form ; sinon, affiche `message` dans un toast ou une alerte.
7. **Dates.** L'API envoie de l'ISO UTC. Affiche-les avec `Intl.DateTimeFormat('fr-FR', { timeZone: user.timezone })` (par défaut `Africa/Conakry`).
   Pour créer un créneau, envoie un ISO avec fuseau (`new Date(...).toISOString()`).
8. **Données serveur.** TanStack Query pour les écrans connectés (invalidation après mutation ; `refetchInterval` de 4 à 5 s sur la conversation ouverte et de 30 s sur les compteurs).
   Next 16.4 active `cacheComponents: true` : les écrans authentifiés seront surtout des Client Components ; lis la documentation locale avant d'utiliser du rendu serveur avec des cookies.
9. **Honnêteté produit.** La visioconférence n'est **pas** native : le mentor colle un lien de réunion externe (https) à la confirmation, et l'interface le présente comme tel (« Lien de réunion externe »).
   Le domaine Campus France affiche toujours la mention « Conseil et orientation, sans garantie d'admission ni de visa ».

---

## 4. Contrat d'API réellement implémenté

Préfixe : `/api/v1`. Swagger : `http://localhost:4000/api/docs`. 🔓 = public, 🔒 = session requise, **M** = MENTOR, **E** = MENTEE, **A** = ADMIN.

### Énumérations (et libellés français à afficher)

| Enum | Valeurs → libellé |
|---|---|
| `Role` | MENTEE → Mentoré·e · MENTOR → Mentor · ADMIN → Administrateur |
| `Modality` | REMOTE → À distance · IN_PERSON → En présentiel · HYBRID → Hybride |
| `VerificationStatus` | UNVERIFIED → Non vérifié · PENDING → Vérification en cours · VERIFIED → Profil vérifié · REJECTED → Non retenu |
| `MenteeSituation` | STUDENT → Étudiant·e · GRADUATE → Jeune diplômé·e · ENTREPRENEUR → Entrepreneur·e · PROJECT_HOLDER → Porteur·se de projet · CAREER_CHANGE → En reconversion · PROFESSIONAL → Professionnel·le · OTHER → Autre |
| `MentorshipRequestStatus` | PENDING → En attente · ACCEPTED → Acceptée · DECLINED → Refusée · CANCELLED → Annulée |
| `MentorshipStatus` | ACTIVE → En cours · COMPLETED → Terminé · CANCELLED → Interrompu |
| `SessionStatus` | REQUESTED → À confirmer · CONFIRMED → Confirmée · CANCELLED → Annulée · COMPLETED → Terminée |
| `GoalStatus` | NOT_STARTED → À démarrer · IN_PROGRESS → En cours · COMPLETED → Atteint |

### Auth

| Méthode et route | Accès | Corps → réponse | Erreurs |
|---|---|---|---|
| `POST /auth/register` | 🔓 5/min | `{ email, password (10–128, ≥1 lettre et ≥1 chiffre), firstName, lastName, role: 'MENTEE'\|'MENTOR' }` → 201 `{ ok: true }` et cookie | 409 `EMAIL_TAKEN`, 422, 429 |
| `POST /auth/login` | 🔓 10/min | `{ email, password }` → 200 `{ ok: true }` et cookie | 401 `INVALID_CREDENTIALS`, 401 `ACCOUNT_SUSPENDED`, 429 |
| `POST /auth/logout` | 🔒 | → `{ ok: true }` (session révoquée côté serveur) | |
| `GET /auth/me` | 🔒 | → `{ id, email, firstName, lastName, role, timezone, onboardedAt, createdAt, hasProfile, mentorProfileId }` | 401 |

**Après l'inscription ou la connexion :** si `hasProfile === false`, redirige vers l'onboarding correspondant au rôle (`PUT /profile/mentor` ou `PUT /profile/mentee`).

### Domaines et profils

| Route | Accès | Détail |
|---|---|---|
| `GET /domains` | 🔓 | `[{ id, slug, name, description, icon, topics: string[], mentorCount }]`. `icon` = nom d'icône Lucide (`rocket`, `code`, `compass`, `book-open`, `landmark`, `sparkles`, `graduation-cap`) |
| `GET /profile/me` | 🔒 | `{ user, mentorProfile \| null (avec domains[]), menteeProfile \| null (avec interests[]) }` |
| `PUT /profile/mentor` | 🔒 M | `{ headline (10–140), bio (80–2000), currentPosition?, organization?, yearsExperience (1–60), expertise: string[] (1–15), languages: string[] (1–6), modalities: Modality[] (1–3), city?, domainIds: string[] (1–4), sessionDurationMin: 30\|45\|60\|90, maxMentees (1–20) }` |
| `PUT /profile/mentee` | 🔒 E | `{ situation, goalsSummary (20–1000), desiredSkills: string[] (0–15), preferredModality, city?, interestDomainIds: string[] (1–5) }` |

Les deux `PUT` font un upsert, renseignent `onboardedAt` au premier appel et renvoient la même forme que `GET /profile/me`. 422 `INVALID_DOMAIN` si un domaine est inconnu.

### Annuaire et fiche mentor

`GET /mentors?q=&domain=<slug>&modality=&language=&available=true&page=1&pageSize=12` 🔓
→ `{ items: MentorCard[], page, pageSize, total, totalPages }`

```ts
interface MentorCard {
  id: string;                 // = id utilisateur du mentor (à utiliser comme mentorId)
  firstName: string; lastName: string;
  headline: string; bio: string;          // bio tronquée à environ 220 caractères dans la liste, complète sur la fiche
  currentPosition: string | null; organization: string | null;
  yearsExperience: number; expertise: string[]; languages: string[];
  modalities: Modality[]; city: string | null; sessionDurationMin: number;
  verificationStatus: VerificationStatus;
  domains: { id: string; slug: string; name: string }[];
  activeMentees: number; maxMentees: number; acceptingMentees: boolean;
  nextAvailableAt: string | null;         // prochain créneau libre (ISO)
  rating: { average: number | null; count: number }; // notes laissées par les mentorés (afficher « Nouveau » si count = 0)
}
```

- `GET /mentors/suggestions` 🔒 E → `{ profileRequired: boolean, items: { mentor: MentorCard, score: number /*0–100*/, reasons: string[] }[] }`, avec au plus 6 éléments, triés par score.
  Affiche les `reasons` (« Domaine correspondant : … », « Compétences recherchées couvertes : … »…). C'est un **score déterministe, pas de l'IA** : ne le présente pas comme de l'IA.
- `GET /mentors/:id` 🔓 (personnalisé si connecté) → `MentorCard & { relation: { pendingRequestId, mentorshipId, lastDeclinedAt } | null }`
  → bouton principal : `mentorshipId` → « Ouvrir l'espace de mentorat » ; `pendingRequestId` → « Demande en attente » (désactivé) ; sinon → « Demander un accompagnement ». Visiteur anonyme → « Se connecter pour demander ».
- `GET /mentors/:id/availability?from=&to=` 🔓 → `[{ id, startsAt, endsAt, timezone }]` : créneaux **libres** uniquement (30 jours par défaut).

### Demandes de mentorat

| Route | Accès | Détail |
|---|---|---|
| `POST /mentorship-requests` | 🔒 E | `{ mentorId, domainId?, goal (10–200), message (40–2000) }` → `MentorshipRequest` (201) |
| `GET /mentorship-requests/inbox?status=` | 🔒 M | Demandes reçues |
| `GET /mentorship-requests/sent?status=` | 🔒 E | Demandes envoyées |
| `GET /mentorship-requests/:id` | 🔒 participant | |
| `POST /mentorship-requests/:id/accept` | 🔒 M (mentor sollicité) | `{ note? (≤500) }` → demande avec `mentorship: { id, status }` |
| `POST /mentorship-requests/:id/decline` | 🔒 M | `{ note? }` |
| `POST /mentorship-requests/:id/cancel` | 🔒 E (auteur) | Uniquement si PENDING |

`MentorshipRequest = { id, menteeId, mentorId, domainId, goal, message, status, decisionNote, respondedAt, createdAt, updatedAt, mentee: { id, firstName, lastName, menteeProfile: { situation, goalsSummary, preferredModality, city, desiredSkills } }, mentor: { id, firstName, lastName, mentorProfile: { headline } }, domain: { id, slug, name } | null, mentorship: { id, status } | null }`

Erreurs : 422 `PROFILE_REQUIRED` (mentoré sans profil), `SELF_REQUEST`, `INVALID_DOMAIN` · 404 `MENTOR_NOT_FOUND`, `REQUEST_NOT_FOUND` · 403 `NOT_REQUEST_MENTOR`, `NOT_REQUEST_OWNER`, `NOT_PARTICIPANT` · 409 `REQUEST_ALREADY_PENDING`, `ALREADY_MENTORED`, `INVALID_TRANSITION`, `MENTOR_AT_CAPACITY`.

### Mentorats

`GET /mentorships/me` 🔒 et `GET /mentorships/:id` 🔒 participant →

```ts
interface MentorshipSummary {
  id: string; status: MentorshipStatus; startedAt: string; endedAt: string | null;
  myRole: 'MENTOR' | 'MENTEE';
  mentor: Person; mentee: Person; counterpart: Person;   // counterpart = l'autre participant
  initialGoal: string; domain: { id; name; slug } | null;
  nextSession: { id; startsAt; endsAt; status } | null;
  goalsCount: number; goalsCompleted: number; averageProgress: number | null;
  lastMessage: { content; createdAt; senderId } | null;
  unreadCount: number;
}
type Person = { id; firstName; lastName; mentorProfile: { headline } | null; menteeProfile: { situation; goalsSummary } | null };
```

### Disponibilités et séances

| Route | Accès | Détail |
|---|---|---|
| `GET /availability/me` | 🔒 M | `[{ id, startsAt, endsAt, timezone, sessions: [{ id, status, topic, mentee }] }]` (le tableau `sessions` est vide si le créneau est libre) |
| `POST /availability` | 🔒 M | `{ startsAt, endsAt, timezone? }` : durée de 15 min à 4 h, dans le futur, à moins de 120 jours |
| `DELETE /availability/:id` | 🔒 M (propriétaire) | Refusé si le créneau est réservé |
| `POST /sessions` | 🔒 E | `{ slotId, topic (5–200), modality? }` → séance `REQUESTED` (le créneau est bloqué) |
| `GET /sessions/me?scope=upcoming\|past\|all` | 🔒 | Séances de l'utilisateur (mentor ou mentoré) |
| `POST /sessions/:id/confirm` | 🔒 M | `{ meetingUrl? (https), location? }` → `CONFIRMED` |
| `POST /sessions/:id/cancel` | 🔒 participant | → `CANCELLED` (le créneau redevient libre) |
| `POST /sessions/:id/complete` | 🔒 M | Uniquement une séance CONFIRMED déjà commencée → `COMPLETED` |
| `POST /sessions/:id/feedback` | 🔒 participant | `{ rating: 1–5, comment? (≤1000) }` → `Session` (201). Possible si COMPLETED, ou CONFIRMED et terminée ; **une seule fois par participant** |

`Session = { id, mentorshipId, mentorId, menteeId, slotId, startsAt, endsAt, status, topic, modality, meetingUrl, location, confirmedAt, cancelledAt, cancelledBy, createdAt, updatedAt, mentor: {id,firstName,lastName}, mentee: {…}, feedbacks: [{ id, authorId, rating, comment, createdAt }] }`
→ Proposez « Évaluer la séance » si la séance est terminée et que `feedbacks` ne contient pas encore `authorId === me.id`.

Erreurs : 422 `SLOT_IN_PAST`, `SLOT_INVALID_DURATION`, `SLOT_TOO_FAR` · 409 `SLOT_OVERLAP`, `SLOT_BOOKED`, `SLOT_ALREADY_BOOKED`, `MENTEE_TIME_CONFLICT`, `SESSION_NOT_STARTED`, `SESSION_NOT_ENDED`, `FEEDBACK_ALREADY_GIVEN`, `INVALID_TRANSITION` · 403 `NO_ACTIVE_MENTORSHIP`, `NOT_SESSION_MENTOR`, `NOT_PARTICIPANT` · 404 `SLOT_NOT_FOUND`, `SESSION_NOT_FOUND`.
**Sur 409 `SLOT_ALREADY_BOOKED` :** recharge la liste des créneaux et invite à en choisir un autre (le cas se produit réellement en concurrence).

### Messagerie (conversation = mentorat)

| Route | Accès | Détail |
|---|---|---|
| `GET /mentorships/:id/messages?after=<ISO>&limit=100` | 🔒 participant | `[{ id, content, createdAt, readAt, senderId }]`, ordre chronologique ; `after` sert au rafraîchissement incrémental |
| `POST /mentorships/:id/messages` | 🔒 participant, 30/min | `{ content (1–2000) }` ; 409 `MENTORSHIP_NOT_ACTIVE` |
| `POST /mentorships/:id/messages/read` | 🔒 participant | Marque comme lus les messages reçus → `{ updated }` |

Pas de WebSocket pour l'instant : utilise un polling maîtrisé (4 à 5 s sur la conversation ouverte, mis en pause quand l'onglet est caché).

### Objectifs et jalons

| Route | Accès | Détail |
|---|---|---|
| `GET /mentorships/:id/goals` | 🔒 participant | `Goal[]` |
| `POST /mentorships/:id/goals` | 🔒 participant (mentorat actif) | `{ title (3–160), description?, dueDate?, milestones?: string[] (≤12) }` |
| `PATCH /goals/:id` | 🔒 participant | `{ title?, description?, status?, progress? (0–100), dueDate? \| null, mentorFeedback? }` ; `mentorFeedback` est **réservé au mentor** (403 `MENTOR_ONLY`) |
| `DELETE /goals/:id` | 🔒 auteur | 403 `NOT_GOAL_AUTHOR` |
| `POST /goals/:id/milestones` | 🔒 participant | `{ title }` → `Goal` |
| `PATCH /milestones/:id` | 🔒 participant | `{ isDone?, title? }` → `Goal` (progression recalculée) |
| `DELETE /milestones/:id` | 🔒 participant | → `Goal` |

`Goal = { id, mentorshipId, createdById, title, description, status, progress, dueDate, mentorFeedback, completedAt, createdAt, updatedAt, milestones: [{ id, title, isDone, doneAt, sortOrder }], createdBy: { id, firstName, lastName } }`
Avec des jalons, la progression vaut la part des jalons cochés. Sans jalon, elle se règle manuellement (curseur).

### Tableau de bord et admin

- `GET /dashboard/me` 🔒 → `{ role, pendingRequests, activeMentorships, upcomingSessions: Session[≤3] (avec mentorshipId et meetingUrl), sessionsAwaitingConfirmation, unreadMessages, goals: { total, completed, averageProgress | null }, mentor: { maxMentees, freeUpcomingSlots } | null }`
- `GET /admin/overview`, `GET /admin/users?role=`, `PATCH /admin/users/:id/status { status }`, `PATCH /admin/mentors/:id { verificationStatus?, isPublished? }` (🔒 A)
- `GET /health` 🔓 → `{ status, database, time }`

---

## 5. Plan de réalisation frontend (ordre impératif)

Chaque étape doit être **reliée à l'API réelle** avant de passer à la suivante. Pas de données statiques une fois l'endpoint disponible.

**F0 — Fondations (environ 1 h 30)**
- Lire `frontend/AGENTS.md` et `node_modules/next/dist/docs/` (Next 16.4 : `proxy.ts`, `cacheComponents`, conventions).
- Installer shadcn/ui (Tailwind 4), lucide-react, @tanstack/react-query, react-hook-form, zod, @hookform/resolvers, sonner (toasts).
- Tokens de design (§6) dans `globals.css`, police via `next/font`.
- `rewrites` vers l'API ; `lib/api.ts` (fetch typé et `ApiError`) ; `lib/format.ts` (dates, libellés des enums) ; `QueryProvider`.
- Hook `useMe()` ; layouts : `(public)` avec header, `(app)` avec sidebar desktop et barre d'onglets mobile ; garde de route.

**F1 — Parcours critique P0**
1. `/connexion`, `/inscription` (choix du rôle en deux grandes cartes) ; erreurs par champ.
2. `/onboarding` différencié selon le rôle, avec indicateur d'étapes (mentoré en 3 étapes : situation, domaines et compétences, objectif et modalité ; mentor en 3 étapes : parcours, expertise et domaines, modalités et capacité).
3. `/mentors` : annuaire avec recherche, filtres (domaine, modalité, langue, disponible), pagination, skeletons et état vide ; bloc « Suggestions pour vous » si mentoré connecté.
4. `/mentors/[id]` : fiche complète, éléments de confiance (vérification, années d'expérience, capacité), créneaux libres, CTA adapté à `relation`.
5. Formulaire de demande (dialogue ou page) : objectif et message motivé avec compteurs de caractères.
6. `/demandes` : onglets Reçues (mentor) ou Envoyées (mentoré), badges de statut, Accepter/Refuser avec note facultative.
7. `/tableau-de-bord` adapté au rôle : demandes en attente, prochaines séances, mentorats, objectifs (uniquement des chiffres issus de `/dashboard/me`).

**F2 — Séances**
8. `/disponibilites` (mentor) : ajout de créneaux (date, heure de début, durée), liste groupée par jour, suppression, créneaux réservés mis en évidence.
9. Réservation par le mentoré depuis l'espace de mentorat ou la fiche mentor (choix d'un créneau et sujet) ; `/seances` : à venir et passées, confirmer (avec lien externe) ou annuler.

**F3 — P1**
10. `/mentorats/[id]` : en-tête de la relation et onglets **Conversation** (polling, envoi, accusés de lecture), **Objectifs** (création avec jalons, cases à cocher, barre de progression, retour du mentor) et **Séances** (dont « Évaluer la séance », de 1 à 5 étoiles, et commentaire).
11. `/admin` minimal : vue d'ensemble, liste des comptes, vérifier ou publier un mentor, suspendre un compte.
12. Landing `/` concise : proposition de valeur, fonctionnement en 3 étapes, les 7 domaines (`GET /domains`, avec le nombre réel de mentors), CTA « Trouver un mentor » et « Devenir mentor ». **Aucun faux témoignage ni aucune statistique inventée.**

**F4 — Finition**
13. Responsive 360 px → 1440 px, accessibilité (clavier, focus, contraste, `aria-live` pour les toasts et la conversation), `prefers-reduced-motion`.
14. Playwright E2E du scénario de démo si le temps le permet.

**Critère de réussite de la démo** (à vérifier sur mobile et desktop) : Aminata recherche « Développement web », trouve Fatoumata, envoie une demande. Fatoumata accepte. Aminata réserve un créneau, Fatoumata le confirme avec un lien externe, ils échangent un message, puis créent et font avancer un objectif.

---

## 6. Direction de design (système à implémenter)

**Intention :** produit SaaS professionnel, sobre, premium et crédible auprès des jeunes comme des professionnels. Ce n'est **pas** une application ludique. L'information prime, sans décoration gratuite.

### Palette et tokens sémantiques (contrastes WCAG AA vérifiés pour le texte)

| Token | Valeur | Usage |
|---|---|---|
| `--color-ink-900` (primary) | `#172A46` | Bleu encre : header, titres, boutons principaux (texte blanc 14,2:1) |
| `--color-ink-700` | `#2A4166` | Survol du primary |
| `--color-teal-700` (accent) | `#0B7A73` | Turquoise **assombri** pour le texte, les liens et les boutons secondaires (5,2:1 sur blanc) |
| `--color-teal-600` | `#0F8B83` | Turquoise d'origine : grandes surfaces, barres de progression, icônes (pas de petit texte) |
| `--color-teal-50` | `#E7F5F3` | Fonds de badges et zones « relation » |
| `--color-amber-400` | `#E8AD58` | Accent **parcimonieux** (badge « Vérifié », mise en avant) ; toujours avec du texte `#18243A`, jamais du texte ambre sur blanc |
| `--color-amber-50` | `#FDF4E6` | Fond d'alerte douce ou d'information |
| `--color-bg` | `#F7F9FC` | Fond de page |
| `--color-surface` | `#FFFFFF` | Cartes, panneaux |
| `--color-border` | `#E2E8F0` | Bordures 1 px |
| `--color-text` | `#18243A` | Texte principal |
| `--color-text-muted` | `#5B6B82` | Texte secondaire (légèrement assombri par rapport à #64748B pour tenir 4,5:1 sur #F7F9FC) |
| `--color-success` | `#15803D` | Statuts acceptée, confirmée, atteint |
| `--color-warning` | `#B45309` | Statuts en attente, à confirmer |
| `--color-danger` | `#B91C1C` | Statuts refusée, annulée, erreurs |

Mappe-les sur les variables shadcn (`--primary`, `--accent`, `--muted`, `--destructive`, `--ring`, etc.) dans `@theme` (Tailwind 4).
**Couleurs des badges de statut :** fond en teinte 50, texte en teinte 700, plus une icône. Ne jamais transmettre l'information par la seule couleur.

### Typographie

- Police : **Inter** (via `next/font/google`, sous-ensemble latin, `display: swap`). Deux graisses structurantes : **400** pour le texte et **600** pour les titres et libellés (700 seulement pour le H1 de la landing).
- Échelle : 12 / 14 / 16 (corps) / 18 / 20 / 24 / 30 / 36 / 48 px ; interligne de 1,5 pour le corps et de 1,2 pour les titres ; `tracking-tight` sur les titres de 24 px et plus.
- Longueur de ligne : au plus 70 caractères pour les bios et les messages.

### Espacements, formes et profondeur

- Grille de 4 px ; espacements usuels de 8, 12, 16, 24, 32 et 48 px ; conteneur `max-w-6xl` ; padding de page de 16 px en mobile et de 32 px en desktop.
- Rayons : `--radius-sm` 6 px (badges), `--radius` 10 px (champs, boutons), `--radius-lg` 14 px (cartes), `--radius-xl` 20 px (panneaux de la landing).
- Ombres discrètes : `0 1px 2px rgb(23 42 70 / .06)` pour les cartes et `0 8px 24px rgb(23 42 70 / .08)` au survol et pour les popovers. Pas d'ombres lourdes.
- Breakpoints Tailwind par défaut (`sm` 640, `md` 768, `lg` 1024, `xl` 1280). Z-index : header 40, dropdown 50, dialog 60, toast 70.

### Composants clés

- **Carte mentor** : avatar à initiales sur fond teal-50 (pas de photo inventée), nom, titre, 2 ou 3 domaines en badges, extrait de bio (3 lignes), modalités avec icônes, ville, « Profil vérifié » (ambre) le cas échéant, prochain créneau (« Disponible jeu. 6 nov. ») et CTA « Voir le profil ». Toute la carte est cliquable, avec un focus visible.
- **Badges de statut** pour les demandes, les séances et les objectifs (cf. libellés du §4).
- **Barre de progression** des objectifs (teal-600) avec pourcentage textuel.
- **Stepper** de l'onboarding (étape x/3, retour possible, sauvegarde finale unique).
- **États** : skeleton pour chaque liste ; état vide avec icône, phrase utile et action (« Aucune demande pour l'instant — Explorer les mentors ») ; erreur avec message de l'API et bouton « Réessayer » ; écran « Accès refusé » sur 403 ; toasts de succès après chaque mutation.
- **Navigation** :
  - mentoré : Tableau de bord · Trouver un mentor · Mes demandes · Mes mentorats · Séances ;
  - mentor : Tableau de bord · Demandes reçues · Mes mentorés · Disponibilités · Séances ;
  - admin : Vue d'ensemble · Comptes · Mentors.
  En mobile, barre d'onglets en bas (4 ou 5 icônes) ; en desktop, sidebar de 240 px et header avec le menu du compte.
- **Conversation** : bulles alignées (moi à droite sur fond ink-900 avec texte blanc ; l'autre à gauche sur blanc avec bordure), horodatage discret, zone de saisie collée en bas, Entrée pour envoyer et Maj+Entrée pour un saut de ligne.

### Accessibilité et mouvement

- Cibles tactiles d'au moins 44 px ; `:focus-visible` avec un anneau de 2 px teal-700 et un décalage de 2 px ; labels explicites sur tous les champs, aide sous le champ et erreurs liées par `aria-describedby`.
- `lang="fr"` ; titres de page uniques (`metadata`) ; `aria-live="polite"` pour les nouveaux messages et les toasts.
- Micro-interactions de 150 à 200 ms (`ease-out`) sur le survol et l'ouverture ; aucune animation si `prefers-reduced-motion`.

### Contenus

- Français clair, au vouvoiement. Bandeau discret « Environnement de démonstration — données fictives » lorsque `NEXT_PUBLIC_DEMO_MODE=true`.
- Pas de faux chiffres d'impact, pas de faux témoignages, pas de logos de partenaires non confirmés.

---

## 7. Arborescence frontend suggérée

```text
frontend/src/
├── app/
│   ├── (public)/page.tsx                 landing
│   ├── (public)/connexion/page.tsx
│   ├── (public)/inscription/page.tsx
│   ├── (public)/mentors/page.tsx          annuaire (public)
│   ├── (public)/mentors/[id]/page.tsx     fiche (publique, actions si connecté)
│   ├── (app)/layout.tsx                   shell authentifié (sidebar et onglets mobiles)
│   ├── (app)/onboarding/page.tsx
│   ├── (app)/tableau-de-bord/page.tsx
│   ├── (app)/demandes/page.tsx
│   ├── (app)/mentorats/page.tsx
│   ├── (app)/mentorats/[id]/page.tsx      conversation, objectifs, séances
│   ├── (app)/seances/page.tsx
│   ├── (app)/disponibilites/page.tsx      mentor
│   └── (app)/admin/page.tsx
├── features/{auth,mentors,requests,mentorships,scheduling,messages,goals,admin}/
│   ├── api.ts          hooks TanStack Query (useMentors, useAcceptRequest…)
│   ├── schemas.ts      schémas Zod alignés sur les DTO du §4
│   └── components/
├── components/{ui,layout,feedback}/      shadcn et composants transverses (EmptyState, ErrorState, StatusBadge…)
├── lib/{api.ts,format.ts,labels.ts,query-client.ts}
└── proxy.ts                              redirections selon la présence du cookie
```

---

## 8. Conventions d'équipe (à respecter)

- Code, fichiers et identifiants en **anglais** ; interface et documentation en **français**.
- TypeScript strict, sans `any` ; ESLint et Prettier (configuration Prettier à la racine).
- **Git : Claude ne fait ni `git add`, ni `git commit`, ni `git push`.** Il crée la branche demandée (par exemple `feature/frontend`), écrit le code, lance format, lint, typecheck et build, puis s'arrête en proposant les commandes git à Bakary.
- Aucune mention d'attribution à Claude dans les commits ni dans les documents.
- Ne modifie pas `backend/` sans concertation. Si un endpoint manque, décris le besoin (route, entrée, sortie) dans `docs/BACKEND_REQUESTS.md`.
- Ne jamais committer de `.env` (seuls les fichiers `.env.example` sont versionnés).
