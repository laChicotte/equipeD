# PROMPT MAÎTRE — CLAUDE CODE
## Plateforme professionnelle de mentorat | Hackathon « Talents connectés » — Conakry, 4–7 novembre 2026

> **Lis entièrement ces instructions avant toute modification. Puis passe à l'action : inspecte le dépôt, planifie brièvement et implémente par incréments testés. Le résultat attendu est du logiciel fonctionnel, pas seulement une proposition.**

## 1. Mission et niveau d'exigence

Agis comme une équipe produit senior coordonnée : **Product Manager, architecte logiciel, Tech Lead TypeScript, ingénieur frontend Next.js, ingénieur backend NestJS, spécialiste PostgreSQL/Prisma, designer UX/UI, ingénieur QA et DevSecOps**.

Je suis **Bakary DIAKITÉ**, développeur logiciel et fondateur de WIS Technologie. Je maîtrise déjà Next.js, NestJS, TypeScript, PostgreSQL et Prisma. Nous travaillons en équipe pendant un hackathon, mais le produit devra pouvoir évoluer après l'événement.

**Double objectif non négociable :**
1. **En quatre jours :** un MVP élégant, démontrable de bout en bout, réellement relié à une API et à PostgreSQL, sans faux boutons ni fausses transactions.
2. **Après le hackathon :** une fondation de qualité entreprise : séparation des responsabilités, sécurité, architecture compréhensible, migrations, tests, documentation et déploiement reproductible.

Construis **un monolithe modulaire**, et non une architecture de microservices. Ne surconçois pas. Privilégie le chemin critique métier plutôt que les fonctionnalités décoratives.

**Langue de communication et du produit : français.** Noms de fichiers, variables, API et conventions de code : anglais clair et cohérent.

## 2. Contexte et TDR officiels

**Événement :** Programme de mentorat et hackathon d'innovation numérique, thématique « Talents connectés », dans le cadre du **Salon international du livre de jeunesse de Conakry — 10e édition** et du **Mois du Numérique**. **Organisateur indiqué dans les TDR :** Institut français de Guinée (IFG). **Dates :** 4–7 novembre 2026. **Lieu :** Centre culturel franco-guinéen (CCFG), Conakry.

**Thématique officielle :** « Le mentorat à l'ère du numérique : connecter les talents, transmettre les expériences et construire les carrières de demain ».

**Problématique :** comment le numérique peut-il rendre le mentorat accessible, rapprocher jeunes et professionnels expérimentés, et faciliter la transmission de compétences et d'expériences dans la vie personnelle, académique et professionnelle ?

**Défi communiqué :** concevoir une application ou plateforme numérique qui permet aux **mentors** et **mentorés** de se découvrir, d'entrer en relation, d'échanger **par chat ou visioconférence**, de planifier leur accompagnement et de suivre les objectifs des mentorés.

**Publics :** étudiants, jeunes diplômés, entrepreneurs, porteurs de projets, personnes en reconversion et professionnels cherchant à acquérir des compétences ; mentors expérimentés de différents secteurs.

**Domaines à représenter dans le catalogue initial :**
- Entrepreneuriat et gestion d'entreprise.
- Numérique et technologies : développement, IA, cybersécurité, marketing digital, design.
- Orientation et insertion professionnelle : CV, entretiens, recherche d'emploi, réseau professionnel.
- Culture, littérature et industries créatives : édition, livre, contenus, audiovisuel.
- Gestion, finance et administration.
- Développement personnel, leadership et communication.
- Accompagnement des candidats Campus France : orientation et conseil, **sans promesse d'admission ni de visa**.

**Fonctionnalités envisagées dans les TDR (liste indicative, pas intégralement obligatoire pour le MVP) :** profils mentors/mentorés, recherche et rapprochement selon besoins et compétences, catalogue de domaines, rendez-vous, communication, objectifs/progression, ressources, évaluations, opportunités. **IA facultative** : recommandation de mentors ou parcours personnalisés.

**Livrables obligatoires pour le jury :**
1. Prototype fonctionnel ou démontrable.
2. Présentation du problème, de la solution, des cibles et fonctionnalités.
3. Démonstration d'un parcours utilisateur.
4. Note de pérennisation (évolutions, besoins, conditions de déploiement).
5. Pitch oral.

