#!/bin/sh
# Mise à jour de TalentsConnect sur le VPS : récupère main, reconstruit et redémarre.
#   ssh vps-runner /opt/talentsconnect/deploy.sh
# Les données (base, fichiers) sont conservées ; les migrations s'appliquent au démarrage.
set -e
cd /opt/talentsconnect
git -C app pull --ff-only
[ -f app/deploy/vps/compose.yml ] && cp app/deploy/vps/compose.yml compose.yml
docker compose build app
# Notifications push : une paire de clés VAPID est créée une seule fois, gardée dans .env.
if ! grep -q '^VAPID_PUBLIC_KEY=' .env; then
  docker run --rm -w /app/backend --entrypoint node talentsconnect:latest -e     "const k=require('web-push').generateVAPIDKeys();console.log('VAPID_PUBLIC_KEY='+k.publicKey+'\nVAPID_PRIVATE_KEY='+k.privateKey+'\nVAPID_SUBJECT=mailto:contact@wistechnologie.com')"     >> .env
  chmod 600 .env
  echo "Clés des notifications push créées."
fi
docker compose up -d
docker image prune -f >/dev/null
echo "Attente du démarrage…"
for i in $(seq 1 60); do
  if curl -sf -o /dev/null http://127.0.0.1:3300/api/v1/health; then
    echo "TalentsConnect est en ligne."
    exit 0
  fi
  sleep 3
done
echo "L'application ne répond pas : docker compose logs --tail 80 app" >&2
exit 1
