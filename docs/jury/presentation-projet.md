# Présentation du projet — Talents Connectés

> Hackathon « Talents connectés » — Salon international du livre de jeunesse de Conakry (10e édition), Mois du Numérique, 4–7 novembre 2026, CCFG.
> « Talents Connectés » est un nom de travail, provisoire.

## 1. Le problème

Les termes de référence le formulent clairement : de nombreux jeunes disposent d'idées, de compétences et d'ambitions, mais **accèdent difficilement aux conseils, aux réseaux professionnels, aux expériences et aux ressources** nécessaires à leurs projets. À l'inverse, des professionnels expérimentés sont prêts à transmettre leur savoir, mais aucun outil simple ne les rend visibles ni n'organise l'accompagnement.

Sans outil, le mentorat reste :
- **informel** : il dépend du réseau personnel, qui est justement ce qui manque aux jeunes ;
- **difficile à organiser** : échanges dispersés, rendez-vous manqués, aucun suivi des objectifs ;
- **peu lisible** : impossible de savoir qui peut aider sur quoi, quand et sous quelle forme.

> Nous ne citons volontairement aucune statistique : nous ne disposons pas de données sourcées sur le mentorat en Guinée. Mesurer ce besoin fait partie de la feuille de route (voir la note de pérennisation).

## 2. Les publics

| Mentorés (TDR §2.3) | Mentors (TDR §9) |
|---|---|
| Étudiants, jeunes diplômés | Professionnels expérimentés, cadres |
| Entrepreneurs, porteurs de projets | Entrepreneurs, consultants |
| Personnes en reconversion | Experts et spécialistes de leur domaine |
| Personnes souhaitant développer de nouvelles compétences | Anciens étudiants partis en France (Campus France) |

Les 7 domaines des TDR (§5) structurent le catalogue : entrepreneuriat ; numérique et technologies ; orientation et insertion ; culture, littérature et industries créatives ; gestion, finance et administration ; développement personnel et leadership ; accompagnement Campus France (conseil et orientation, **sans garantie d'admission ni de visa**).

## 3. La solution

Une plateforme web responsive (mobile, tablette, ordinateur) qui couvre **tout le cycle de l'accompagnement** :

1. **Se découvrir** : profils mentors et mentorés guidés, annuaire filtrable (domaine, compétence, modalité, langue, disponibilité), recherche insensible aux accents.
2. **Être orienté** : suggestions de mentors **expliquées** (« domaine correspondant », « compétences recherchées couvertes », « créneaux disponibles »…), calculées par un score transparent et non par une boîte noire.
3. **Entrer en relation** : demande motivée avec un objectif explicite ; le mentor accepte ou refuse. Il garde la maîtrise de sa capacité d'accompagnement.
4. **Planifier** : le mentor publie ses créneaux, le mentoré réserve, le mentor confirme, avec un lien de réunion externe en attendant une visio intégrée. **La double réservation est impossible**, même en cas de clics simultanés.
5. **Échanger** : conversation privée, accessible aux seuls deux participants du mentorat.
6. **Progresser** : objectifs découpés en jalons, progression calculée, retour écrit du mentor.
7. **Évaluer** : chaque participant note la séance après coup ; la note moyenne donnée par les mentorés renforce la confiance sur la fiche du mentor.
8. **Modérer** : un espace d'administration permet de vérifier manuellement les mentors, de publier ou masquer un profil et de suspendre un compte.

## 4. Ce qui nous différencie

- **Un parcours complet et réellement fonctionnel**, de la recherche au suivi d'objectifs, avec des données persistées dans PostgreSQL : pas une maquette.
- **La confiance d'abord** : vérification des mentors par l'équipe (jamais automatique), informations de contact privées non exposées, règles d'accès contrôlées côté serveur à chaque requête.
- **Des recommandations explicables** plutôt qu'une « IA » opaque : le mentoré comprend pourquoi un mentor lui est proposé.
- **Le contexte local** : fuseau Africa/Conakry, langues nationales (soussou, pular, malinké) dans les profils, accompagnement en présentiel, hybride ou à distance, domaine Campus France avec une mention honnête de son périmètre.
- **Une fondation durable** : architecture modulaire, tests automatisés (unitaires et de bout en bout), migrations versionnées, déploiement auto-hébergeable.

## 5. Fonctionnalités du prototype

| Fonctionnalité (TDR §7.2) | État |
|---|---|
| Profils mentors et mentorés | ✅ |
| Recherche et mise en relation selon compétences et besoins | ✅ (avec suggestions expliquées) |
| Catalogue des domaines d'expertise | ✅ (7 domaines des TDR) |
| Prise de rendez-vous et planification des séances | ✅ (sans double réservation) |
| Espace d'échange et de communication | ✅ chat privé · visio : lien externe |
| Suivi des objectifs et de la progression | ✅ (objectifs, jalons, retour du mentor) |
| Évaluation des séances | ✅ |
| Bibliothèque de ressources | ✅ (bibliothèque publique et partage privé dans un mentorat) |
| Partage d'opportunités | ⏳ prévu |
| IA de recommandation | ⏳ envisagée après mesure ; score explicable en place |

## 6. Proposition de valeur

- **Pour le mentoré :** trouver la bonne personne, être accompagné sur un objectif concret et voir ses progrès.
- **Pour le mentor :** transmettre sans être débordé (capacité maîtrisée, créneaux choisis, demandes motivées).
- **Pour les organisateurs et partenaires :** un réseau durable de mentors et de mentorés, des parcours structurés, et des indicateurs d'activité réels (demandes, séances, objectifs) plutôt que déclaratifs.