**Important :** le projet précédent « KARAN » concernait la lecture et **ne correspond plus au défi actuel**. Ne crée ni bibliothèque de contes ni fonctionnalités de lecture. Ce nouveau produit est une **plateforme de mentorat professionnel**. Son nom commercial n'est pas arrêté : utilise provisoirement « Talents Connectés » comme nom d'interface/configuration remplaçable ; n'affirme pas que c'est une marque déposée ou le nom officiel du produit. Si un fichier local `TDR_Hackathon_Talents_Connectes_Mentorat_2026.md` est présent, lis-le comme source métier prioritaire. La transcription indique que les sections 13 et 14 du document original n'étaient pas visibles ; ne les invente pas.

## 3. Résultat utilisateur indispensable : parcours complet

La démo doit montrer **deux vrais comptes et deux points de vue** :

**Parcours mentoré**
1. Créer un compte / se connecter et choisir le rôle *mentoré*.
2. Compléter son profil : situation, domaines d'intérêt, compétences souhaitées, objectif, modalité à distance ou en présentiel.
3. Rechercher des mentors selon domaine, compétence, disponibilité et mot-clé ; recevoir des suggestions explicables (sans IA obligatoire).
4. Consulter une fiche mentor : expérience, spécialités, bio, langues, disponibilité, modalités et éléments de confiance.
5. Envoyer une **demande de mentorat motivée** avec un objectif explicite.
6. Voir son état `PENDING`, puis `ACCEPTED` ou `DECLINED` après action du mentor.
7. Proposer ou réserver un créneau disponible ; consulter la séance confirmée.
8. Ouvrir un **espace de conversation privé fonctionnel** avec son mentor après acceptation.
9. Consulter et mettre à jour un objectif d'accompagnement, avec indicateur d'avancement.

**Parcours mentor**
1. Se connecter avec un rôle mentor et un profil renseigné.
2. Voir les demandes reçues ; accepter ou refuser une demande.
3. Renseigner des disponibilités et confirmer une séance sans double réservation.
4. Échanger dans la conversation liée à un mentorat accepté.
5. Consulter les objectifs et commenter ou mettre à jour leur progression selon les permissions définies.

**Parcours administrateur minimal** (P1 si temps limité) : consulter les comptes/mentors, modérer les profils, gérer les domaines, vérifier un mentor ; ne pas inventer une validation de diplômes automatique.

**Scénario de démo stable, reproductible et reproductible après redémarrage :** un mentoré recherche « Développement web », découvre un mentor, lui envoie une demande, le mentor l'accepte, ils planifient une séance, échangent par chat puis suivent un objectif. Les données doivent réellement persister dans PostgreSQL. Prépare des **comptes et données de démonstration fictifs**, clairement étiquetés, sans informations réelles d'utilisateurs.

## 4. Périmètre et priorisation impérative

**P0 — à livrer en premier et complètement :**
- Application Next.js responsive ; API NestJS ; PostgreSQL et Prisma connectés.
- Authentification et contrôle d'accès mentor/mentoré.
- Onboarding et profils enregistrés.
- Catalogue des domaines et annuaire de mentors avec recherche/filtres.
- Fiche mentor + demande de mentorat + acceptation/refus.
- Disponibilités simples + réservation/confirmation de séance avec gestion des conflits.
- Tableau de bord adapté au rôle.
- Données seed et parcours de démo.
- UI de qualité, états loading/empty/error, gestion robuste des erreurs.

**P1 — ensuite, sans dégrader P0 :**
- **Messagerie privée opérationnelle** entre membres d'une relation acceptée. Commencer par messages persistés et rafraîchissement maîtrisé ; ajouter Socket.IO si le temps et la stabilité le permettent. Le chat est prioritaire car les TDR attendent des échanges par chat ou visio.
- Objectifs, jalons et progression.
- Ressources partagées, feedback/évaluation de séance.
- Admin minimal ; notifications in-app simples.

