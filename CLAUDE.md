# CLAUDE.md — Talents Connectés (plateforme de mentorat)

Hackathon « Talents connectés », Conakry, 4–7 novembre 2026. Monolithe modulaire, monorepo pnpm.

## À lire en premier
1. `TDR_Hackathon_Talents_Connectes_Mentorat_2026.md` : termes de référence, **source métier prioritaire**.
2. `PROMPT_CLAUDE_CODE_HACKATHON_MENTORAT_2026.md` : cahier de mission technique et produit.
3. `docs/HANDOFF_FRONTEND.md` : état réel et contrat d'API implémenté.
4. `docs/architecture/overview.md`, `docs/product/mvp.md`, `docs/design/design-system.md` : architecture, périmètre produit, système de design.

## Structure
- `backend/` : NestJS 12 (ESM, TypeScript 6, Vitest, oxlint), Prisma 7.10.1 (générateur `prisma-client`, adaptateur `pg`, client généré dans `backend/src/generated/`, ignoré par git), PostgreSQL 17.
  - `src/modules/*` : auth, domains, profile (dont photo de profil), mentors, matching, mentorship-requests, mentorships, scheduling (availability, sessions et évaluations), messages, goals, resources, opportunities, certificates, notifications, dashboard, admin, platform (pilotage, équipe, journal d’audit, certificats, rapport d’impact), verification (vérification des profils et candidatures de mentor), ai (assistance facultative via OpenAI), groups, calls, realtime, health.
  - `src/common` : gardes (session globale, rôles), middleware CSRF par Origin, filtre d'erreurs, ValidationPipe (422).
  - `prisma/migrations/*_integrity_constraints` : index partiels et contraintes d'exclusion (anti double réservation). **Ne pas les supprimer.**
- `frontend/` : Next.js 16.4.5, App Router, React 19.3, Tailwind 4. Lire `frontend/AGENTS.md` (breaking changes de Next 16).
- `backend/docker-compose.yml` : PostgreSQL sur `127.0.0.1:5450` (variables `POSTGRES_*` lues dans `backend/.env`).

## Commandes (depuis la racine)
```bash
pnpm install
pnpm db:up            # PostgreSQL (Docker)
pnpm db:deploy        # migrations
pnpm db:seed          # seed idempotente (domaines et comptes fictifs)
pnpm db:demo-reset    # remet à zéro le parcours d'Aminata
pnpm dev:backend      # http://localhost:4000/api/v1 — Swagger : /api/docs
pnpm dev:frontend     # http://localhost:3000
pnpm --filter backend test      # tests unitaires (Vitest)
pnpm --filter backend test:e2e  # 151 tests e2e sur talents_connectes_test (recréée à chaque fois ; copier backend/.env.test.example vers .env.test)
pnpm --filter backend typecheck
pnpm --filter backend lint
pnpm --filter backend ai:eval -- gpt-5.4-mini   # banc d'évaluation de l'IA (vrais appels OpenAI, quelques centimes)
pnpm --filter backend ai:eval-assistant -- gpt-5.4-mini   # banc de l'assistant (27 questions)
pnpm --filter frontend test:e2e # Playwright : scénario de démo complet et mode hors ligne (ports 3100/4100, remet la démo à zéro)
```
Comptes de démo (dev uniquement) : `<prenom>@demo.talents-connectes.test`, mot de passe `Mentorat2026!` (aminata, mohamed, fatoumata, thierno, mariama, sekou, aissatou, lansana, admin).

