# Architecture — Talents Connectés

> Plateforme de mentorat du hackathon « Talents connectés » (Conakry, novembre 2026).
> Monolithe modulaire, monorepo pnpm. Ce document décrit ce qui est **réellement implémenté**.

## 1. Vue d'ensemble

```text
 Navigateur (mobile ou ordinateur)
        │  HTTPS, cookie de session HttpOnly « tc_session »
        ▼
 ┌─────────────────────────────┐
 │ frontend/  Next.js 16       │  App Router, React 19, Tailwind 4, TanStack Query
 │  - pages et composants      │  proxy.ts : redirige vers /connexion sans cookie
 │  - rewrite /api/v1/* ───────┼──┐  (même origine : pas de CORS côté navigateur)
 └─────────────────────────────┘  │
                                  ▼
 ┌─────────────────────────────────────────────┐
 │ backend/  NestJS 12 (API REST /api/v1)      │  seule autorité métier
 │  garde de session → garde de rôle → service │  Swagger : /api/docs
 │  ValidationPipe (422), filtre d'erreurs      │
 └─────────────────────────────────────────────┘
                                  │ Prisma 7 (adaptateur pg)
                                  ▼
 ┌─────────────────────────────────────────────┐
 │ PostgreSQL 17 (Docker, 127.0.0.1:5450)      │  migrations versionnées
 │  contraintes d'intégrité : index partiels,  │  seed idempotente
 │  exclusion GiST, CHECK                      │
 └─────────────────────────────────────────────┘
```