**P2 — après stabilisation :**
- IA de matching, si elle produit un gain mesurable. Préférer d'abord un score déterministe lisible basé sur les domaines et objectifs.
- Visioconférence intégrée : **ne pas développer son propre WebRTC** en quatre jours. Une URL de réunion externe peut servir d'option temporaire, clairement présentée comme telle, sans prétendre offrir de la visio native.
- Opportunités, calendriers externes, emails transactionnels, PWA avancée, fonctionnalités de production supplémentaires.

Aucun endpoint factice ni bouton inerte. Si une fonctionnalité n'est pas prête, retire-la du parcours principal ou signale honnêtement qu'elle est prévue.

## 5. Technologies imposées et limites

### Frontend
- **Next.js** avec App Router, **TypeScript strict**.
- **Tailwind CSS**, **shadcn/ui** et primitives accessibles (Radix si pertinent).
- **Lucide React** pour les icônes.
- **React Hook Form + Zod** pour les formulaires, si compatibles avec la version retenue.
- **TanStack Query** pour les données serveur interactives, si elle simplifie vraiment le flux ; éviter la duplication arbitraire des sources de vérité.
- Interface responsive **mobile-first**, utilisable sur ordinateurs et tablettes. PWA **optionnelle**, non bloquante.

### Backend et données
- **NestJS**, TypeScript strict, modules métier, **API REST** versionnée (`/api/v1`).
- **PostgreSQL** auto-hébergeable ; **Prisma ORM** + migrations versionnées + seed idempotent.
- NestJS `ValidationPipe`, DTO, guards/policies, filtres d'exceptions, CORS restrictif, OpenAPI/Swagger.
- Authentification sécurisée implémentée et testée : mot de passe hashé (Argon2id ou mécanisme équivalent adapté), sessions/tokens courts avec cookies **HttpOnly, Secure en production, SameSite adapté**, renouvellement/révocation si refresh tokens. **Pas de JWT en localStorage.** Évaluer et traiter la protection CSRF si l'authentification repose sur des cookies.
- **RBAC et vérification d'appartenance à chaque ressource** : un utilisateur ne peut accéder aux demandes, messages, réservations ou objectifs d'autrui.
- Aucune dépendance à Supabase, Firebase ou un BaaS pour la logique métier. Pas de microservices, pas de Kubernetes pour ce MVP.

### DevOps et qualité
- **pnpm workspaces** (ou solution monorepo simple cohérente), **Docker Compose** pour PostgreSQL ; un conteneur API et un conteneur web peuvent être ajoutés si utiles, mais le développement doit rester rapide.
- ESLint, Prettier, `.env.example`, gestion propre des secrets, migrations, scripts de démarrage et seed, healthcheck.
- Jest/Vitest pour logique métier et tests d'intégration ciblés ; Playwright E2E pour le scénario central si le temps le permet.
- Garder les versions de Node, Next.js, NestJS, Prisma et leurs adaptateurs **compatibles entre elles**. Lire les documentations officielles des versions réellement installées avant d'utiliser une API récente. **Ne pas inventer de versions** ni mélanger des exemples de versions incompatibles.

## 6. Architecture de niveau entreprise, sans sur-ingénierie

Organise un monorepo lisible, par exemple :

```text
talents-connectes/
├── apps/
│   ├── web/
│   │   └── src/
│   │       ├── app/             # routes et layouts Next.js
│   │       ├── features/        # auth, mentors, requests, bookings, messages, goals
│   │       ├── components/      # UI commune, design system, layouts
│   │       ├── lib/             # client API, auth, utils
│   │       └── styles/
│   └── api/
│       ├── src/
│       │   ├── modules/        # auth, users, mentor-profiles, mentee-profiles,
│       │   │                   # domains, matching, mentorship-requests,
│       │   │                   # mentorships, availability, sessions, messages,
│       │   │                   # goals, resources, admin
│       │   ├── common/
│       │   ├── database/
│       │   └── config/
│       └── prisma/
│           ├── schema.prisma
│           ├── migrations/
│           └── seed.ts
├── packages/
│   ├── contracts/              # contrats/API/DTO sûrs à partager
│   └── config/                 # configs partagées uniquement si nécessaires
├── infra/
│   └── docker-compose.yml
├── docs/
│   ├── product/
│   ├── architecture/
│   ├── design/
│   └── jury/
├── .github/workflows/
├── CLAUDE.md
├── README.md
├── pnpm-workspace.yaml
└── .env.example
```

