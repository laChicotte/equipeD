# Mettre TalentsConnect en ligne gratuitement (Render)

Objectif : une adresse `https://…onrender.com` à partager avec des testeurs, sans payer de serveur.

## Ce qui est déployé

- **Un service web gratuit** construit depuis le `Dockerfile` de la racine : Next.js reçoit tout le trafic et relaie `/api/v1/*` (WebSocket compris) vers l'API NestJS, dans le même conteneur. Le cookie de session reste sur le même domaine, sans CORS.
- **Une base PostgreSQL gratuite.** Les photos et documents y sont stockés : aucun disque à prévoir.
- Au démarrage : migrations, puis comptes de démonstration **seulement si la base est vide** (`deploy/start.sh`). Une mise en veille suivie d'un redémarrage n'efface donc pas ce que les testeurs ont fait.

## Limites de l'offre gratuite

| Limite | Conséquence pour les tests |
|---|---|
| Le service s'endort après 15 minutes sans visite | La première visite suivante attend environ une minute. Prévenez les testeurs. |
| 750 heures de service par mois | Suffisant pour un service unique. |
| Base gratuite supprimée 30 jours après sa création (14 jours de grâce) | Parfait pour une phase de test. Au-delà : passer à l'offre payante ou à une base Neon gratuite (voir plus bas). |
| Pas de relais TURN | Les appels audio et vidéo passent avec un serveur STUN public, mais peuvent échouer entre deux réseaux mobiles très restrictifs. Le reste de la messagerie fonctionne. |
| Mémoire réduite | API et Next.js ont chacun un plafond de mémoire (`deploy/start.sh`). |

Vercel ne convient pas : il ne relaie pas les WebSocket, donc pas de messages en direct ni d'appels.

## Étapes

1. **Pousser le code sur GitHub** (la branche que Render suivra, par exemple `main`).
2. Créer un compte sur [render.com](https://render.com), de préférence avec « Sign in with GitHub », et autoriser l'accès au dépôt.
3. Dans Render : **New → Blueprint**, choisir le dépôt et la branche. Render lit `render.yaml` et propose :
   - le service `talentsconnect` (Docker, Free) ;
   - la base `talentsconnect-db` (Free).
4. Render demande la valeur de `OPENAI_API_KEY`.
   - Pour activer l'IA, collez la clé.
   - Sinon, laissez vide : les boutons d'IA et l'assistant restent masqués.
   - **Fixez aussi une limite de dépense dans le compte OpenAI.**
5. Cliquez sur **Apply**. La première construction prend 10 à 15 minutes.
6. À la fin, ouvrez l'adresse affichée : `https://talentsconnect.onrender.com`, ou `https://talentsconnect-xxxx.onrender.com` si le nom est déjà pris chez Render.
   - `WEB_ORIGINS` est rempli automatiquement avec cette adresse, grâce à `RENDER_EXTERNAL_URL`.
   - Si vous ajoutez un domaine personnalisé, ajoutez-le aussi à `WEB_ORIGINS`, séparé par une virgule.

Chaque `git push` sur la branche suivie redéploie automatiquement.

## Comptes de test

- Les comptes fictifs suivent le format `<prenom>@demo.talents-connectes.test`, avec le mot de passe `Mentorat2026!`. Prénoms disponibles : aminata, mohamed, fatoumata, thierno, mariama, sekou, aissatou, lansana, admin.
- Vos amis peuvent aussi **créer leur propre compte** depuis « Inscription ».
- **Le mot de passe de démo est public : changez celui du compte `admin` dès le premier déploiement** (Mon compte → Sécurité). La seed ne le remet pas à zéro, puisqu'elle ne repasse pas sur une base remplie.
- Mot de passe oublié : il n'y a pas d'email. L'administrateur génère un lien dans Administration → Comptes → « Réinitialiser ».

## Variables d'environnement (service web)

| Variable | Valeur | Rôle |
|---|---|---|
| `DATABASE_URL` | fournie par la base Render | Connexion PostgreSQL |
| `SESSION_SECRET` | générée par Render | Hash des jetons de session |
| `SEED_DEMO` | `true` | Comptes fictifs sur base vide (`false` pour un vrai lancement) |
| `TRUST_PROXY` | `1` | IP réelle des visiteurs pour les limites de débit (connexion : 5 essais par minute et par IP) |
| `STUN_URLS` | `stun:stun.l.google.com:19302` | Appels audio et vidéo |
| `OPENAI_API_KEY` | facultative | Assistance par IA |
| `AI_GLOBAL_DAILY_LIMIT` | `300` | Plafond d'appels d'IA par jour |
| `WEB_ORIGINS` | automatique | À définir seulement avec un domaine personnalisé |

Le bandeau « Environnement de démonstration » est activé à la construction (`NEXT_PUBLIC_DEMO_MODE=true` dans le `Dockerfile`).

## Après 30 jours : base Neon gratuite (facultatif)

1. Créez un projet sur [neon.tech](https://neon.tech), région Europe (Francfort).
2. Copiez la chaîne de connexion. Elle se termine par `?sslmode=require`.
3. Dans Render, remplacez `DATABASE_URL` par cette valeur. Les migrations et les comptes de démo sont recréés au redémarrage suivant.
4. Les extensions `btree_gist` et `pg_trgm`, nécessaires aux contraintes anti double réservation, sont disponibles sur Neon.

## Tester l'image en local

```bash
docker build -t talentsconnect .
docker run --rm -p 3300:3000 \
  -e DATABASE_URL=postgresql://talents:talents_dev_password@host.docker.internal:5450/talents_connectes_preprod \
  -e SESSION_SECRET=$(node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))") \
  -e WEB_ORIGINS=http://localhost:3300 -e SEED_DEMO=true \
  talentsconnect
```

En local, sans HTTPS, le cookie `Secure` de production n'est pas conservé par le navigateur, sauf sur `localhost` (Chrome et Firefox l'acceptent).