## Décisions structurantes
- Rôles : MENTEE, MENTOR, ADMIN (un seul rôle d'administration depuis le 5 novembre : le super-administrateur a été supprimé). L'admin modère, vérifie les profils, pilote (`/admin/*`), gère l'équipe (jamais son propre rôle) et consulte le journal d'audit. Il ne peut pas générer de lien de réinitialisation pour un autre admin.
- Vérification des profils : un mentor demande la vérification (message, lien professionnel, 3 justificatifs PDF ou image) ; un mentoré candidate pour devenir mentor (profil mentor complet non publié + motivation + justificatifs). L'admin valide ou refuse avec motif (`/admin/verifications`). Une candidature acceptée fait passer le compte en MENTOR (profil publié et vérifié) ; refusée si un mentorat est encore en cours en tant que mentoré.
- Plus de capacité maximale par mentor ; certificat d'accompagnement délivré à la clôture d'un mentorat avec au moins une séance réalisée (instantané figé, vérifiable via `/certificats/<code>`).
- **NestJS est la seule autorité** sur la logique métier et l'accès à PostgreSQL. Le frontend passe par un rewrite Next.js `/api/v1/*` → API (même origine).
- Authentification : jeton de session opaque dans un cookie `tc_session` HttpOnly, SameSite=Lax (Secure en production). Seul le hash HMAC-SHA256 est stocké (`auth_sessions`), ce qui permet la révocation. Mots de passe en Argon2id. Pas de JWT.
- CSRF : vérification de l'en-tête `Origin` sur les méthodes modifiantes (liste `WEB_ORIGINS`).
- Invariants garantis par la base (et non par l'interface) : 1 demande PENDING par couple, 1 mentorat ACTIVE par couple, aucun chevauchement de créneaux ni de séances (exclusion GiST), 1 séance active par créneau.
- Annuaire : ordre par défaut = profil vérifié, expérience démontrée sur la plateforme, disponibilité, années d'expérience (`modules/mentors/ranking.ts`) ; menu « Trier par » (`sort`) ; badge « Mentor confirmé » (3 accompagnements terminés et note ≥ 4 sur ≥ 3 avis).
- Erreurs : `{ statusCode, code, message, details?, path, timestamp }` ; codes métier stables (voir le handoff §4).
- Suggestions : score déterministe et explicable (`modules/matching/matching.ts`). L'IA (OpenAI `gpt-5.4-mini` par défaut, retenu au banc `ai:eval` ; côté serveur, facultative : `OPENAI_API_KEY`) assiste sans décider : orientation, reformulation des raisons du score, proposition de parcours validée par un participant, et assistant « Une question ? » (`POST /ai/assistant`) qui répond sur le fonctionnement de la plateforme à partir de `modules/ai/assistant.knowledge.ts` (**à mettre à jour à chaque évolution fonctionnelle**). Aucun nom, email ni message privé envoyé ; rien ne casse sans clé.
- Hors ligne : cache TanStack Query persisté dans IndexedDB (`features/offline`), file d'envoi des messages avec `clientId` (pas de doublon), effacement à la déconnexion. Sans réseau, `/mentorats/<id>` passe par la route statique `/mentorats/consultation?id=` (service worker).
- Dates en UTC (timestamptz) ; affichage dans le fuseau de l'utilisateur (`Africa/Conakry` par défaut).

## Conventions
- Code et identifiants en anglais ; interface, messages d'erreur et documentation en français.
- Imports ESM avec extension `.js` dans le backend (nodenext).
- Pas de faux boutons, pas de données factices présentées comme réelles, pas de statistiques inventées.
- **Git : Claude ne fait ni `git add`, ni `git commit`, ni `git push`.** Il crée la branche, code, vérifie, puis propose les commandes à Bakary. Aucune attribution à Claude dans les commits ni dans les documents.

## État au 5 novembre 2026
- Backend P0 et P1 complets (chat, objectifs, évaluation des séances, ressources, notifications, compte, clôture de mentorat, admin avec gestion des domaines, opportunités, export et suppression de compte, photo de profil, certificats d’accompagnement vérifiables). Plus de capacité maximale par mentor. Parcours guidés, ateliers de groupe, rapport d’impact CSV, réinitialisation du mot de passe par lien remis par l’équipe. Vérifiés par 30 tests unitaires et **151 tests e2e** sur un vrai PostgreSQL (double réservation concurrente, accès d'un tiers, transitions invalides, CSRF…).
- CI GitHub Actions : `.github/workflows/ci.yml` (backend : typecheck, lint, tests unitaires et e2e, build).
- Livrables du jury : `docs/jury/` (présentation, scénario de démo, note de pérennisation, pitch, checklist).
- Frontend : complet et relié à l'API (accueil, annuaire, fiche mentor, demandes, séances avec évaluation, espace de mentorat avec ressources et clôture, ressources, opportunités, notifications, compte, administration). Direction visuelle inspirée de NOVA : Lexend pour les titres, Schibsted Grotesk pour le texte, bleu encre, turquoise et ambre, photos sous licence libre (crédits dans `frontend/public/images/credits.json`).
- Temps réel : WebSocket `/api/v1/ws` (cookie de session + Origin) pour les nouveaux messages et la signalisation des appels audio/vidéo WebRTC (conversations privées). État des appels en mémoire : une seule instance de l'API. TURN (coturn) optionnel : `docker compose --profile calls`.
- PWA installable (manifeste, service worker en production uniquement) ; relecture et envoi différé sans réseau ; économie de données (automatique sur 2G, réglable dans Mon compte) ; appels audio plafonnés à 32 kbit/s avec compteur de données.
- À faire côté backend : emails transactionnels (la réinitialisation passe pour l’instant par un lien remis par l’équipe) ; surveiller l'avertissement `pg` émis par `@prisma/adapter-pg` 7.10.1 dans les transactions.