Cette arborescence est une cible : adapte-la si la version actuelle des frameworks justifie une autre disposition. Ne crée pas des packages vides juste pour remplir l'arbre.

**Principe clé :** NestJS est **l'autorité unique de la logique métier et de l'accès à PostgreSQL**. Le frontend ne doit pas accéder directement à la base. Ne réimplémente pas la même logique de validation et d'autorisation dans plusieurs couches. Utilise des types partagés uniquement lorsqu'ils ne font pas fuiter des entités internes ou des données sensibles.

## 7. Modèle de données et invariants métier

Définis et implémente avec Prisma, en choisissant des noms cohérents :

- `User` : id, email unique, passwordHash, role(s), status, createdAt, updatedAt.
- `MentorProfile` : userId, headline, bio, experience, expertise, languages, modalities, city, verifiedStatus.
- `MenteeProfile` : userId, currentSituation, goalsSummary, interests, preferredModality.
- `ExpertiseDomain` et relation mentor-domain ; catégories seedées issues des TDR.
- `MentorshipRequest` : menteeId, mentorId, message, goal, status `PENDING|ACCEPTED|DECLINED|CANCELLED`, timestamps.
- `Mentorship` : mentorId, menteeId, requestId, status `ACTIVE|COMPLETED|CANCELLED`.
- `AvailabilitySlot` : mentorId, startsAt, endsAt, active, timezone.
- `MentoringSession` : mentorshipId, mentorId, menteeId, startsAt, endsAt, status `REQUESTED|CONFIRMED|CANCELLED|COMPLETED`, optional meetingUrl.
- `Conversation` et `Message` : participants autorisés via le mentorat, senderId, content, createdAt.
- `Goal` / `Milestone` : description, statut, échéance éventuelle, progression.
- `Resource`, `SessionFeedback`, `Notification` : à créer lors de P1 uniquement.

**Invariants obligatoires :**
- Une demande ne peut être acceptée/refusée que par le mentor concerné.
- Une relation de mentorat est créée de manière idempotente après acceptation.
- Les messages privés ne sont accessibles qu'aux participants d'un mentorat autorisé.
- Un mentoré ne peut pas réserver un créneau d'un autre mentor sans relation autorisée.
- Pas de double réservation sur le même créneau. Contrôle transactionnel côté base et/ou stratégie de verrouillage/contrainte adaptée ; ne jamais faire confiance à une simple vérification côté UI.
- Les transitions d'état invalides doivent renvoyer des erreurs métier claires (`409`, `403`, `404`, `422` selon le cas).
- Stocker les dates en UTC ; afficher les dates selon le fuseau de l'utilisateur, avec **Africa/Conakry** comme référence du scénario de démonstration.
- Pagination, filtres et index sur les recherches usuelles ; contraintes d'unicité et clés étrangères explicites.
- Pour les données non encore modélisées, n'ajoute pas de tables hypothétiques inutiles.

Prévois une **seed fictive et idempotente** comprenant au moins : deux mentors aux expertises différentes, deux mentorés, un admin éventuel, plusieurs domaines, des disponibilités, et des identifiants de démonstration documentés **uniquement pour l'environnement de développement**. Ne déploie pas des mots de passe de démonstration en production.

## 8. Endpoints métier — contrats avant intégration

Expose, selon les nécessités réelles :

```text
POST   /api/v1/auth/register
POST   /api/v1/auth/login
POST   /api/v1/auth/logout
GET    /api/v1/auth/me
GET    /api/v1/domains
GET    /api/v1/mentors?domain=&q=&modality=&page=
GET    /api/v1/mentors/:id
GET    /api/v1/profile/me
PATCH  /api/v1/profile/me
POST   /api/v1/mentorship-requests
GET    /api/v1/mentorship-requests/inbox
GET    /api/v1/mentorship-requests/sent
POST   /api/v1/mentorship-requests/:id/accept
POST   /api/v1/mentorship-requests/:id/decline
GET    /api/v1/mentorships/me
GET    /api/v1/mentors/:id/availability
POST   /api/v1/availability
POST   /api/v1/sessions
GET    /api/v1/sessions/me
GET    /api/v1/mentorships/:id/messages
POST   /api/v1/mentorships/:id/messages
GET    /api/v1/mentorships/:id/goals
POST   /api/v1/mentorships/:id/goals
PATCH  /api/v1/goals/:id
```

