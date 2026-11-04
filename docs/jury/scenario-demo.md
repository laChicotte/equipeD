# Scénario de démonstration (3 à 5 minutes)

**Récit :** Aminata, jeune diplômée en informatique, cherche un accompagnement en développement web. Elle trouve Fatoumata, lui écrit, est acceptée, réserve une séance, échange avec elle et suit son premier objectif.
Toutes les personnes et données sont **fictives**.

## Préparation (la veille, puis 15 minutes avant)

```bash
pnpm db:up && pnpm db:deploy && pnpm db:seed   # base prête (idempotent)
pnpm db:demo-reset                              # remet le parcours d'Aminata à zéro
pnpm dev:backend                                # API sur :4000
pnpm dev:frontend                               # interface sur :3000
```

- Deux navigateurs, ou une fenêtre normale et une fenêtre de navigation privée : **A = Aminata** (mentorée), **F = Fatoumata** (mentore).
- Mot de passe des deux comptes : `Mentorat2026!` · `aminata@demo.talents-connectes.test` · `fatoumata@demo.talents-connectes.test`.
- Vérifier `http://localhost:4000/api/v1/health` → `{"status":"ok","database":"up"}`.
- Zoom du navigateur à 110–125 % pour la salle ; notifications du système désactivées.

## Déroulé minuté

| Temps | Écran | Action | Message clé à dire |
|---|---|---|---|
| 0:00 | Accueil | Montrer la proposition de valeur et les 7 domaines | « Les domaines sont ceux des TDR, et les compteurs de mentors viennent de la base. » |
| 0:20 | **A** Connexion | Se connecter en tant qu'Aminata | Compte de démonstration, profil déjà complété |
| 0:35 | **A** Tableau de bord | Montrer les « Suggestions pour vous » | « Fatoumata est suggérée, et la plateforme explique pourquoi. » |
| 0:50 | **A** Annuaire | Taper « developpement web » **sans accent** | Recherche tolérante ; filtres par domaine, modalité et disponibilité |
| 1:05 | **A** Fiche Fatoumata | Parcourir l'expérience, les langues, le badge « Profil vérifié » et les créneaux | Aucun email ni téléphone exposé publiquement |
| 1:20 | **A** Demande | Objectif : « Devenir développeuse web junior » ; message motivé → Envoyer | Statut **En attente** |
| 1:40 | **F** Demandes reçues | Se connecter en tant que Fatoumata, ouvrir la demande, lire la motivation → **Accepter** | Seule la mentore sollicitée peut décider |
| 2:00 | **A** Mes demandes | Rafraîchir : statut **Acceptée**, mentorat ouvert | Mise en relation effective |
| 2:15 | **A** Espace de mentorat → Séances | Réserver un créneau ; sujet « Revue de mon portfolio » | « Si deux personnes cliquent en même temps, une seule obtient le créneau. » |
| 2:35 | **F** Séances | **Confirmer**, en collant un lien de réunion externe | Visio : lien externe assumé, pas de fausse visio intégrée |
| 2:55 | **A/F** Conversation | A : « Merci pour votre acceptation ! » ; F répond | Conversation privée, visible des seuls participants |
| 3:20 | **A** Objectifs | Créer « Publier mon portfolio » avec 3 jalons | |
| 3:35 | **F** Objectifs | Cocher un jalon (33 %) et écrire un retour | Le retour est réservé à la mentore |
| 3:55 | **F** Tableau de bord | Mentorés actifs, séances à venir, progression moyenne | Indicateurs réels, aucun chiffre fictif |
| 4:10 | (option) Mohamed | Montrer une séance passée évaluée 5/5 | Évaluation des séances |
| 4:30 | Fin | | « Tout ce que vous avez vu est enregistré dans PostgreSQL et fonctionne aussi sur mobile. » |

## Points forts à montrer si le jury pose la question

- **Sécurité :** se connecter en tant que Mohamed et tenter d'ouvrir l'URL de la conversation d'Aminata → « Accès refusé ».
- **Mobile :** passer l'outil de développement en largeur 375 px ; la navigation passe en barre d'onglets.
- **API :** documentation Swagger sur `http://localhost:4000/api/docs`.

## Plan de repli

| Incident | Repli |
|---|---|
| Pas d'Internet | Rien n'en dépend : tout tourne en local (PostgreSQL dans Docker, API et interface sur le PC). Le lien de réunion n'est qu'affiché. |
| Le frontend plante | Montrer le même parcours via Swagger (`/api/docs`) avec les deux comptes, ou lancer `pnpm --filter backend test:e2e` (70 tests en environ 25 s) |
| Base dans un état inattendu | `pnpm db:demo-reset` (moins de 10 s) puis reprendre à l'étape 0:20 |
| Docker ne démarre pas | Ouvrir Docker Desktop, attendre l'état « running », puis `pnpm db:up` ; prévoir une vidéo enregistrée du parcours |
| Ordinateur de démo défaillant | Deuxième PC préparé à l'identique (clone du dépôt, même seed) |
