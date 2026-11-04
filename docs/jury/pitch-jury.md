# Pitch jury (environ 2 min 30, adaptable)

## Structure

**1. Accroche (15 s)**
> « Avoir du talent ne suffit pas : il faut aussi quelqu'un qui vous ouvre la porte, vous conseille et vous aide à avancer. Aujourd'hui, ce “quelqu'un”, beaucoup de jeunes ne savent ni où le trouver, ni comment le solliciter. »

**2. Problème (25 s)**
> « Les termes de référence le disent : les jeunes ont des idées et des ambitions, mais accèdent difficilement aux conseils, aux réseaux et aux expériences. De leur côté, des professionnels sont prêts à transmettre, mais rien n'organise la rencontre ni le suivi. Sans outil, le mentorat reste informel, dépend du réseau qu'on a déjà, et s'essouffle faute de suivi. »

**3. Solution (35 s)**
> « Talents Connectés est une plateforme de mentorat qui couvre tout le parcours. Le mentoré décrit son objectif et trouve des mentors dans les sept domaines des TDR, avec des suggestions expliquées. Il envoie une demande motivée ; le mentor accepte. Ils planifient une séance sur les créneaux du mentor, sans double réservation possible, échangent dans une conversation privée et suivent des objectifs découpés en jalons. Après chaque séance, ils l'évaluent. »

**4. Démonstration (60 s, en direct ou en vidéo)**
> Recherche « développement web » → fiche → demande → acceptation → réservation → confirmation → message → objectif. (voir `scenario-demo.md`)

**5. Différence et confiance (20 s)**
> « Ce n'est pas une maquette : tout est enregistré dans une vraie base de données et couvert par plus de 80 tests automatisés. Nos recommandations sont transparentes, les mentors sont vérifiés par des humains, et les données personnelles ne sont pas exposées. Pour Campus France, nous sommes clairs : c'est du conseil, sans promesse d'admission ni de visa. »

**6. Pérennité et demande (15 s)**
> « Nous visons un pilote de trois mois avec les mentors du Salon et vos partenaires, puis l'ouverture aux écoles et aux incubateurs. Nous avons besoin de mentors volontaires, de partenaires et de l'accompagnement d'Efficience Globale pour en faire un réseau durable. Merci. »

## Questions probables et réponses

| Question | Réponse courte |
|---|---|
| Pourquoi pas de visio intégrée ? | Développer une visio fiable en quatre jours n'aurait pas été sérieux. Le mentor colle un lien de réunion externe ; l'intégration d'une solution éprouvée est prévue entre 3 et 6 mois. |
| Où est l'IA ? | Les TDR la rendent facultative. Nous avons préféré un score transparent : le mentoré voit *pourquoi* un mentor est proposé. L'IA viendra si les données montrent un gain réel. |
| Comment garantir la qualité des mentors ? | Vérification humaine (entretien, références), badge attribué par l'équipe, évaluations après les séances, suspension possible. Pas de fausse validation automatique de diplômes. |
| Et la confidentialité ? | Mots de passe hachés (Argon2id), sessions révocables en cookie sécurisé, aucun contact privé public, conversation réservée aux deux participants et vérifiée côté serveur à chaque requête. Une revue juridique est prévue avant la production. |
| Et si un mentor est débordé ? | Il fixe sa capacité maximale et ses créneaux ; au-delà, l'acceptation est bloquée. |
| Que se passe-t-il si deux personnes réservent le même créneau ? | La base de données l'empêche : une seule réservation réussit, l'autre reçoit un message clair. C'est testé automatiquement. |
| Accès sans bonne connexion ? | Interface légère et responsive ; le mode faible connectivité et la PWA sont dans la feuille de route. |
| Combien ça coûte ? | Technologies open source, auto-hébergeables ; le principal coût est l'animation et la modération. Le chiffrage se fera avec les partenaires. |
| Comment mesurer l'impact ? | Indicateurs issus de l'usage réel : demandes acceptées, séances réalisées, objectifs atteints, satisfaction. Puis enquêtes de suivi. |
| Après le hackathon ? | Une base solide (architecture modulaire, migrations, tests, CI) et une feuille de route à 3, 6 et 12 mois (voir la note de pérennisation). |