Ce tableau est un **contrat indicatif**, à rationaliser en évitant les opérations inutiles. Documente exactement l'API implémentée avec OpenAPI. Les erreurs doivent avoir une forme structurée et prévisible. Ne retourne jamais `passwordHash` ou des données privées dans les réponses publiques.

## 9. Product design — qualité visuelle exceptionnelle

Crée une interface **professionnelle, premium, sobre, élégante, moderne, fluide, accessible et crédible auprès de jeunes et de professionnels**. Ce n'est pas une application de jeu pour enfants.

**Direction graphique proposée :**
- Bleu encre `#172A46` : confiance, professionnalisme.
- Turquoise profond `#0F8B83` : relation et progression.
- Blanc cassé `#F7F9FC` : fond principal.
- Blanc `#FFFFFF` : surfaces.
- Ambre doux `#E8AD58` : accent parcimonieux.
- Texte principal `#18243A`, secondaire `#64748B`.

Tu peux **ajuster les teintes** pour assurer des contrastes WCAG adaptés. Défini des **tokens sémantiques** (couleurs, typo, spacing, radius, shadows, breakpoints, z-index), pas des couleurs copiées partout.

**Typographie :** sans-serif professionnelle avec excellente lisibilité ; deux graisses structurantes, hiérarchie visuelle nette, interlignage aéré.

