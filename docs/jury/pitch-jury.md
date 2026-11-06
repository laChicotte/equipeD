# Pitch jury (environ 2 min 30, adaptable)

## Structure

**1. Accroche (15 s)**
> « Avoir du talent ne suffit pas : il faut aussi quelqu'un qui vous ouvre la porte, vous conseille et vous aide à avancer. Aujourd'hui, ce “quelqu'un”, beaucoup de jeunes ne savent ni où le trouver, ni comment le solliciter. »

**2. Problème (25 s)**
> « Les termes de référence le disent : les jeunes ont des idées et des ambitions, mais accèdent difficilement aux conseils, aux réseaux et aux expériences. De leur côté, des professionnels sont prêts à transmettre, mais rien n'organise la rencontre ni le suivi. Sans outil, le mentorat reste informel, dépend du réseau qu'on a déjà, et s'essouffle faute de suivi. »

**3. Solution (35 s)**
> « TalentsConnect est une plateforme de mentorat qui couvre tout le parcours. Le mentoré décrit son objectif et trouve des mentors dans les sept domaines des TDR, avec des suggestions expliquées. Il envoie une demande motivée ; le mentor accepte. Ils planifient une séance sur les créneaux du mentor, sans double réservation possible, échangent dans une conversation privée et suivent des objectifs découpés en jalons. Après chaque séance, ils l'évaluent. »

**4. Démonstration (60 s, en direct ou en vidéo)**
> Recherche « développement web » → fiche → demande → acceptation → réservation → confirmation → message → objectif. (voir `scenario-demo.md`)

**5. Différence et confiance (20 s)**
> « Ce n'est pas une maquette : tout est enregistré dans une vraie base de données et couvert par plus de 80 tests automatisés. Nos recommandations sont transparentes, les mentors sont vérifiés par des humains, et les données personnelles ne sont pas exposées. Pour Campus France, nous sommes clairs : c'est du conseil, sans promesse d'admission ni de visa. »

**6. Pérennité et demande (15 s)**
> « Nous visons un pilote de trois mois avec les mentors du Salon et vos partenaires, puis l'ouverture aux écoles et aux incubateurs. Nous avons besoin de mentors volontaires, de partenaires et de l'accompagnement d'Efficience Globale pour en faire un réseau durable. Merci. »

## Questions probables et réponses

| Question | Réponse courte |
|---|---|
| Et la visio ? | À la confirmation d'une séance à distance, la plateforme crée automatiquement une salle Jitsi Meet privée, au nom impossible à deviner. Développer notre propre visio en trois jours n'aurait pas été sérieux : nous nous appuyons sur une solution open source éprouvée, et nous le disons. Une intégration plus poussée est prévue entre 3 et 6 mois. |
| Où est l'IA ? | En assistance, jamais en décision : elle aide à formuler un besoin, explique le score et propose un parcours que les participants valident. Le score reste calculé par des règles transparentes, et la plateforme fonctionne entièrement sans IA. Aucun nom ni message privé n'est envoyé au fournisseur. |
| Comment garantir la qualité des mentors ? | Vérification humaine (entretien, références), badge attribué par l'équipe, évaluations après les séances, suspension possible. Pas de fausse validation automatique de diplômes. |
| Et la confidentialité ? | Mots de passe hachés (Argon2id), sessions révocables en cookie sécurisé, aucun contact privé public, conversation réservée aux deux participants et vérifiée côté serveur à chaque requête. Une revue juridique est prévue avant la production. |
| Et si un mentor est débordé ? | Il reste maître de ses créneaux et accepte ou refuse chaque demande motivée : il n'y a pas de plafond imposé, c'est lui qui décide. |
| Comment savoir qu'un mentor est sérieux ? | Sa fiche affiche les personnes réellement accompagnées et ses certificats d'accompagnement, délivrés par la plateforme après des séances réalisées et vérifiables par un code. |
| Que se passe-t-il si deux personnes réservent le même créneau ? | La base de données l'empêche : une seule réservation réussit, l'autre reçoit un message clair. C'est testé automatiquement. |
| Accès sans bonne connexion ? | Application installable (PWA). Sans réseau : relecture des conversations, séances et objectifs, et messages envoyés au retour de la connexion. Économie de données automatique sur 2G. |
| Combien ça coûte ? | Technologies open source, auto-hébergeables ; le principal coût est l'animation et la modération. Le chiffrage se fera avec les partenaires. |
| Comment mesurer l'impact ? | Indicateurs issus de l'usage réel : demandes acceptées, séances réalisées, objectifs atteints, satisfaction. Puis enquêtes de suivi. |
| Après le hackathon ? | Une base solide (architecture modulaire, migrations, tests, CI) et une feuille de route à 3, 6 et 12 mois (voir la note de pérennisation). |
