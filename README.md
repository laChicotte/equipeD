# Talents Connectés — plateforme de mentorat

Prototype réalisé pour le hackathon **« Talents connectés »** (Salon international du livre de jeunesse de Conakry, Mois du Numérique, 4–7 novembre 2026).
La plateforme met en relation **mentors** et **mentorés** : recherche par domaine et compétence, demande d'accompagnement motivée, acceptation, planification de séances sans double réservation, conversation privée et suivi d'objectifs.

> « Talents Connectés » est un nom provisoire.

## Stack

| Couche | Technologies |
|---|---|
| Frontend | Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS 4, shadcn/ui, TanStack Query |
| Backend | NestJS 12, TypeScript, Prisma 7, class-validator, Swagger |
| Données | PostgreSQL 17 (Docker) |
| Sécurité | Cookie de session HttpOnly, Argon2id, vérification CSRF par Origin, RBAC et contrôle d'appartenance, rate limiting, Helmet |

## Démarrage rapide

Prérequis : Node ≥ 22.12, pnpm 10, Docker.

```bash
pnpm install
pnpm db:up
cp backend/.env.example backend/.env   # remplacer SESSION_SECRET
pnpm db:deploy
pnpm db:seed
pnpm dev:backend                       # http://localhost:4000/api/v1  (Swagger : /api/docs)
pnpm dev:frontend                      # http://localhost:3000
```

Comptes fictifs (développement uniquement), mot de passe `Mentorat2026!` :
`aminata@demo.talents-connectes.test` (mentorée), `fatoumata@demo.talents-connectes.test` (mentore), `admin@demo.talents-connectes.test`.

## Documentation

- `CLAUDE.md` : décisions, structure, commandes, état.
- `docs/HANDOFF_FRONTEND.md` : contrat d'API, plan frontend, système de design.
- `TDR_Hackathon_Talents_Connectes_Mentorat_2026.md` : termes de référence (transcription).

## Dépannage

- **Port 5450 occupé** : modifier `POSTGRES_PORT` et `DATABASE_URL` dans `backend/.env`.
- **`403 ORIGIN_NOT_ALLOWED`** : ajouter l'URL du frontend dans `WEB_ORIGINS` (`backend/.env`).
- **Client Prisma absent** : `pnpm --filter backend prisma:generate`.