**Règles impératives :**
- Responsive mobile-first, puis vues desktop généreuses et lisibles.
- Navigation cohérente par rôle : espace public, mentoré, mentor, admin.
- Header propre, sidebar desktop si justifiée, navigation mobile adaptée.
- Cards de mentors véritablement utiles (photo/avatar, nom fictif, titre, domaines, bio synthétique, modalité, bouton d'action).
- Mise en valeur des informations, pas de décoration gratuite.
- Formulaires guidés avec labels, aide, erreurs, confirmations et indicateurs d'étape.
- Dashboards sobres : demandes en attente, prochaines séances, objectifs ; métriques seulement si les données existent réellement.
- États loading/skeleton, vide, erreur, succès, accès refusé ; feedback immédiat après toute action.
- Accessibilité clavier, focus visible, labels, contrastes, navigation au lecteur d'écran, zones tactiles confortables, réduction des animations.
- Micro-interactions discrètes, pas d'animations lourdes ni d'effets tapageurs.
- Illustrations/icônes sous licences compatibles ; aucun faux témoignage ni fausses statistiques d'impact.

**Écrans à construire :**
1. Landing page publique concise et crédible : valeur, fonctionnement en 3 étapes, domaines, CTA devenir mentor / trouver un mentor.
2. Inscription/connexion et sélection de rôle.
3. Onboarding métier différencié.
4. Annuaire + filtres.
5. Fiche mentor.
6. Tableau de bord mentoré.
7. Tableau de bord mentor.
8. Demandes envoyées/reçues et décisions.
9. Disponibilités/rendez-vous.
10. Conversation sécurisée (P1).
11. Objectifs/progression (P1).
12. Administration minimale (P1).

La landing page ne doit **pas** absorber tout le temps : la valeur est dans le **parcours complet connecté aux données**.

## 10. Sécurité, fiabilité et confidentialité

Conçois comme une plateforme qui manipule des informations personnelles et professionnelles :
- Secrets seulement dans les variables d'environnement serveur ; `.env.example` sans secrets.
- Hasher les mots de passe ; ne jamais stocker de mots de passe en clair.
- Cookies de session sécurisés, expiration et déconnexion ; protection CSRF adaptée.
- Guards NestJS et règles métier systématiques ; pas de simple contrôle basé sur des boutons masqués dans le frontend.
- DTO validés, limites de taille, sanitation adaptée ; protection brute-force et rate limiting sur auth/messages.
- CORS strict, logs sans secrets ni contenus de conversation, gestion des erreurs sans fuite de stack trace.
- La fiche publique d'un mentor n'expose pas téléphone/email privé par défaut.
- Messagerie visible uniquement aux participants autorisés.
- Dates, transactions, race conditions et erreurs de réservation correctement gérées.
- Périmètre « conseil et accompagnement » pour Campus France : aucune garantie d'admission ou de visa.
- Ne prétends jamais à une conformité juridique complète sans audit.

## 11. Stratégie d'exécution dans Claude Code

**Règle essentielle : ne me rends pas un plan interminable ; construis le produit.**

### Étape A — Diagnostic rapide
1. Inspecte le dossier courant, Git, Node/pnpm, Docker, dépendances, fichiers existants.
2. S'il y a du code existant, préserve-le ; n'écrase pas des changements non committés.
3. Identifie les contraintes bloquantes (Docker absent, credentials indisponibles, accès réseau, etc.).
4. Écris un plan de réalisation **court**, ordonné P0 → P1 → P2, avec critères d'acceptation.

### Étape B — Fondation exécutable
1. Crée/organise le monorepo.
2. Initialise Next.js, NestJS, Prisma et PostgreSQL via Docker Compose.
3. Configure TypeScript strict, lint, format, env et scripts monorepo.
4. Crée les modèles, migrations et seed ; exécute les migrations si l'environnement le permet.
5. Configure healthcheck, Swagger et authentification.
6. Lance les services et corrige les problèmes réels.

### Étape C — Premier parcours vertical
**Implémente de bout en bout avant d'élargir :** login → annuaire → profil mentor → demande → décision mentor → affichage des états en base. UI + API + DB + autorisations. Pas de faux frontend utilisant seulement des tableaux statiques une fois le backend disponible.

### Étape D — Cœur du mentorat
Développe ensuite disponibilités → réservation confirmée → dashboard de séance, puis chat persistant → suivi d'objectifs si le temps le permet.

### Étape E — Finition de qualité
Affinage du design responsive, accessibilité, gestion des erreurs, seed de démonstration, documentation, tests, préparation du jury.

### En continu
Après chaque incrément : exécute au minimum les vérifications pertinentes (**typecheck, lint, tests, build/healthcheck** selon le périmètre), inspecte les résultats et corrige les erreurs. Utilise des commits atomiques **uniquement si Git est initialisé et si tu es autorisé à committer** ; jamais de push ou déploiement public sans confirmation explicite.

Si tu dois choisir entre dix écrans esthétiques non fonctionnels et cinq écrans reliés à PostgreSQL, **choisis cinq écrans fonctionnels**. Si le temps manque, annonce la coupe fonctionnelle et conserve un parcours de démo fiable.

## 12. Vérifications de recette : critères de réussite

Ne déclare pas « terminé » sans pouvoir démontrer les points suivants :

- [ ] Démarrage de l'application web et de l'API documenté et vérifié.
- [ ] PostgreSQL accessible, migrations appliquées, seed opérationnelle.
- [ ] Connexion sur deux comptes fictifs distincts : mentoré et mentor.
- [ ] Rôles/permissions réellement appliqués côté API.
- [ ] Annuaire filtrable et fiche mentor issus de la base.
- [ ] Demande créée par mentoré et visible par le bon mentor.
- [ ] Acceptation/refus avec état persistant et validation métier.
- [ ] Disponibilité et réservation d'une séance, contrôle des conflits.
- [ ] L'utilisateur ne voit pas les données privées d'un tiers.
- [ ] Le même parcours fonctionne sur une largeur mobile et desktop.
- [ ] Le frontend affiche correctement les erreurs, champs invalides et états vides.
- [ ] Les fonctions annoncées comme opérationnelles ont été réellement testées.
- [ ] Si chat P1 : messages privés envoyés, lus et persistés ; contrôle d'accès testé.
- [ ] Si objectifs P1 : progression consultable et modifiable selon les permissions.
- [ ] Documentation de lancement + identifiants fictifs réservés au dev.

Tests critiques recommandés : refus d'une demande appartenant à autrui ; double réservation concurrente ; message dans mentorat non autorisé ; transitions d'état invalides ; formulaire invalide ; inscription avec email dupliqué.

## 13. Livrables pour le jury : génère aussi les documents

En plus du code, crée dans `docs/jury/` :

1. `presentation-projet.md` : problème, données de contexte **sans chiffres inventés**, cible, solution, différence, fonctionnalités, proposition de valeur.
2. `scenario-demo.md` : parcours mentoré → mentor en 3–5 minutes, clics précis, comptes de démonstration, plan de repli si connexion indisponible.
3. `note-perennisation.md` : roadmap 3/6/12 mois indicative, partenariats possibles, modération/validation des mentors, besoins d'accompagnement, gouvernance, infrastructure, coût à **estimer** sans affirmer de montants non sourcés, modèle économique envisageable et indicateurs d'impact.
4. `pitch-jury.md` : pitch oral structuré d'environ 2 à 3 minutes (adaptable aux consignes du jury), et questions-réponses probables.
5. `checklist-livraison.md` : état réel du MVP, P0/P1/P2, tests effectués, bugs connus et limites honnêtes.

Prépare un **mode démonstration** avec comptes fictifs et données réalistes, sans contourner les authentifications ni les autorisations. La démonstration doit rester possible avec peu d'étapes et éviter les dépendances externes non essentielles.

## 14. Documentation projet professionnelle

Créer ou tenir à jour :
- `README.md` : vue d'ensemble, prérequis, installation, migrations, seed, lancement, tests, architecture, troubleshooting.
- `CLAUDE.md` : décisions, structure, commandes, conventions, priorités en cours, état réel, tâches suivantes ; utile pour reprendre une nouvelle session Claude Code.
- `docs/architecture/overview.md` : composants, flux de données, contrôles de sécurité et décisions structurantes.
- `docs/product/mvp.md` : profils, parcours, priorités, critères d'acceptation.
- `docs/design/design-system.md` : palette, typography, tokens, composants, responsive, accessibilité.
- `.env.example` : variables avec descriptions sans secrets.
- `docs/api/` ou Swagger pour documenter les routes réelles.

## 15. Format de communication avec moi

Après le diagnostic, réponds brièvement :
- **Ce que tu as trouvé.**
- **La structure et les versions réellement choisies.**
- **Ce que tu implémentes maintenant.**

Ensuite travaille par lots cohérents, pas par micro-questions. Pose une question **uniquement en cas de blocage réel** : secret indisponible, décision métier indispensable, risque d'écrasement, opération de déploiement/publication, ou changement destructif.

À chaque point d'étape, mentionne :
- fichiers principaux créés/modifiés ;
- fonctionnalités effectivement opérationnelles ;
- commandes/tests exécutés et résultats ;
- prochaines priorités ;
- risques ou limites.

**Ne mens pas sur les builds, tests, intégrations ou déploiements. Ne fais pas passer des mocks pour une fonctionnalité réelle.**

## 16. Instruction d'exécution immédiate

**Commence maintenant, dans cet ordre :**

1. Inspecte le dépôt et l'environnement existants, sans rien détruire.
2. Vérifie la compatibilité des versions de Next.js, NestJS, Prisma, PostgreSQL et Node.
3. Formalise le MVP et les états de la demande de mentorat.
4. Crée l'architecture monorepo et une base PostgreSQL opérationnelle.
5. Développe le premier parcours vertical complet : deux rôles, annuaire, profil mentor, demande, acceptation/refus.
6. Applique une direction UX/UI premium et responsive **dès les premiers écrans**.
7. Continue sur la réservation, puis la communication privée et les objectifs.
8. Génère les cinq livrables du jury.
9. Exécute et rapporte les vérifications réelles.

**Priorité absolue : d'ici la démonstration, un mentoré doit pouvoir trouver un mentor, lui demander un accompagnement, recevoir une acceptation et planifier une séance dans une véritable plateforme web élégante, connectée à NestJS et PostgreSQL.**

Travaille maintenant sur le code : **pas uniquement sur la description de la solution**.
