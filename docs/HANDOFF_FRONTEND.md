# Passation frontend — TalentsConnect

> Document destiné à la session Claude Code qui construit le **frontend Next.js** sur un autre poste.
> À lire **en entier** avec `CLAUDE.md`, puis `PROMPT_CLAUDE_CODE_HACKATHON_MENTORAT_2026.md` (cahier de mission)
> et `TDR_Hackathon_Talents_Connectes_Mentorat_2026.md` (termes de référence, source métier prioritaire).

---

## 1. Résumé : où en est le projet (4 novembre 2026)

**Produit :** plateforme de mentorat professionnel pour le hackathon « Talents connectés » (Conakry, 4–7 novembre 2026).
Nom de la plateforme : « TalentsConnect » (en un mot ; le hackathon s'appelle « Talents connectés »).

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

| Évaluation des séances (1 à 5 et commentaire), note moyenne sur la fiche mentor | ✅ |
| Bibliothèque publique de ressources et ressources privées d'un mentorat | ✅ |
| Notifications in-app (demande, décision, séance, retour sur objectif, ressource partagée) | ✅ |

Compte (nom, fuseau, mot de passe, déconnexion de tous les appareils), clôture de mentorat et gestion des domaines par l’admin : ✅.
Swagger documente désormais les schémas de toutes les requêtes (plugin @nestjs/swagger).

Opportunités (stages, emplois, appels à projets…) et confidentialité (export des données, suppression du compte) : ✅.

Visio : lien Jitsi Meet généré automatiquement à la confirmation (service externe). ✅

Tests : **8 unitaires et 100 e2e** (Vitest et supertest sur un vrai PostgreSQL de test), typecheck, lint et build OK. CI GitHub Actions dans `.github/workflows/ci.yml`.
**Pas encore fait côté backend :** emails transactionnels, réinitialisation de mot de passe, WebSocket.
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
9. **Visio et honnêteté produit.** À la confirmation d'une séance à distance ou hybride, l'API **génère automatiquement** une salle Jitsi Meet au nom imprévisible (`meetingUrl`), sauf si le mentor fournit son propre lien. Affichez un bouton « Rejoindre la visio » (nouvel onglet), actif quelques minutes avant le début. Présentez-le honnêtement : « visio via Jitsi Meet (service externe, connexion Internet requise) ». Une intégration par `iframe` dans l'application est possible, mais elle est gourmande en bande passante : à garder en option.
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
| `POST /auth/password` | 🔒 5/min | `{ currentPassword, newPassword }` → `{ revokedSessions }` (les **autres** sessions sont révoquées, la courante reste ouverte) | 422 `INVALID_CURRENT_PASSWORD`, `PASSWORD_UNCHANGED` (avec `details` sur le champ) |
| `POST /auth/logout-all` | 🔒 | Déconnecte tous les appareils, y compris celui-ci → `{ ok, revokedSessions }` | |

**Après l'inscription ou la connexion :** si `hasProfile === false`, redirige vers l'onboarding correspondant au rôle (`PUT /profile/mentor` ou `PUT /profile/mentee`).

### Domaines et profils

| Route | Accès | Détail |
|---|---|---|
| `GET /domains` | 🔓 | `[{ id, slug, name, description, icon, topics: string[], mentorCount }]`. `icon` = nom d'icône Lucide (`rocket`, `code`, `compass`, `book-open`, `landmark`, `sparkles`, `graduation-cap`) |
| `GET /profile/me` | 🔒 | `{ user, mentorProfile \| null (avec domains[]), menteeProfile \| null (avec interests[]) }` |
| `PUT /profile/mentor` | 🔒 M | `{ headline (10–140), bio (80–2000), currentPosition?, organization?, yearsExperience (1–60), expertise: string[] (1–15), languages: string[] (1–6), modalities: Modality[] (1–3), city?, domainIds: string[] (1–4), sessionDurationMin: 30\|45\|60\|90 }` |
| `PATCH /profile/me` | 🔒 | `{ firstName?, lastName?, timezone? (IANA, ex. Africa/Conakry) }` → même forme que `GET /profile/me` |
| `PUT /profile/mentee` | 🔒 E | `{ situation, goalsSummary (20–1000), desiredSkills: string[] (0–15), preferredModality, city?, interestDomainIds: string[] (1–5) }` |

Les deux `PUT` font un upsert, renseignent `onboardedAt` au premier appel et renvoient la même forme que `GET /profile/me`. 422 `INVALID_DOMAIN` si un domaine est inconnu.

### Annuaire et fiche mentor

`GET /mentors?q=&domain=<slug>&modality=&language=&available=true&sort=relevance&page=1&pageSize=12` 🔓
→ `{ items: MentorCard[], page, pageSize, total, totalPages }`

Ordre (`sort`, fonction pure `modules/mentors/ranking.ts`, calculé sur l'ensemble des résultats puis découpé en pages) :
- `relevance` (défaut) : profil vérifié, puis expérience démontrée sur la plateforme (« Mentor confirmé », puis au moins un mentoré accompagné ; à niveau égal, accompagnements terminés, mentorés, certificats et note fiable), puis créneau libre sous 14 jours, puis années d'expérience en départage ;
- `experience` : expérience démontrée d'abord, puis vérification et années ;
- `availability` : créneau libre le plus proche d'abord, sans créneau en dernier ;
- `rating` : note moyenne (comptée à partir de 3 avis), puis nombre d'avis.
Valeur inconnue : 422. L'interface l'expose par le menu « Trier par » (paramètre d'URL `tri`).

Recherche `q` (`modules/mentors/search.ts`) : sans accents ni casse, mots vides ignorés, variantes et préfixes (« developpeur » → « développement »), fautes de frappe (distance d'édition) et synonymes (« startup », « IA », « emploi »…). Les profils qui contiennent tous les mots passent d'abord ; sinon, les profils proches (au moins un mot). La réponse ajoute `search: { mode: 'exact' | 'approximate' | 'empty', terms, didYouMean } | null`.

`GET /mentors/autocomplete?q=` 🔓 (120/min) → `{ domains[{ slug, name, icon, mentorCount }], skills[{ label, count }], mentors[{ id, firstName, lastName, avatarUpdatedAt, headline }] }` : suggestions pendant la saisie.

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
  activeMentees: number; mentoredCount: number; certificatesCount: number;
  nextAvailableAt: string | null;         // prochain créneau libre (ISO)
  rating: { average: number | null; count: number }; // notes laissées par les mentorés (afficher « Nouveau » si count = 0)
  completedMentorships: number;           // accompagnements menés à terme
  isConfirmed: boolean;                   // « Mentor confirmé » : ≥ 3 accompagnements terminés et note ≥ 4 sur ≥ 3 avis
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

Erreurs : 422 `PROFILE_REQUIRED` (mentoré sans profil), `SELF_REQUEST`, `INVALID_DOMAIN` · 404 `MENTOR_NOT_FOUND`, `REQUEST_NOT_FOUND` · 403 `NOT_REQUEST_MENTOR`, `NOT_REQUEST_OWNER`, `NOT_PARTICIPANT` · 409 `REQUEST_ALREADY_PENDING`, `ALREADY_MENTORED`, `INVALID_TRANSITION`.

### Mentorats

`POST /mentorships/:id/complete` 🔒 participant : `{ note? (≤1000) }` → `MentorshipSummary` avec `status: COMPLETED`. Les séances futures sont annulées. Si au moins une séance a été réalisée, un certificat est délivré au mentor (`certificate: { code, issuedAt }` dans la réponse) ; `GET /certificates/:code` (public) le vérifie, `GET /mentors/:id/certificates` (public) les liste. Le mentorat devient **lecture seule** : écrire renvoie 409 `MENTORSHIP_NOT_ACTIVE`. Prévoyez un bouton « Clôturer le mentorat » avec confirmation et un champ bilan.

`GET /mentorships/me` 🔒 et `GET /mentorships/:id` 🔒 participant →

```ts
interface MentorshipSummary {
  id: string; status: MentorshipStatus; startedAt: string; endedAt: string | null;
  endedById: string | null; endNote: string | null;   // renseignés à la clôture
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
| `POST /sessions/:id/confirm` | 🔒 M | `{ meetingUrl? (https), location? }` → `CONFIRMED`. Sans `meetingUrl`, et si la séance n'est pas en présentiel : lien Jitsi généré automatiquement |
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
| `POST /mentorships/:id/messages` | 🔒 participant, 30/min | `{ content (1–2000) }`. Reste possible après la clôture (mentor et mentoré restent en contact) ; 409 `MENTORSHIP_CANCELLED` si le mentorat est annulé, 409 `COUNTERPART_UNAVAILABLE` si l'autre compte est supprimé ou suspendu |
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

### Ressources (bibliothèque et partage)

| Route | Accès | Détail |
|---|---|---|
| `GET /resources?q=&domain=<slug>&kind=&page=&pageSize=` | 🔓 | Bibliothèque publique → `{ items: Resource[], page, pageSize, total, totalPages }` |
| `POST /resources` | 🔒 M ou A | Publication dans la bibliothèque |
| `DELETE /resources/:id` | 🔒 auteur (ou admin pour la bibliothèque) | 403 `NOT_RESOURCE_AUTHOR` |
| `GET /mentorships/:id/resources` | 🔒 participant | Ressources privées du mentorat |
| `POST /mentorships/:id/resources` | 🔒 participant (mentorat actif) | Partage privé ; l'autre participant est notifié |
| `POST /resources/upload` | 🔒 M ou A | Comme `POST /resources`, avec un document joint (multipart) |
| `POST /mentorships/:id/resources/upload` | 🔒 participant (mentorat actif) | Comme le partage privé, avec un document joint (multipart) |
| `GET /resources/:id/file` | 🔓 bibliothèque · 🔒 participants pour un mentorat | Téléchargement en pièce jointe ; 404 `RESOURCE_FILE_NOT_FOUND` pour un tiers (l'existence n'est pas révélée) |

Corps de création : `{ title (3–160), description? (≤2000), url? (https uniquement), kind?: 'ARTICLE'|'VIDEO'|'TEMPLATE'|'TOOL'|'ADVICE'|'OTHER', domainId? }`. **Il faut un document, un `url` ou une `description`** (sinon 422 `RESOURCE_EMPTY`). Document joint : champs ci-dessus en multipart et fichier dans le champ `file`, 10 Mo au plus (413 au-delà). Formats acceptés : PDF, Word, Excel, PowerPoint (anciens et récents), OpenDocument, texte, CSV, PNG, JPEG et WebP. L'extension doit correspondre au contenu réel du fichier (422 `FILE_INVALID_TYPE` sinon) ; le HTML, le SVG et les exécutables sont refusés.
`Resource = { id, mentorshipId | null, kind, title, description, url, file: { fileName, mimeType, size } | null, createdAt, author: { id, firstName, lastName, role, mentorProfile: { headline } | null }, domain: { id, slug, name } | null }`
Libellés `kind` : Article · Vidéo · Modèle · Outil · Conseil · Autre. Ouvrez les liens externes avec `target="_blank" rel="noopener noreferrer"`.

### Notifications in-app

| Route | Détail |
|---|---|
| `GET /notifications?unread=true&limit=30` | `[{ id, type, title, body, link, readAt, createdAt }]`, de la plus récente à la plus ancienne |
| `GET /notifications/unread-count` | `{ count }` : badge de la cloche dans le header (rafraîchir toutes les 30 s) |
| `POST /notifications/:id/read` | Marque comme lue (404 si elle n'appartient pas à l'utilisateur) |
| `POST /notifications/read-all` | `{ updated }` |

Types : `REQUEST_RECEIVED`, `REQUEST_ACCEPTED`, `REQUEST_DECLINED`, `SESSION_REQUESTED`, `SESSION_CONFIRMED`, `SESSION_CANCELLED`, `GOAL_FEEDBACK`, `RESOURCE_SHARED`, `MENTORSHIP_COMPLETED`.
`title` et `body` sont prêts à afficher en français. `link` est un **chemin frontend relatif** (`/demandes`, `/seances`, `/mentors`, `/mentorats/<id>`) : un clic marque la notification comme lue puis navigue vers ce chemin. **Ces routes doivent donc exister côté frontend.**

### Opportunités (TDR §7.2)

| Route | Accès | Détail |
|---|---|---|
| `GET /opportunities?q=&type=&domain=<slug>&remote=true&page=&pageSize=` | 🔓 | Opportunités **ouvertes** (non archivées, date limite non dépassée), échéance la plus proche en premier → paginé |
| `GET /opportunities/:id` | 🔓 | Détail ; une opportunité archivée ou expirée renvoie 404, sauf pour son auteur ou un admin |
| `GET /opportunities/mine` | 🔒 M ou A | Mes publications, y compris archivées ou expirées |
| `POST /opportunities` | 🔒 M ou A | `{ type, title (5–160), organization (2–120), description (30–3000), location?, isRemote?, url? (https), deadline? (future), domainId? }` ; 422 `DEADLINE_IN_PAST` |
| `PATCH /opportunities/:id` | 🔒 auteur ou A | Mêmes champs (facultatifs), `deadline: null` pour la retirer, `archived: true|false` ; 403 `NOT_OPPORTUNITY_AUTHOR` |

Types et libellés : INTERNSHIP → Stage · JOB → Emploi · CALL_FOR_PROJECTS → Appel à projets · SCHOLARSHIP → Bourse · TRAINING → Formation · EVENT → Événement · OTHER → Autre.
`Opportunity = { id, type, title, organization, description, location, isRemote, url, deadline, archivedAt, createdAt, updatedAt, domain, author: { id, firstName, lastName, role, mentorProfile: { headline } | null } }`
Afficher « Clôture dans N jours » si `deadline` est proche, et ouvrir `url` dans un nouvel onglet (`rel="noopener noreferrer"`).

### Confidentialité (page « Mon compte »)

| Route | Détail |
|---|---|
| `GET /profile/me/export` | Téléchargement JSON de toutes ses données (`Content-Disposition: attachment`). Utiliser un lien direct `<a href="/api/v1/profile/me/export">` |
| `DELETE /profile/me` | Corps `{ password, confirmation: "SUPPRIMER" }` → `{ ok, closedMentorships }` et cookie effacé. **Irréversible** : le compte est anonymisé (« Compte supprimé »), ses mentorats actifs sont clos, ses séances futures annulées et ses contenus publics retirés. Les messages déjà échangés restent visibles de l'autre participant. 422 `INVALID_PASSWORD`, 403 `ADMIN_CANNOT_SELF_DELETE` |

→ Écran « Supprimer mon compte » : texte d'avertissement clair, champ mot de passe et champ « Tapez SUPPRIMER », bouton rouge, puis redirection vers l'accueil.
Un utilisateur supprimé apparaît comme « Compte supprimé » dans les conversations et les mentorats passés : prévoir un avatar neutre.

### Tableau de bord et admin

- `GET /dashboard/me` 🔒 → `{ role, pendingRequests, activeMentorships, upcomingSessions: Session[≤3] (avec mentorshipId et meetingUrl), sessionsAwaitingConfirmation, unreadMessages, goals: { total, completed, averageProgress | null }, mentor: { freeUpcomingSlots } | null }`
- `GET /admin/overview`, `GET /admin/users?role=`, `PATCH /admin/users/:id/status { status }`, `PATCH /admin/mentors/:id { verificationStatus?, isPublished? }` (🔒 A)
- Domaines (🔒 A) : `GET /admin/domains` (tous, y compris inactifs, avec `_count: { mentors, mentees, resources }`), `POST /admin/domains { slug (kebab-case), name, description, icon (nom Lucide), topics[] }` (409 `DOMAIN_SLUG_TAKEN`), `PATCH /admin/domains/:id { name?, description?, icon?, topics?, isActive?, sortOrder? }`. Un domaine désactivé disparaît de `GET /domains`.
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
4. `/mentors/[id]` : fiche complète, éléments de confiance (vérification, années d'expérience, mentorés accompagnés, certificats), créneaux libres, CTA adapté à `relation`.
5. Formulaire de demande (dialogue ou page) : objectif et message motivé avec compteurs de caractères.
6. `/demandes` : onglets Reçues (mentor) ou Envoyées (mentoré), badges de statut, Accepter/Refuser avec note facultative.
7. `/tableau-de-bord` adapté au rôle : demandes en attente, prochaines séances, mentorats, objectifs (uniquement des chiffres issus de `/dashboard/me`).

**F2 — Séances**
8. `/disponibilites` (mentor) : ajout de créneaux (date, heure de début, durée), liste groupée par jour, suppression, créneaux réservés mis en évidence.
9. Réservation par le mentoré depuis l'espace de mentorat ou la fiche mentor (choix d'un créneau et sujet) ; `/seances` : à venir et passées, confirmer (avec lien externe) ou annuler.

**F3 — P1**
10. `/mentorats/[id]` : en-tête de la relation et onglets **Conversation** (polling, envoi, accusés de lecture), **Objectifs** (création avec jalons, cases à cocher, barre de progression, retour du mentor) et **Séances** (dont « Évaluer la séance », de 1 à 5 étoiles, et commentaire).
11. Onglet **Ressources** dans `/mentorats/[id]` (partage de liens et de conseils) et page publique `/ressources` (bibliothèque filtrable ; bouton « Publier » pour les mentors).
12. **Cloche de notifications** dans le header : badge `unread-count`, panneau déroulant avec la liste, « Tout marquer comme lu », navigation via `link`.
13. `/admin` minimal : vue d'ensemble, liste des comptes, vérifier ou publier un mentor, suspendre un compte, retirer une ressource de la bibliothèque, **gérer les domaines** (créer, renommer, activer ou désactiver).
13 bis. `/compte` : modifier son nom et son fuseau horaire, changer son mot de passe, « Se déconnecter de tous les appareils », **exporter mes données**, **supprimer mon compte**.
13 ter. `/opportunites` : liste publique filtrable (type, domaine, à distance) ; pour les mentors, « Publier une opportunité » et « Mes publications » (archiver ou republier).
14. Landing `/` concise : proposition de valeur, fonctionnement en 3 étapes, les 7 domaines (`GET /domains`, avec le nombre réel de mentors), CTA « Trouver un mentor » et « Devenir mentor ». **Aucun faux témoignage ni aucune statistique inventée.**

**F4 — Finition**
15. Responsive 360 px → 1440 px, accessibilité (clavier, focus, contraste, `aria-live` pour les toasts et la conversation), `prefers-reduced-motion`.
16. Playwright E2E du scénario de démo si le temps le permet.

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
  - mentoré : Tableau de bord · Trouver un mentor · Mes demandes · Mes mentorats · Séances · Ressources · Opportunités ;
  - mentor : Tableau de bord · Demandes reçues · Mes mentorés · Disponibilités · Séances · Ressources · Opportunités ;
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

## Ajouts du 5 novembre 2026

- **Photo de profil** : `PUT /profile/me/avatar` (corps binaire JPEG, PNG ou WebP, 1 Mo maximum), `DELETE /profile/me/avatar`, `GET /users/:id/avatar?v=<date>` (public pour un mentor publié, sinon la personne, l'équipe ou une personne liée). Les personnes renvoyées par l'API portent `avatarUpdatedAt`.
- **Certificats** : `GET /certificates/:code` (public), `GET /mentors/:id/certificates` (public), `GET /certificates/me`. La clôture d'un mentorat renvoie `certificate: { code, issuedAt } | null`.
- **Fiche mentor** : `mentoredCount` (personnes distinctes accompagnées, tous domaines), `certificatesCount` ; plus de `maxMentees` ni de `acceptingMentees`.
- **Administration** (`@Roles('ADMIN')`, ex-super-administrateur, rôle supprimé) : `GET /admin/metrics`, `GET /admin/team`, `PATCH /admin/users/:id/role` (`ADMIN`, `MENTOR` ou `MENTEE`), `GET /admin/audit?action=&page=`, `GET /admin/certificates`, `POST /admin/certificates/:code/revoke` (`{ reason }`). Erreurs : `SELF_ROLE_CHANGE`, `SUPER_ADMIN_PROTECTED`, `USER_HAS_ACTIVE_MENTORING`, `CERTIFICATE_ALREADY_REVOKED`, `STAFF_PROTECTED` (un admin ne peut pas suspendre un membre de l'équipe).
- **Frontend** : `/messages` (messagerie), `/certificats/[code]`, `/admin/pilotage`, `/admin/equipe`, `/admin/journal`, `/admin/certificats`, `/admin/contenus`.

## Ajouts du 5 novembre 2026 (suite) : groupes d'accompagnement

Un mentor crée un groupe pour accompagner plusieurs personnes ensemble. Il peut y ajouter ses mentorés, actuels ou anciens, et des mentors publiés, mais personne d'autre. Le fil du groupe est commun : tous les membres lisent et écrivent.

| Route | Accès | Détail |
|---|---|---|
| `GET /groups/me` | 🔒 | `[{ id, name, description, isOwner, createdAt, memberCount, preview[≤3], lastMessage, unreadCount }]`, du plus récent au plus ancien |
| `GET /groups/candidates?q=` | 🔒 MENTOR | Personnes ajoutables : `[{ id, firstName, lastName, avatarUpdatedAt, role, relation }]` (mentorés d'abord) |
| `POST /groups` | 🔒 MENTOR, 10/h | `{ name (2–80), description? (≤500), memberIds[] }` → détail ; 422 `GROUP_MEMBER_NOT_ELIGIBLE` |
| `GET /groups/:id` | 🔒 membre | `{ id, name, description, ownerId, isOwner, members[{ …, role, isOwner, joinedAt }] }` |
| `PATCH /groups/:id` | 🔒 responsable | `{ name?, description? }` (chaîne vide : description retirée) |
| `DELETE /groups/:id` | 🔒 responsable | 204 ; supprime aussi les messages |
| `GET /groups/:id/candidates?q=` | 🔒 responsable | Personnes ajoutables, sauf les membres actuels |
| `POST /groups/:id/members` | 🔒 responsable | `{ userIds[] }` → détail ; 409 `GROUP_FULL` (50 membres au plus) |
| `DELETE /groups/:id/members/:userId` | 🔒 responsable, ou le membre lui-même pour quitter | 204 ; 409 `GROUP_OWNER_CANNOT_LEAVE` |
| `GET /groups/:id/messages?after=&limit=` | 🔒 membre | `[{ id, content, createdAt, senderId, sender }]` |
| `POST /groups/:id/messages` | 🔒 membre, 30/min | `{ content (1–2000) }` |
| `POST /groups/:id/read` | 🔒 membre | Marque le fil comme lu |

Un non-membre reçoit 404 `GROUP_NOT_FOUND` : l'existence du groupe n'est pas révélée. Un membre qui n'est pas responsable reçoit 403 `NOT_GROUP_OWNER` sur les actions de gestion. Notification `GROUP_ADDED` (lien `/messages?g=<id>`). `unreadMessages` du tableau de bord inclut les groupes. Les membres d'un même groupe voient leurs photos de profil respectives. Frontend : les groupes apparaissent dans `/messages`, avec le bouton « Nouveau groupe » pour les mentors.

## Ajouts du 5 novembre 2026 (suite) : messagerie enrichie et appels

**Pièces jointes** (messages privés et de groupe) : mêmes formats et mêmes contrôles que les documents des ressources (10 Mo, signature du fichier vérifiée). La légende `content` est facultative.

| Route | Accès | Détail |
|---|---|---|
| `POST /mentorships/:id/messages/upload` | 🔒 participant, 10/min | Multipart : `file`, `content?` |
| `GET /messages/:id/file[?inline=1]` | 🔒 participant | Téléchargement ; `inline=1` affiche une image (PNG, JPEG, WebP) dans la page |
| `POST /groups/:id/messages/upload` | 🔒 membre, 10/min | Multipart : `file`, `content?` |
| `GET /groups/messages/:id/file[?inline=1]` | 🔒 membre | Idem |

`Message` gagne `file: { fileName, mimeType, size } | null` et `call: { id, kind, status, answeredAt, endedAt } | null`. `GroupMessage` gagne `file`. Le `lastMessage` des mentorats gagne `callId` et `file`.

**Canal temps réel** : WebSocket `ws(s)://<origine>/api/v1/ws`, relayé par le rewrite Next.js. Il est authentifié par le cookie de session, avec un en-tête `Origin` autorisé (sinon 401 ou 403), et fermé à la déconnexion. Le serveur envoie `ready`, `message:new { mentorshipId }`, `message:read { mentorshipId }` et `group:message { groupId }`. Le frontend rafraîchit alors les requêtes concernées ; le polling reste un filet de sécurité.

**Appels audio et vidéo** (WebRTC pair à pair, conversations privées uniquement) :
- `GET /calls/config` → `{ iceServers, ringTimeoutMs }`, avec des identifiants TURN temporaires si `TURN_URLS` et `TURN_SECRET` sont configurés.
- Événements envoyés par le client : `call:invite { mentorshipId, kind: 'AUDIO'|'VIDEO' }`, `call:accept|call:decline|call:hangup { callId }`, `call:signal { callId, payload }` (SDP ou candidat ICE, seulement après le décroché).
- Événements envoyés par le serveur : `call:ringing`, `call:incoming { callId, kind, mentorshipId, caller }`, `call:accepted` (à l'appelant, qui envoie alors l'offre), `call:connected` (à l'appelé), `call:signal`, `call:ended { callId, reason }` (`hangup`, `declined`, `missed`, `cancelled`, `disconnected`, `unavailable`, `busy`, `answered-elsewhere`) et `error { code, message, event }`.
- Sonnerie de 40 s. La fin de l'appel est inscrite dans la conversation : « Appel vidéo · 3 min », « Appel audio manqué » (non lu), « … refusé ». La base garantit au plus un appel en cours par mentorat. Aucun flux média ne passe par l'API.
- Limites : l'état des appels en cours est en mémoire (une seule instance de l'API). Le navigateur exige un contexte sécurisé (https ou localhost) pour la caméra et le micro. Entre réseaux mobiles, un relais TURN est nécessaire : le service `coturn` est fourni dans `backend/docker-compose.yml` (profil `calls`), et les variables sont documentées dans `.env.example`.

## Ajouts du 5 novembre 2026 (suite) : parcours guidés, ateliers, rapport d’impact, mot de passe, PWA

**Parcours guidés** (catalogue versionné dans `backend/src/modules/guided-paths/guided-paths.catalog.ts`, un parcours par domaine des TDR, dont Campus France avec sa mention « ni admission ni visa garantis ») :

| Route | Accès | Détail |
|---|---|---|
| `GET /guided-paths?domain=<slug>` | 🔓 | `[{ key, title, summary, notice, domain: { id, slug, name }, goals: [{ key, title, description, milestones[] }] }]` (domaines actifs uniquement) |
| `POST /mentorships/:id/guided-paths/:key` | 🔒 participant (mentorat actif) | `{ goalKeys?: string[] }` (tous si absent) → `{ created: Goal[], skipped: string[] }`. Un objectif dont le titre existe déjà n’est pas recréé. 404 `GUIDED_PATH_NOT_FOUND`, 422 `INVALID_GUIDED_GOAL`. L’autre participant est notifié |

Frontend : onglet **Objectifs** → « Parcours guidé » (et encart « Parcours conseillé » si le domaine du mentorat en a un).

**Ateliers de groupe** (TDR, étape 4) : séance collective planifiée par le mentor responsable d’un groupe.

| Route | Accès | Détail |
|---|---|---|
| `GET /workshops/me?scope=upcoming\|past\|all` | 🔒 | Ateliers de tous mes groupes |
| `GET /groups/:id/workshops?scope=` | 🔒 membre | 404 `GROUP_NOT_FOUND` pour un non-membre |
| `POST /groups/:id/workshops` | 🔒 M responsable, 20/h | `{ title (3–160), description?, startsAt, endsAt (15 min–4 h, futur, ≤ 120 j), modality?, meetingUrl? (https), location? }`. Salle Jitsi générée hors présentiel. 409 `WORKSHOP_OVERLAP` (autre atelier de l’animateur : contrainte d’exclusion SQL ; ou séance individuelle active), 422 `INVALID_WORKSHOP_TIME`, 403 `NOT_GROUP_OWNER` |
| `POST /workshops/:id/cancel` | 🔒 responsable | Membres notifiés (`WORKSHOP_CANCELLED`) |
| `PUT /workshops/:id/attendance` | 🔒 membre | `{ going: boolean }` ; 409 `WORKSHOP_CANCELLED`, `WORKSHOP_ENDED`, `WORKSHOP_HOST_REQUIRED` |

`Workshop = { id, groupId, title, description, startsAt, endsAt, modality, meetingUrl, location, cancelledAt, group: { id, name }, createdBy, isOwner, status: 'UPCOMING'|'PAST'|'CANCELLED', goingCount, notGoingCount, myResponse }`. Notification `WORKSHOP_SCHEDULED` (lien `/seances?atelier=<id>`), événement temps réel `group:workshop { groupId }`. Frontend : bouton « Ateliers » dans l’en-tête d’un groupe (`/messages`) et section « Ateliers de groupe à venir » sur `/seances`.

**Rapport d’impact** : `GET /admin/impact-report.csv` (🔒 ADMIN) → CSV `;` + BOM UTF-8 (Excel), comptages agrégés uniquement, export tracé (`IMPACT_REPORT_EXPORTED`). `GET /admin/metrics` gagne `goals`, `workshops` et `calls` (appels aboutis et minutes). Frontend : boutons « Rapport d’impact (CSV) » et « Imprimer ou PDF » sur `/admin/pilotage`.

**Réinitialisation du mot de passe, sans email** (la plateforme n’envoie pas d’email) : l’équipe génère un lien personnel, à usage unique, valable 2 heures, et le remet à la personne.
- `POST /admin/users/:id/password-reset-link` (🔒 A) → `{ token, path, expiresAt }` ; un nouveau lien invalide le précédent ; tracé `PASSWORD_RESET_LINK_ISSUED` ; 403 `STAFF_PROTECTED` (un admin ne réinitialise pas un membre de l’équipe), `SELF_RESET`.
- `POST /auth/password-reset/check` (🔓) `{ token }` → `{ valid, firstName, expiresAt }` ; `POST /auth/password-reset` (🔓, 5/min) `{ token, newPassword }` → toutes les sessions du compte sont révoquées. 404 `RESET_LINK_INVALID`.
- Frontend : « Mot de passe oublié ? » sur `/connexion` → `/mot-de-passe-oublie` (marche à suivre honnête), `/reinitialiser-mot-de-passe?jeton=…`, bouton « Réinitialiser » dans `/admin/comptes`.

**Appels sobres en données** : débit audio plafonné à 32 kbit/s, mode « économie de données » pour la vidéo (150 kbit/s, résolution divisée par deux), consommation réelle affichée pendant l’appel (statistiques WebRTC du navigateur). Le bouton « Audio » est mis en avant dans les conversations.

**PWA** : `src/app/manifest.ts`, icônes `public/icons/`, service worker `public/sw.js` (production uniquement : fichiers statiques en cache, page `hors-ligne.html`, API jamais mise en cache), « Installer l’application » dans le menu du compte (navigateurs Chromium).

**Test Playwright du scénario de démo** : `pnpm --filter frontend test:e2e` (voir `frontend/playwright.config.ts`). Il démarre sa propre API (port 4100) et un build de production (port 3100, dossier `.next-e2e`) pour ne pas gêner les serveurs de développement, et remet le parcours d’Aminata à zéro avant et après. Sous Windows, Playwright peut laisser tourner les serveurs qu’il a lancés : vérifiez les ports 3100 et 4100 après coup.

## Ajouts du 5 novembre 2026 (suite) : rôle admin unique, vérification des profils, mentoré devenant mentor

**Rôle unique.** `SUPER_ADMIN` est supprimé (migration `single_admin_role` : les comptes concernés deviennent `ADMIN`). Toutes les routes de l'ancien espace super-admin sont désormais sous `/admin/*` et réservées à `ADMIN` : `metrics`, `impact-report.csv`, `team`, `users/:id/role`, `audit`, `certificates`, `certificates/:code/revoke`. Un admin peut suspendre un autre admin (action tracée), jamais lui-même ; il ne peut pas générer de lien de réinitialisation pour un autre admin (403 `STAFF_PROTECTED`).

**Vérification et candidatures.**

| Route | Accès | Détail |
|---|---|---|
| `GET /verification/me` | 🔒 | `{ requests: VerificationRequest[], mentorProfile: { verificationStatus, isPublished } \| null }` |
| `POST /verification/mentor` | 🔒 MENTOR, 5/h | `{ message (30–2000), profileUrl? (https) }` ; 409 `VERIFICATION_ALREADY_PENDING`, `ALREADY_VERIFIED`, `MENTOR_PROFILE_REQUIRED` |
| `POST /verification/mentor-application` | 🔒 MENTEE, 5/h | Corps du profil mentor (comme `PUT /profile/mentor`) + `message` + `profileUrl?` ; le profil est créé **non publié** |
| `POST /verification/:id/documents` | 🔒 auteur, demande en attente | Multipart `file` : PDF, JPEG, PNG ou WebP, 10 Mo, 3 par demande (409 `TOO_MANY_DOCUMENTS`) |
| `DELETE /verification/:id` | 🔒 auteur | Retrait d'une demande en attente |
| `GET /verification/documents/:id` | 🔒 auteur ou admin | Téléchargement (404 pour les autres) |
| `GET /admin/verifications?status=&kind=` | 🔒 ADMIN | File d'examen (en attente : la plus ancienne d'abord) avec profil, historique en tant que mentoré, justificatifs |
| `POST /admin/verifications/:id/approve` | 🔒 ADMIN | `{ note? }` ; candidature : le compte devient MENTOR, profil publié et vérifié, demandes en attente annulées ; 409 `USER_HAS_ACTIVE_MENTORING` si un mentorat est en cours en tant que mentoré |
| `POST /admin/verifications/:id/reject` | 🔒 ADMIN | `{ note }` obligatoire (10 caractères au moins) |

`VerificationRequest = { id, kind: 'MENTOR_VERIFICATION'|'MENTOR_APPLICATION', status: 'PENDING'|'APPROVED'|'REJECTED'|'WITHDRAWN', message, profileUrl, decisionNote, decidedAt, createdAt, documents[] }`. Notifications `VERIFICATION_APPROVED` et `VERIFICATION_REJECTED` ; décisions tracées dans le journal d'audit. La base garantit une seule demande en attente par personne et un motif pour chaque refus. Frontend : section « Vérification du profil » ou « Devenir mentor » dans `/compte`, page `/devenir-mentor`, page `/admin/verifications`.

## Ajouts du 6 novembre 2026 : hors ligne, faible débit et assistance par IA

**Hors ligne** (build de production : le service worker n'est pas actif avec `pnpm dev`).
- Le cache TanStack Query est écrit dans IndexedDB (`features/offline/cache.ts`), 7 jours au plus : session, profil, tableau de bord, mentorats, messages, objectifs, séances, groupes. Effacé dès qu'il n'y a plus de session.
- Après la connexion, les 5 dernières conversations et les pages de l'espace connecté sont préchargées, sauf en économie de données.
- `POST /mentorships/:id/messages` et `POST /groups/:id/messages` acceptent `clientId` (8 à 64 caractères, lettres, chiffres, tiret) : renvoyer le même identifiant renvoie le même message.
- La file d'envoi (`features/offline/outbox.ts`) ne contient que du texte. Les fichiers exigent le réseau.
- `lib/connectivity.ts` combine `navigator.onLine` et l'échec réel des requêtes (test de `/health` toutes les 15 s).

**Économie de données** (`lib/data-saver.ts`) : automatique sur 2G ou si le téléphone le demande, réglable dans Mon compte. Actualisations espacées (`poll()`), photos décoratives et de profil masquées, photos de conversation à la demande.

**Assistance par IA** (`modules/ai`, facultative, `OPENAI_API_KEY` dans `backend/.env`). Le score reste calculé par les règles.

| Route | Accès | Détail |
|---|---|---|
| `GET /ai/status` | 🔓 | `{ enabled, remainingToday, assistantRemainingToday }` : l'interface masque l'assistant si `enabled` est faux |
| `POST /ai/assistant` | 🔓 (visiteurs : 15 questions par jour et par IP, liens vers les seules pages publiques), 20/min | `{ question (2–600), history?[{ role: 'user'\|'assistant', content }] (≤12), page? }` → `{ answer, links[{ href, label }] }` : assistant qui répond aux questions sur le fonctionnement de la plateforme (widget « Une question ? » de l'espace connecté). Liens limités aux pages permises au rôle ; le serveur ne conserve pas la conversation |
| `POST /ai/orientation` | 🔒, 10/min | `{ need (20–1000) }` → `{ summary, domains[{ id, slug, name, reason }], skills[] }` (domaines limités au catalogue) |
| `POST /ai/mentors/:id/explanation` | 🔒 MENTEE, 20/min | `{ score, reasons[], text, source: 'ai'\|'rules' }` ; sans IA, `text` est nul et les raisons restent (mise en cache 24 h) |
| `POST /ai/mentorships/:id/path-proposal` | 🔒 participant (mentorat actif), 10/min | `{ focus? (≤300) }` → `{ goals[{ title, description, milestones[] }] }` : rien n'est enregistré, l'interface crée ensuite les objectifs validés via `POST /mentorships/:id/goals` |

Erreurs : 503 `AI_UNAVAILABLE`, 429 `AI_QUOTA_REACHED` (30 appels par personne et 1000 au total par jour, réglables ; l'assistant a son propre quota de 60 questions par personne et par jour, `AI_ASSISTANT_DAILY_LIMIT`). Un refus 429 du fournisseur est réessayé une fois après 1,5 s. Emails, liens et numéros sont retirés des textes libres avant l'envoi ; aucun nom ni message privé n'est transmis.

### Qualité de l'IA : banc d'évaluation (5 novembre)

`pnpm --filter backend ai:eval -- <modèles>` rejoue sur de vrais appels OpenAI 12 besoins types (dont une écriture familière et une tentative de manipulation), les profils de démonstration et 6 mentorats, puis contrôle : domaines attendus, compétences qui trouvent réellement un mentor, vouvoiement, formules creuses, honnêteté des correspondances faibles, premier objectif lié à l'objectif initial, respect de la précision demandée, durée et jetons. Les consignes sont dans `modules/ai/ai.prompts.ts`.

**Assistant** : il ne répond qu'à partir du guide `modules/ai/assistant.knowledge.ts` (texte et liste des pages par rôle). **À mettre à jour à chaque évolution fonctionnelle**, sinon l'assistant décrira l'ancien comportement. `pnpm --filter backend ai:eval-assistant -- gpt-5.4-mini` rejoue 27 questions (trois rôles, hors sujet, tentative de manipulation, suivi de conversation) et contrôle mots attendus, mots interdits et liens : 27/27, environ 2,5 s et 3 800 jetons d'entrée par question.

Résultat : modèle par défaut `gpt-5.4-mini` (effort de raisonnement `low`). Les consignes s'appuient sur les compétences réellement proposées par les mentors, les parcours guidés du domaine et le niveau de correspondance (forte, partielle, faible).

### Bibliothèque : validation, couvertures, livres (6 novembre)

- Types ajoutés : `BOOK`, `GUIDE`, `PODCAST`. Champs : `status` (`PUBLISHED` | `PENDING` | `REJECTED`), `workAuthor`, `language`, `license` (`AUTHOR` | `PERMISSION` | `CC` | `PUBLIC_DOMAIN`), `reviewNote`, `reviewedAt`, `downloadCount`, `cover`.
- `POST /resources/upload` (multipart) : champs + `file` (document) + `cover` (image JPEG/PNG/WebP ≤ 1 Mo, réduite par le navigateur). Un document exige `license` et `rightsConfirmed=true` (422 `RIGHTS_REQUIRED`). Document d'un mentor : `PENDING` (10 Mo max) ; équipe : publié directement (25 Mo max) ; lien ou conseil : publié directement.
- `GET /resources` 🔓 : seulement les ressources publiées. `GET /resources/mine` 🔒 M/A : mes publications, tous statuts. `GET /resources/:id/cover` 🔓.
- Équipe : `GET /admin/resources?status=PENDING|PUBLISHED|REJECTED`, `POST /admin/resources/:id/approve`, `POST /admin/resources/:id/reject { note (10–500) }` (409 `RESOURCE_ALREADY_REVIEWED`). Notifications `RESOURCE_SUBMITTED` (équipe), `RESOURCE_APPROVED` / `RESOURCE_REJECTED` (auteur) ; journal d'audit. `GET /admin/overview` renvoie `pendingResources`.
- Téléchargements comptés (hors auteur et équipe). Migration `20261106150000_resource_library`.

