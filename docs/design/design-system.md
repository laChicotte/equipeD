# Système de design — TalentsConnect

> Les tokens vivent dans `frontend/src/app/globals.css` (bloc `@theme` de Tailwind 4).
> Les noms historiques des couleurs sont conservés : `ink` = vert forêt, `teal` = terre cuite, `amber` = safran.

## 1. Direction

Format **réseau professionnel** (lisible et familier pour un jury qui utilise LinkedIn), avec une
identité propre pour s'en distinguer :
- palette « forêt et latérite », qui évoque la Guinée ;
- avatars en carré arrondi plutôt qu'en rond ;
- navigation centrale en pastilles, où seule la page active affiche son nom ;
- motif de losanges inspiré des textiles d'Afrique de l'Ouest, sur les bandeaux vert forêt ;
- accueil public éditorial, avec des photos sous licence libre.

## 2. Couleurs

| Rôle | Token | Valeur | Usage |
|---|---|---|---|
| Base sombre | `ink-950` / `ink-900` | `#0b201a` / `#12342a` | Bandeaux, boutons principaux, pastille active, pied de page |
| Base secondaire | `ink-800` / `ink-700` | `#1a4335` / `#245343` | Survols, barres de progression neutres |
| Action et accent | `teal-700` / `teal-600` | `#a8401d` / `#c0502a` | Boutons d'action, liens, chiffres mis en avant, focus |
| Accent chaleureux | `amber-400` / `amber-500` | `#e9ae48` / `#d4922a` | Icône de la page active, badges vérifiés, certificats |
| Fond | `background` | `#f7f3ec` | Ivoire |
| Surface | `surface` | `#ffffff` | Cartes |
| Texte | `foreground` / `muted-foreground` | `#13251f` / `#5b675f` | Texte principal et secondaire |
| États | `success-700`, `warning-700`, `danger-700` | — | Toujours accompagnés d'une icône ou d'un libellé |

Les contrastes du texte sur fond clair visent le niveau WCAG AA.

## 3. Typographie

- **Lexend** (`font-display`) : titres, chiffres clés, noms.
- **Schibsted Grotesk** (`font-sans`) : texte courant et interface.
- Échelle : titres de page 22–28 px, titres de carte 16–19 px, texte 14–16 px, mentions 11–13 px. Chiffres en `tabular-nums`.

## 4. Formes, ombres, espacements

- Rayons : `--radius-sm` 6 px, `md` 10 px (boutons, champs), `lg` 14 px (cartes), `xl` 18 px (bandeaux).
- Boutons en pastille (`rounded-full`) ; avatars en carré arrondi (`rounded-[30%]`).
- Cartes : surface blanche, filet léger `ring-border/70` et ombre douce `shadow-card` ; `shadow-raised` réservée à ce qui flotte (menus, dialogues, survol des cartes).
- Grille : contenu centré à 1128–1240 px. L'accueil connecté a trois colonnes (profil 225 px, fil, suggestions 300 px), qui se réduisent progressivement.

## 5. Composants clés

| Composant | Fichier | Rôle |
|---|---|---|
| Barre de navigation | `components/layout/app-shell.tsx` | Logo, pastilles, recherche, cloche, menu ; barre d'onglets en bas sur mobile |
| Avatar | `components/ui/avatar.tsx` | Photo de profil ou initiales (jamais de photo inventée) |
| Carte et ligne mentor | `features/mentors/mentor-card.tsx` | Identité, compétences, prochain créneau, mentorés accompagnés, certificats |
| Bandeau de page | `components/layout/page-band.tsx` | Aplat vert forêt avec motif, recherche et filtres |
| Certificat | `features/certificates/certificates.tsx` | Document imprimable, code de vérification |
| Messagerie | `features/messages/messaging.tsx` | Liste des conversations et conversation ouverte |
| États | `components/feedback/states.tsx` | Chargement, vide, erreur, accès refusé |

## 6. Responsive

- Conçu d'abord pour le mobile ; vérifié à 375 et 390 px pour les écrans principaux.
- Sur mobile : barre d'onglets en bas (5 entrées au plus), recherche dans la barre du haut, colonnes latérales masquées, messagerie en deux temps (liste, puis conversation avec retour).

## 7. Accessibilité

- Focus visible, libellés sur tous les champs, `aria-current` sur la navigation, `aria-live` sur les résultats et la conversation.
- Zones tactiles d'au moins 36–44 px ; animations réduites si l'utilisateur le demande (`prefers-reduced-motion`).
- Couleur jamais seule porteuse d'information : statuts avec libellé, graphiques avec titre et tableau de données.
- Graphiques du pilotage : un petit graphique par mesure (jamais deux échelles sur un même axe), une seule couleur, info-bulle au survol, tableau équivalent.

## 8. Contenus et images

- Photos de l'accueil sous licences libres (Wikimedia Commons : CC0, CC BY, CC BY-SA), crédits dans `frontend/public/images/credits.json` et le pied de page.
- Aucune photo de personne réelle présentée comme utilisatrice ; aucun faux témoignage ni chiffre inventé.