**Principe directeur :** NestJS est la seule autorité sur la logique métier et l'accès aux
données. Le frontend n'accède jamais à la base ; il n'implémente aucune règle d'autorisation
(il masque seulement ce que l'API refuserait de toute façon).

## 2. Modules du backend (`backend/src/modules`)

| Module | Responsabilité |
|---|---|
| `auth` | Inscription, connexion, déconnexion (dont « tous les appareils »), changement de mot de passe |
| `profile` | Profils mentor et mentoré, compte, **photo de profil**, export JSON et suppression par anonymisation |
| `domains` | Catalogue des 7 domaines des TDR |
| `mentors` | Annuaire (recherche sans accents, filtres, pagination), fiche publique, compteurs réels |
| `matching` | Score de suggestion déterministe et explicable (`matching.ts`, testé unitairement) — pas d'IA |
| `mentorship-requests` | Demande motivée, acceptation idempotente, refus, annulation |
| `mentorships` | Espace de mentorat, clôture avec bilan |
| `scheduling` | Créneaux, réservation, confirmation (lien Jitsi généré), annulation, clôture, évaluation |
| `messages` | Conversation privée persistée, accusés de lecture |
| `goals` | Objectifs, jalons, progression calculée, retour du mentor |
| `resources` | Bibliothèque publique et partage privé dans un mentorat |
| `opportunities` | Stages, emplois, appels à projets, bourses, formations, événements |
| `certificates` | Certificat d'accompagnement délivré à la clôture, vérification publique par code |
| `notifications` | Notifications in-app |
| `dashboard` | Indicateurs par rôle |
| `admin` | Comptes, suspension, vérification et publication des mentors, domaines |
| `platform` | Pilotage, équipe d'administration, journal d'audit, révocation des certificats, rapport d'impact (routes `/admin/*`) |
| `verification` | Vérification des profils mentors et candidatures de mentorés pour devenir mentor (justificatifs privés, décision motivée) |
| `health` | Santé de l'API et de la base |

Code commun (`backend/src/common`) : gardes, décorateurs `@Public()` / `@Roles()`, middleware
CSRF, filtre d'erreurs, pipe de validation, pagination, recherche normalisée, `audit.ts`.

## 3. Parcours d'une requête

1. Le navigateur appelle `/api/v1/...` sur l'origine du site ; Next.js la réécrit vers l'API.
2. **Middleware CSRF** : pour `POST`, `PUT`, `PATCH`, `DELETE`, l'en-tête `Origin` doit figurer dans `WEB_ORIGINS`.
3. **Limitation de débit** (`@nestjs/throttler`) : globale, plus stricte sur la connexion et les messages.
4. **Garde de session** (globale) : le jeton du cookie est haché (HMAC-SHA256) et recherché dans `auth_sessions` ; session révoquée, expirée ou compte suspendu ⇒ 401. Routes `@Public()` : la session est lue si elle existe, sans être exigée.
5. **Garde de rôle** : `@Roles('MENTOR')`, `@Roles('ADMIN')`… Trois rôles seulement : MENTEE, MENTOR, ADMIN.
6. **Validation** des DTO (class-validator) ⇒ 422 avec le détail par champ.
7. **Service** : contrôle d'appartenance (participant du mentorat, auteur, mentor concerné…), puis transaction Prisma.
8. Erreurs au format stable : `{ statusCode, code, message, details?, path, timestamp }`.

## 4. Sécurité

- **Mots de passe** : Argon2id. **Sessions** : jeton opaque, seul son hash est stocké, donc révocable (déconnexion de tous les appareils, suspension, changement de rôle, changement de mot de passe).
- **Cookie** `tc_session` : HttpOnly, SameSite=Lax, Secure en production. Pas de JWT, rien dans le `localStorage`.
- **Données publiques minimales** : la fiche mentor n'expose ni email ni téléphone ; un certificat public affiche le mentoré sous la forme « Prénom I. ».
- **Photos de profil** : type réel vérifié sur les octets (JPEG, PNG, WebP), 1 Mo maximum, visibles publiquement seulement pour un mentor publié ; sinon par la personne, l'équipe ou une personne liée par une demande ou un mentorat.
- **Journal d'audit** : chaque action de l'équipe (suspension, rôle, modération, domaine, certificat, retrait de contenu) est tracée ; il ne contient jamais de contenu de conversation.
- **Suppression de compte** : anonymisation (l'historique de l'autre participant est préservé), photo effacée, certificats du mentor révoqués.

## 5. Invariants garantis par la base

Définis dans les migrations (`backend/prisma/migrations`), donc impossibles à contourner par un bug applicatif :

| Invariant | Mécanisme |
|---|---|
| Une seule demande `PENDING` par couple mentoré–mentor | Index unique partiel |
| Un seul mentorat `ACTIVE` par couple | Index unique partiel |
| Pas de chevauchement de créneaux d'un même mentor | Contrainte d'exclusion GiST |
| Pas de chevauchement de séances, une seule séance active par créneau | Exclusion GiST, index partiel |
| Certificat : au moins une séance, dates et note cohérentes, format du code | Contraintes CHECK |
| Photo : 1 Mo maximum, trois formats | Contraintes CHECK |

Exemple vérifié par les tests : 8 réservations simultanées du même créneau ⇒ une seule réussit.

## 6. Données et temps

- Dates stockées en UTC (`timestamptz`), affichées dans le fuseau de l'utilisateur (`Africa/Conakry` par défaut).
- Le certificat est un **instantané** : ses chiffres (séances, durée, objectifs, note) sont figés à la clôture.

## 7. Frontend (`frontend/src`)

- `app/` : routes. Groupes : `(public)` (accueil, connexion, inscription), `(directory)` (annuaire, fiche mentor, ressources, opportunités, certificats : accessibles connecté ou non), `(app)` (espace connecté).
- `features/` : un dossier par domaine (hooks TanStack Query dans `api.ts`, composants d'écran).
- `components/` : interface commune (boutons, champs, dialogues, en-tête, navigation).
- Messagerie : rafraîchissement automatique (environ 4 s quand la page est visible), pas de WebSocket.

## 8. Choix structurants et alternatives écartées

| Choix | Raison | Écarté |
|---|---|---|
| Monolithe modulaire | Livrable en 4 jours, simple à déployer | Microservices |
| Session opaque en cookie | Révocable immédiatement, pas de jeton exposé au JavaScript | JWT en `localStorage` |
| Invariants en SQL | Résistent à la concurrence réelle | Vérifications seulement dans l'interface |
| Score de suggestion explicable | Transparent pour le mentoré, testable | IA « boîte noire » |
| Visio Jitsi externe | Fiable, présentée honnêtement | WebRTC maison |
| Rafraîchissement du chat | Robuste sur un réseau instable | Socket.IO (évolution possible) |

## 9. Tests et vérifications

- **142 tests e2e** sur un vrai PostgreSQL (base `talents_connectes_test` recréée à chaque exécution) et 15 tests unitaires (Vitest).
- Typecheck et lint (oxlint côté API, ESLint côté web), build de production du frontend.
- CI GitHub Actions : `.github/workflows/ci.yml`.

## 10. Limites connues

Pas d'emails transactionnels ni de réinitialisation de mot de passe ; pas de tests automatisés du frontend (Playwright) ; chat sans temps réel ; avertissement `pg` émis par `@prisma/adapter-pg` 7.10.1 dans certaines transactions (sans effet fonctionnel).
