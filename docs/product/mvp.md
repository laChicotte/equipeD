# Produit — périmètre du MVP

> Source métier : `TDR_Hackathon_Talents_Connectes_Mentorat_2026.md`. Ce document décrit
> les profils, les parcours, les priorités et les critères d'acceptation **vérifiés**.

## 1. Problème

De nombreux jeunes ont des idées, des compétences et de l'ambition, mais pas encore le réseau
ni les conseils pour les concrétiser (TDR §1). Le défi : une plateforme qui met en relation
mentors et mentorés, facilite le conseil et suit les objectifs, **par chat ou visio** (TDR §2.3).

## 2. Profils

| Profil | Qui | Ce qu'il veut |
|---|---|---|
| Mentoré | Étudiant, jeune diplômé, entrepreneur, porteur de projet, personne en reconversion | Trouver la bonne personne, être accompagné, avancer sur un objectif concret |
| Mentor | Professionnel expérimenté, cadre, expert, entrepreneur | Transmettre sans être débordé, faire reconnaître son engagement |
| Administrateur | Équipe de la plateforme | Vérifier les mentors, modérer, gérer le catalogue |

## 3. Parcours

### Mentoré
1. Crée un compte, choisit le rôle mentoré, complète son profil en 3 étapes (situation ; domaines et compétences ; objectif et modalité).
2. Reçoit des suggestions expliquées, cherche dans l'annuaire (mot-clé, domaine, modalité, langue, disponibilité).
3. Consulte une fiche : expérience, compétences, langues, modalités, créneaux, note, mentorés accompagnés, certificats.
4. Envoie une **demande motivée** avec un objectif ; suit son état (en attente, acceptée, refusée).
5. Après acceptation : réserve un créneau, échange dans la **messagerie**, rejoint la visio, suit ses objectifs, évalue les séances.

### Mentor
1. Crée un compte mentor, complète son profil (accroche, parcours, compétences, domaines, langues, modalités, durée de séance).
2. Publie ses créneaux ; accepte ou refuse les demandes motivées, **sans plafond imposé** de mentorés.
3. Confirme les séances (lien de visio généré), échange, commente les objectifs, partage des ressources.
4. Clôture un mentorat : s'il compte au moins une séance réalisée, reçoit un **certificat d'accompagnement** vérifiable.

### Administrateur
- Comptes (suspension avec révocation des sessions), domaines, modération des contenus publics.
- Vérification des profils : examen des justificatifs des mentors (badge « Profil vérifié ») et des candidatures de mentorés qui souhaitent devenir mentors, décision motivée.
- Pilotage chiffré, rapport d'impact, nomination et retrait d'administrateurs, journal d'audit, révocation motivée des certificats.

### Évolution d'un mentoré vers le rôle de mentor
- Un mentoré accompagné peut candidater (« Devenir mentor ») : profil mentor complet, motivation, justificatifs. Il reste mentoré pendant l'examen ; une fois accepté, son compte devient mentor (profil publié et vérifié) et son historique est conservé.

## 4. Priorités

| Priorité | Contenu | État |
|---|---|---|
| **P0** | Authentification, rôles, profils, catalogue, annuaire, fiche, demande et décision, créneaux et réservation sans conflit, tableaux de bord, seed | ✅ |
| **P1** | Messagerie privée, objectifs et jalons, évaluations, ressources, notifications, administration | ✅ |
| **P2** | Suggestions expliquées, visio externe, opportunités, confidentialité (export, suppression) | ✅ |
| Ajouts | Photo de profil, certificats, administration unique (pilotage, équipe, audit), vérification des profils, mentoré devenant mentor, messagerie dédiée | ✅ |
| Hors périmètre | Emails, réinitialisation du mot de passe, PWA, chat temps réel, calendriers externes | Prévu (voir la note de pérennisation) |

## 5. Critères d'acceptation (vérifiés par les tests e2e)

- Une demande ne peut être acceptée ou refusée que par le mentor concerné ; l'acceptation est idempotente.
- Une seule demande en attente et un seul mentorat actif par couple.
- 8 réservations simultanées du même créneau ⇒ une seule réussit.
- Les messages ne sont lisibles que par les deux participants ; un tiers reçoit 403.
- Transition invalide ⇒ 409 ; formulaire invalide ⇒ 422 avec détail par champ ; email déjà utilisé ⇒ 409.
- Un certificat n'est délivré qu'avec au moins une séance réalisée ; il est vérifiable publiquement et révocable avec motif.
- Un administrateur ne peut ni accéder au pilotage ni suspendre un membre de l'équipe ; personne ne peut changer son propre rôle.
- Les fiches publiques n'exposent ni email ni téléphone.

## 6. Règles métier particulières

- **Campus France** : conseil et orientation uniquement, sans garantie d'admission ni de visa (TDR §5.7) ; avertissement affiché.
- **Vérification des mentors** : manuelle par l'équipe ; aucune validation automatique de diplômes.
- **Pas de données factices présentées comme réelles** : toutes les données de démonstration sont fictives et étiquetées ; les indicateurs sont calculés sur la base.

## 7. Scénario de démonstration

Voir `docs/jury/scenario-demo.md` (comptes fictifs, déroulé minuté, plan de repli).
