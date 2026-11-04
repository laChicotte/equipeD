# Note de pérennisation

> Les TDR (§15) visent un **réseau durable de mentors et de mentorés** au-delà du Salon. Cette note présente une trajectoire **indicative** : les montants et volumes ne sont pas chiffrés faute de données sourcées. Ils seront établis avec les partenaires.

## 1. Point de départ

Le prototype livré couvre le parcours complet : profils, annuaire, suggestions explicables, demande et décision, créneaux et séances sans double réservation, conversation privée, objectifs et jalons, évaluation des séances, administration minimale.
Il repose sur des technologies ouvertes et répandues (Next.js, NestJS, PostgreSQL), **auto-hébergeables**, sans dépendance à un service propriétaire pour la logique métier.

## 2. Feuille de route indicative

| Horizon | Objectifs produit | Objectifs programme |
|---|---|---|
| **0–3 mois** (pilote) | Mise en production sécurisée (HTTPS, sauvegardes), emails transactionnels, notifications, charte d'utilisation et politique de confidentialité, bibliothèque de ressources | Pilote avec une première cohorte de mentors issus du réseau du Salon et des partenaires ; procédure de vérification des mentors ; collecte des premiers retours |
| **3–6 mois** | Visioconférence intégrée via une solution éprouvée (pas de WebRTC maison), application mobile installable (PWA), espace « opportunités » (stages, appels à projets), tableaux de bord pour les partenaires | Élargissement aux établissements d'enseignement et aux incubateurs ; ateliers thématiques en lien avec les séances |
| **6–12 mois** | Recommandation améliorée (éventuellement assistée par IA si les données montrent un gain mesurable), parcours types par domaine, mode faible connectivité, multilingue | Réseau d'ambassadeurs, partenariats entreprises et institutions, programme de reconnaissance des mentors |

## 3. Modération et validation des mentors

- **Vérification humaine**, jamais automatique : entretien, références professionnelles, éventuellement recommandation d'un partenaire. Le statut « Profil vérifié » n'est attribué que par l'équipe.
- Aucune validation automatique de diplômes n'est prétendue.
- Charte du mentor (bienveillance, confidentialité, non-substitution au mentoré : TDR §9) acceptée à l'inscription.
- Signalement d'un comportement inapproprié, suspension immédiate d'un compte (déjà disponible), journal de modération.
- Domaine Campus France : rappel systématique qu'il s'agit de conseil, **sans garantie d'admission ni de visa**.

## 4. Gouvernance

- **Porteur :** l'équipe projet, accompagnée par le partenaire Efficience Globale (TDR §8) pour le perfectionnement de l'application.
- **Comité de pilotage** à constituer avec la coordination du programme et les partenaires : priorités, règles de modération, indicateurs.
- **Protection des données :** minimisation (pas de contact privé exposé), droit d'accès et de suppression, hébergement maîtrisé. Une revue juridique de conformité reste à mener : nous ne revendiquons pas de conformité sans audit.

## 5. Infrastructure et conditions de déploiement

- **Architecture :** un monolithe modulaire (une API, une interface web, une base PostgreSQL), simple à exploiter par une petite équipe.
- **Hébergement :** un serveur virtuel ou un hébergeur proche des utilisateurs, avec sauvegardes quotidiennes de la base et HTTPS. Une montée en charge se fait d'abord verticalement.
- **Qualité :** intégration continue (typecheck, lint, 8 tests unitaires et 70 tests de bout en bout sur une vraie base) à chaque modification.
- **Coûts à estimer** avec les partenaires : hébergement et nom de domaine, envoi d'emails, solution de visio, temps d'animation de la communauté et de modération (le poste le plus important), maintenance évolutive.

## 6. Besoins d'accompagnement

- Mise en relation avec des mentors volontaires et des structures partenaires (entreprises, institutions, établissements, incubateurs, associations : TDR §15).
- Accompagnement produit et technique (Efficience Globale), tests utilisateurs avec de vrais mentorés.
- Appui juridique : données personnelles, conditions d'utilisation.
- Ressources d'hébergement et d'animation pour le pilote.

## 7. Modèles économiques envisageables (à valider)

- **Programme soutenu** par des partenaires institutionnels ou des fondations (accès gratuit pour les mentorés).
- **Offre pour les organisations :** espaces dédiés pour des écoles, des incubateurs ou des entreprises (cohortes, tableaux de bord, marque blanche).
- **Mécénat de compétences :** des entreprises valorisent le temps de mentorat de leurs collaborateurs.
- Principe constant : **l'accès des mentorés reste gratuit**, condition de l'accessibilité visée par les TDR.

## 8. Indicateurs d'impact (mesurables par la plateforme)

| Indicateur | Source |
|---|---|
| Mentors inscrits, mentors vérifiés, par domaine | Profils |
| Demandes envoyées, taux et délai d'acceptation | Demandes |
| Mentorats actifs et durée moyenne | Mentorats |
| Séances réalisées, taux d'annulation | Séances |
| Objectifs atteints, progression moyenne | Objectifs |
| Satisfaction (note moyenne des séances) | Évaluations |
| Couverture géographique (villes) et modalités | Profils |

Des indicateurs qualitatifs (insertion professionnelle, création d'entreprise, candidatures déposées) nécessiteront des enquêtes de suivi auprès des mentorés, avec leur consentement.
