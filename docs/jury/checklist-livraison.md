# Checklist de livraison — état réel au 4 novembre 2026

> Document honnête : il ne décrit comme opérationnel que ce qui a été **exécuté et vérifié**.
> À mettre à jour par l'équipe frontend au fur et à mesure (section « Frontend »).

## Livrables obligatoires (TDR §11)

| Livrable | État | Fichier |
|---|---|---|
| Prototype fonctionnel ou démontrable | Backend ✅ · Frontend 🚧 en cours (autre poste) | `backend/`, `frontend/` |
| Présentation du projet | ✅ | `docs/jury/presentation-projet.md` |
| Démonstration du parcours utilisateur | ✅ scénario écrit · à répéter avec le frontend | `docs/jury/scenario-demo.md` |
| Note de pérennisation | ✅ | `docs/jury/note-perennisation.md` |
| Pitch oral | ✅ texte et Q&R · à répéter | `docs/jury/pitch-jury.md` |

## Périmètre fonctionnel (API backend)

### P0
- [x] API NestJS reliée à PostgreSQL 17 via Prisma 7, migrations versionnées, seed idempotente
- [x] Authentification : cookie HttpOnly SameSite=Lax, Argon2id, sessions révocables, protection CSRF par Origin, rate limiting
- [x] RBAC (mentoré, mentor, admin) et contrôle d'appartenance sur chaque ressource
- [x] Profils et onboarding différenciés
- [x] Catalogue des 7 domaines des TDR
- [x] Annuaire avec filtres, pagination et recherche insensible aux accents
- [x] Fiche mentor publique sans donnée privée
- [x] Demande motivée, acceptation idempotente, refus, annulation ; transitions invalides → 409
- [x] Disponibilités sans chevauchement ; réservation, confirmation, annulation, clôture ; **double réservation impossible** (contraintes PostgreSQL)
- [x] Tableau de bord par rôle (chiffres réels)

### P1
- [x] Conversation privée persistée (non-lus, actualisation incrémentale)
- [x] Objectifs, jalons, progression calculée, retour du mentor
- [x] Évaluation des séances (1–5 et commentaire), note moyenne sur la fiche mentor
- [x] Administration : vue d’ensemble, comptes, suspension (révoque les sessions), vérification et publication des mentors, gestion des domaines
- [x] Compte : modification du nom et du fuseau, changement de mot de passe (révoque les autres sessions), déconnexion de tous les appareils
- [x] Clôture d’un mentorat avec bilan (séances futures annulées, capacité libérée, lecture seule)
- [x] Ressources : bibliothèque publique (mentors et admins) et partage privé dans un mentorat (liens https ou conseils rédigés)
- [x] Notifications in-app (demande reçue, acceptée ou refusée ; séance demandée, confirmée ou annulée ; retour sur objectif ; ressource partagée)

### P2
- [x] Suggestions par score déterministe et explicable (pas d'IA)
- [x] Visio : salle Jitsi Meet générée automatiquement à la confirmation (service externe, présenté comme tel ; pas de WebRTC maison)
- [x] Espace d’opportunités (stages, emplois, appels à projets, bourses, formations, événements), avec archivage et échéances
- [x] Confidentialité : export JSON de ses données, suppression du compte par anonymisation (l’historique de l’autre participant est préservé)
- [ ] Emails transactionnels, PWA

## Frontend
- [x] Accueil : hero plein écran (diaporama), recherche de mentors en direct, chiffres réels, domaines, parcours, mentors, confiance
- [x] Connexion, inscription, onboarding différencié mentor et mentoré
- [x] Annuaire « Trouver un mentor » : filtres rapides par domaine, modalité, langue, disponibilité, recommandations expliquées
- [x] Fiche mentor, demande motivée, demandes reçues et envoyées, tableau de bord par rôle
- [x] Disponibilités, réservation, confirmation avec salle de visio, annulation, évaluation des séances (1 à 5 et commentaire)
- [x] Espace de mentorat : conversation, objectifs et jalons, séances, ressources partagées, clôture avec bilan
- [x] Bibliothèque de ressources (/ressources) et opportunités (/opportunites), publication par les mentors
- [x] Cloche de notifications in-app
- [x] Mon compte : informations, mot de passe, déconnexion de tous les appareils, export JSON, suppression
- [x] Administration : vue d’ensemble, comptes, mentors, domaines
- [x] Build de production : 22 routes, typecheck et lint sans erreur
- [ ] Revue responsive écran par écran à 375 px (accueil et annuaire vérifiés)

## Tests exécutés

| Vérification | Résultat | Commande |
|---|---|---|
| Typecheck backend | ✅ | `pnpm --filter backend typecheck` |
| Lint (oxlint) | ✅ 0 avertissement | `pnpm --filter backend lint` |
| Format (Prettier) | ✅ | `npx prettier --check "backend/{src,test,prisma}/**/*.ts"` |
| Tests unitaires | ✅ 8/8 | `pnpm --filter backend test` |
| Tests e2e sur un vrai PostgreSQL | ✅ **100/100** (10 fichiers, environ 40 s) | `pnpm --filter backend test:e2e` |
| Build | ✅ | `pnpm --filter backend build` |
| CI GitHub Actions | ⏳ configurée (`.github/workflows/ci.yml`), à confirmer au premier push | |

Les tests e2e couvrent notamment :
- inscription avec email dupliqué ou formulaire invalide ;
- décision sur une demande appartenant à autrui ;
- double acceptation concurrente ;
- **8 réservations simultanées du même créneau → une seule réussit** ;
- message ou objectif dans un mentorat non autorisé ;
- transitions d'état invalides ;
- CSRF ;
- compte suspendu ;
- absence de données privées dans les réponses publiques.

## Bugs connus et limites honnêtes

- **Avertissement `pg` « client.query() already executing »** pendant les tests : il est émis à l'intérieur de `@prisma/adapter-pg` 7.10.1 lors de certaines transactions. Il est sans effet fonctionnel (les requêtes sont mises en file), mais à revoir lors d'une montée de version de Prisma.
- La messagerie fonctionne par **rafraîchissement périodique** (pas de WebSocket) : quelques secondes de latence.
- Aucun email n'est envoyé (réinitialisation de mot de passe non disponible).
- Pas de visio native : lien de réunion externe saisi par le mentor.
- Pas de revue de conformité juridique (données personnelles) : à mener avant toute mise en production.
- Les comptes de démonstration (`@demo.talents-connectes.test`, mot de passe commun) ne doivent **jamais** être chargés en production. La seed les refuse si `NODE_ENV=production`, sauf `SEED_DEMO=true` explicite.
