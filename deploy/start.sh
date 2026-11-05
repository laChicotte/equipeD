#!/bin/sh
# Démarrage du conteneur tout-en-un : migrations, données de démo (base vide seulement),
# puis API (127.0.0.1:4000) et Next.js (port public $PORT).
set -e

# Render fournit l'adresse publique du service : origine autorisée par défaut (vérification CSRF).
export WEB_ORIGINS="${WEB_ORIGINS:-$RENDER_EXTERNAL_URL}"
if [ -z "$WEB_ORIGINS" ]; then
  echo "WEB_ORIGINS est obligatoire (adresse publique du site, ex. https://exemple.onrender.com)." >&2
  exit 1
fi

cd /app/backend
npx prisma migrate deploy
# Les comptes de démo ne sont chargés que sur une base vide : un redémarrage (mise en veille du
# service gratuit) n'écrase pas ce que les testeurs ont modifié.
if [ "$SEED_DEMO" = "true" ] && node /app/deploy/db-is-empty.mjs; then
  npx prisma db seed
fi

NODE_OPTIONS="--max-old-space-size=192" PORT=4000 node dist/main.js &
API_PID=$!

cd /app/frontend
NODE_OPTIONS="--max-old-space-size=224" node_modules/.bin/next start -H 0.0.0.0 -p "${PORT:-3000}" &
WEB_PID=$!

stop() {
  kill -TERM "$API_PID" "$WEB_PID" 2>/dev/null || true
  wait
  exit 0
}
trap stop TERM INT

# Si l'un des deux processus s'arrête, le conteneur s'arrête aussi : l'hébergeur le relance.
while kill -0 "$API_PID" 2>/dev/null && kill -0 "$WEB_PID" 2>/dev/null; do
  sleep 5
done
echo "Un des processus s'est arrêté : arrêt du conteneur." >&2
kill -TERM "$API_PID" "$WEB_PID" 2>/dev/null || true
exit 1
