/**
 * Base de connaissances de l'assistant : tout ce que la plateforme fait, tel qu'implémenté.
 * À tenir à jour à chaque évolution fonctionnelle (le banc `ai:eval` vérifie les réponses clés).
 */
import type { Role } from '../../generated/prisma/enums.js';

/** Pages vers lesquelles l'assistant peut renvoyer (tout autre lien est écarté). */
export const ASSISTANT_PAGES: { href: string; label: string; roles: Role[] | 'all' }[] = [
  { href: '/tableau-de-bord', label: 'Tableau de bord', roles: ['MENTEE', 'MENTOR'] },
  { href: '/mentors', label: 'Trouver un mentor', roles: 'all' },
  { href: '/demandes', label: 'Demandes', roles: ['MENTEE', 'MENTOR'] },
  { href: '/messages', label: 'Messagerie', roles: ['MENTEE', 'MENTOR'] },
  { href: '/mentorats', label: 'Mentorats', roles: ['MENTEE', 'MENTOR'] },
  { href: '/seances', label: 'Séances', roles: ['MENTEE', 'MENTOR'] },
  { href: '/disponibilites', label: 'Disponibilités', roles: ['MENTOR'] },
  { href: '/ressources', label: 'Ressources', roles: 'all' },
  { href: '/opportunites', label: 'Opportunités', roles: 'all' },
  { href: '/onboarding', label: 'Modifier mon profil', roles: ['MENTEE', 'MENTOR'] },
  { href: '/compte', label: 'Mon compte', roles: 'all' },
  { href: '/compte?section=securite', label: 'Sécurité du compte', roles: 'all' },
  { href: '/compte?section=donnees', label: 'Données et confidentialité', roles: 'all' },
  {
    href: '/compte?section=verification',
    label: 'Vérification ou Devenir mentor',
    roles: ['MENTEE', 'MENTOR'],
  },
  { href: '/devenir-mentor', label: 'Devenir mentor', roles: ['MENTEE'] },
  { href: '/mot-de-passe-oublie', label: 'Mot de passe oublié', roles: 'all' },
  { href: '/admin', label: 'Tableau de bord (administration)', roles: ['ADMIN'] },
  { href: '/admin/verifications', label: 'Vérifications', roles: ['ADMIN'] },
  { href: '/admin/comptes', label: 'Comptes', roles: ['ADMIN'] },
  { href: '/admin/mentors', label: 'Mentors (administration)', roles: ['ADMIN'] },
  { href: '/admin/pilotage', label: 'Pilotage', roles: ['ADMIN'] },
  { href: '/admin/domaines', label: 'Domaines', roles: ['ADMIN'] },
  { href: '/admin/equipe', label: 'Équipe', roles: ['ADMIN'] },
  { href: '/admin/journal', label: 'Journal d’audit', roles: ['ADMIN'] },
  { href: '/admin/certificats', label: 'Certificats', roles: ['ADMIN'] },
  { href: '/admin/contenus', label: 'Contenus', roles: ['ADMIN'] },
];

export const ASSISTANT_KNOWLEDGE = `
# TalentsConnect : guide complet de la plateforme

## Présentation
TalentsConnect est une plateforme de mentorat née du Salon international du livre de jeunesse de Conakry 2026. Elle relie des professionnels expérimentés (mentors) à des étudiants, jeunes diplômés, entrepreneurs, porteurs de projets et personnes en reconversion (mentorés). Elle est gratuite pour les utilisateurs. Elle fonctionne dans un navigateur, sur ordinateur comme sur téléphone, et peut s'installer comme une application.
Domaines : Entrepreneuriat et gestion d'entreprise ; Numérique et technologies ; Orientation et insertion professionnelle ; Culture, littérature et industries créatives ; Gestion, finance et administration ; Développement personnel et leadership ; Accompagnement des candidats Campus France (conseil et orientation uniquement, sans garantie d'admission ni de visa).

## Rôles
- Mentoré : cherche un mentor, envoie des demandes, réserve des séances, suit ses objectifs.
- Mentor : publie ses créneaux, accepte ou refuse les demandes, accompagne, peut créer des groupes. Pas de nombre maximal de mentorés.
- Administrateur (équipe de la plateforme) : modère les comptes et contenus, vérifie les profils, gère les domaines, suit les indicateurs. Il n'intervient pas dans les mentorats.

## Créer un compte et se connecter
- Inscription : page « Créer un compte ». Choisir « Je cherche un mentor » (mentoré) ou « Je veux accompagner » (mentor), puis prénom, nom, adresse email et mot de passe.
- Mot de passe : au moins 10 caractères, avec au moins une lettre et un chiffre. L'icône en forme d'œil permet de l'afficher.
- Ensuite, compléter son profil (étape obligatoire avant d'utiliser la plateforme) :
  - mentoré : situation (étudiant, jeune diplômé, entrepreneur, porteur de projet, reconversion, professionnel), objectif principal, domaines d'intérêt, compétences recherchées, modalité préférée (à distance, en présentiel, hybride), ville ;
  - mentor : titre de profil, présentation (80 caractères au moins), poste, organisation, années d'expérience, domaines (4 au plus), compétences, langues (français, anglais), modalités, durée habituelle des séances (30, 45, 60 ou 90 minutes).
- Le profil se modifie à tout moment : menu du compte (photo en haut à droite), « Modifier mon profil ».
- Mot de passe oublié : la plateforme n'envoie pas encore d'emails. Il faut contacter l'équipe (stand du programme ou administrateur de sa structure). Après vérification d'identité, elle remet un lien personnel, valable 2 heures et utilisable une seule fois, pour choisir un nouveau mot de passe ; les anciennes sessions sont alors fermées.

## Trouver un mentor (page « Trouver un mentor »)
- Recherche par compétence, métier ou nom (sans tenir compte des accents), filtres par domaine, modalité, langue, et « Disponible sous 14 jours ».
- « Trier par » : Pertinence (par défaut : profils vérifiés d'abord, puis l'expérience démontrée sur la plateforme, puis la disponibilité, puis les années d'expérience), Expérience, Disponibilité (créneau le plus proche d'abord), Note (prise en compte à partir de 3 avis).
- Badges : « Profil vérifié » (l'équipe a contrôlé les justificatifs) ; « Mentor confirmé » (au moins 3 accompagnements menés à terme et une note moyenne d'au moins 4 sur 5, sur 3 avis ou plus).
- « Recommandés pour vous » (mentorés ayant complété leur profil) : un score sur 100 calculé par des règles transparentes, sans intelligence artificielle : domaines communs, compétences recherchées couvertes, modalité compatible, créneaux dans les 14 jours, profil vérifié. Le lien « Pourquoi ce mentor ? » explique ce score.
- « Vous ne savez pas par où commencer ? » : décrire son besoin avec ses mots ; l'assistant propose des domaines et des compétences à explorer.
- La fiche d'un mentor montre son parcours, ses compétences, ses langues, ses avis, ses certificats d'accompagnement et ses prochains créneaux.

## Demande d'accompagnement (page « Demandes »)
- Sur la fiche du mentor : « Demander un accompagnement », avec un objectif et un message de présentation. Le profil de mentoré doit être complété.
- Une seule demande en attente à la fois auprès d'un même mentor. Le mentoré peut annuler sa demande tant qu'elle n'a pas reçu de réponse.
- Le mentor voit les demandes reçues, puis accepte ou refuse (avec un message facultatif). Le mentoré est notifié.
- Acceptée : le mentorat démarre et un espace de mentorat privé s'ouvre pour les deux personnes. Refusée : le mentoré peut solliciter un autre mentor.

## Créneaux et séances
- Le mentor publie ses horaires libres dans « Disponibilités » : date, heure de début, durée (entre 15 minutes et 4 heures), et répétition sur 1, 2 ou 4 semaines. Les créneaux se publient au plus 120 jours à l'avance. Un créneau libre peut être supprimé ; un créneau réservé ne peut l'être qu'après annulation de la séance. Deux créneaux ne peuvent pas se chevaucher.
- Le mentoré, une fois le mentorat accepté, réserve un créneau libre avec le bouton « Réserver une séance » : dans « Mentorats », en ouvrant l'espace du mentorat (chemin le plus direct), ou depuis la fiche du mentor. Il choisit un créneau et indique le sujet. La séance est alors « demandée ».
- Le mentor confirme la séance dans « Séances ». Pour une séance à distance, un lien de visioconférence (Jitsi Meet, service externe) est créé à la confirmation.
- L'un ou l'autre peut annuler une séance qui n'est pas terminée. Un créneau ne peut pas être réservé deux fois.
- Après le début de la séance, seul le mentor peut la marquer comme réalisée.
- Après la fin, chacun peut l'évaluer une seule fois : une note de 1 à 5 et un commentaire facultatif (1000 caractères au plus). Les notes des mentorés forment la note du mentor.
- Toutes les heures sont affichées dans le fuseau choisi dans « Mon compte » (Conakry par défaut).

## Espace de mentorat (page « Mentorats »)
Onglets :
- Conversation : messages privés entre le mentor et le mentoré.
- Objectifs : objectifs découpés en jalons, avec une progression en pourcentage et un retour du mentor. Trois façons d'en ajouter : « Nouvel objectif », « Parcours guidé » (modèles validés par l'équipe, par exemple Préparer sa candidature Campus France, Décrocher son premier emploi, Structurer et lancer son projet, Se lancer dans un métier du numérique, Mener à bien un projet créatif), ou « Proposer avec l'IA » (proposition à relire : seuls les objectifs cochés sont ajoutés).
- Séances : historique et prochaines séances.
- Ressources : liens, documents et conseils partagés entre les deux personnes.
- Clôture : l'un ou l'autre peut clôturer le mentorat, avec un bilan facultatif. Les séances à venir sont annulées, les objectifs et ressources passent en lecture seule, mais la conversation reste ouverte. Si au moins une séance a été réalisée, le mentor reçoit un certificat d'accompagnement, vérifiable publiquement par un lien. Après la clôture, le mentoré peut à nouveau solliciter ce mentor.

## Messagerie (page « Messagerie »)
- Toutes les conversations privées et les groupes au même endroit, avec les messages non lus en premier.
- Pièces jointes avec le trombone : PDF, Word, Excel, PowerPoint, OpenDocument, texte, CSV, PNG, JPEG ou WebP, 10 Mo au plus. Le texte saisi devient la légende. Les photos s'affichent dans la conversation.
- Appels audio et vidéo : boutons téléphone et caméra en haut d'une conversation privée (pas dans les groupes). La personne appelée voit une carte « Accepter / Refuser » ; il faut autoriser le micro et la caméra dans le navigateur ; la page doit être en https. Pendant l'appel : couper le micro, couper la caméra, mode économie de données, raccrocher. Chaque appel est noté dans la conversation (durée, manqué, refusé) avec un bouton « Rappeler ». Si la personne n'est pas connectée, l'appel est noté comme manqué.
- Groupes : un mentor peut créer un groupe (bouton « Nouveau groupe ») avec ses mentorés actuels ou anciens et d'autres mentors, 50 membres au plus. Tous les membres écrivent dans le fil commun. Le mentor responsable renomme, ajoute ou retire des membres, supprime le groupe et peut planifier des ateliers de groupe (date, durée de 15 minutes à 4 heures, à distance ou en présentiel) ; les membres répondent s'ils participent. Un membre peut quitter le groupe.

## Ressources et opportunités
- Ressources : bibliothèque publique de conseils, articles, vidéos, modèles et outils, filtrable par domaine et type. Les mentors et l'équipe peuvent publier ; une ressource contient un document joint (10 Mo au plus), un lien https ou un conseil rédigé.
- Opportunités : stages, emplois, appels à projets, bourses, formations et événements publiés par les mentors et l'équipe.

## Notifications
La cloche en haut de l'écran signale les nouvelles demandes, réponses, séances, ressources partagées, clôtures, certificats, groupes, ateliers et décisions de vérification. Un clic ouvre l'écran concerné.

## Vérification du profil et devenir mentor
- Mentor : « Mon compte », section « Vérification » : présenter son parcours, ajouter éventuellement un lien professionnel (LinkedIn…) et jusqu'à 3 justificatifs (PDF ou photo : diplôme, attestation d'employeur, certificat). L'équipe accepte (badge « Profil vérifié ») ou refuse avec un motif ; une nouvelle demande reste possible. Une seule demande en attente à la fois ; elle peut être retirée.
- Mentoré qui veut devenir mentor : « Mon compte », section « Devenir mentor » (ou page « Devenir mentor ») : remplir un profil de mentor complet, sa motivation et ses justificatifs. Le compte reste mentoré pendant l'examen et le profil de mentor n'est pas visible. Si l'équipe accepte, le compte devient un compte mentor, publié avec le badge vérifié ; les demandes en attente sont annulées et l'historique est conservé. L'acceptation est impossible tant qu'un mentorat est en cours en tant que mentoré.

## Administration (réservé aux administrateurs)
L'administrateur a son propre espace, avec une barre latérale (un menu à ouvrir sur mobile) en trois groupes : Suivi (Tableau de bord, Pilotage), Modération (Vérifications, Comptes, Mentors, Contenus, Certificats), Configuration (Domaines, Équipe, Journal d'audit, Mon compte). Le tableau de bord montre les chiffres clés, les demandes à traiter et les dernières actions de l'équipe. Un administrateur n'a ni profil de mentor ni de mentoré, n'intervient pas dans les mentorats et n'a pas accès aux pages Demandes, Messagerie, Mentorats ou Séances.
- Vérifications : liste des « Vérifications de profil » (mentors) et des « Candidatures mentor » (mentorés qui veulent devenir mentor), filtrable par type et par statut (En attente, Acceptées, Refusées). Pour chaque demande : présentation, domaines, compétences, lien professionnel et justificatifs à ouvrir. Boutons « Vérifier le profil » (ou « Accepter comme mentor » pour une candidature) et « Refuser » avec un motif d'au moins 10 caractères, que la personne reçoit. Une candidature ne peut pas être acceptée tant que la personne a un mentorat en cours en tant que mentoré.
- Comptes : recherche et filtre par rôle. « Suspendre » ferme immédiatement les sessions du compte ; « Réactiver » le rétablit. « Réinitialiser » crée un lien personnel de changement de mot de passe (2 heures, usage unique), à remettre à la personne après avoir vérifié son identité ; impossible pour un autre administrateur.
- Mentors : publier ou retirer un profil de mentor de l'annuaire. La vérification est manuelle (entretien, références) : aucune validation automatique de diplômes.
- Pilotage : indicateurs calculés en direct (inscriptions, demandes envoyées et acceptées, séances réalisées, mentorats menés à terme, certificats délivrés, messages) et bouton « Rapport d'impact (CSV) ». Aucun contenu de conversation n'est consulté.
- Équipe : nommer un administrateur ou retirer quelqu'un de l'équipe (il redevient mentoré). Chaque changement déconnecte la personne. On ne peut pas modifier son propre rôle.
- Journal d'audit : toutes les actions de l'équipe (modération, rôles, domaines, certificats, vérifications), sans contenu des conversations.
- Certificats : liste des certificats délivrés ; un certificat peut être révoqué (sa page de vérification l'indique alors).
- Contenus : retirer une ressource publique ou archiver une opportunité publiée par un mentor.
- Domaines : créer, renommer, activer ou désactiver les domaines d'accompagnement.

## Mon compte
Sections : Profil (photo de profil recadrée, prénom, nom, fuseau horaire ; l'email ne se modifie pas), Vérification ou Devenir mentor, Sécurité (changer de mot de passe, se déconnecter de tous les appareils), Données et confidentialité (économie de données, données gardées sur l'appareil, export de toutes ses données au format JSON, suppression définitive du compte par anonymisation).

## Connexion faible, hors ligne et application
- Installer l'application : menu du compte, « Installer l'application » (selon le navigateur ; sur iPhone, utiliser « Sur l'écran d'accueil » de Safari).
- Sans réseau : les dernières conversations, séances et objectifs déjà chargés restent lisibles, avec un bandeau « Hors ligne ». Un message écrit sans réseau attend et part tout seul au retour de la connexion. Les fichiers et les appels exigent le réseau. Ces données restent 7 jours au plus sur l'appareil et sont effacées à la déconnexion.
- Économie de données (« Mon compte », Données) : automatique sur réseau 2G, ou activée à la main. Elle espace les actualisations, masque les photos et charge les photos des conversations à la demande.

## Intelligence artificielle
L'IA assiste sans décider : orientation à partir d'un besoin, explication du score d'un mentor, proposition de parcours à valider, et cet assistant. Le score de recommandation reste calculé par des règles. Aucun nom, email ni message privé n'est envoyé au fournisseur (OpenAI). Les réponses de l'IA peuvent contenir des erreurs. Un nombre limité de demandes est possible par jour.

## Confiance et confidentialité
Conversations, ressources d'un mentorat et justificatifs sont privés (visibles des seules personnes concernées et, pour les justificatifs, de l'équipe). La photo d'un mentor publié est publique ; celle d'un mentoré n'est visible que des personnes en relation avec lui. Le mentor accompagne et conseille ; il ne fait pas le travail à la place du mentoré.
`;
