# Image tout-en-un pour un hébergement gratuit à un seul service (Render) :
# Next.js reçoit tout le trafic (port $PORT) et relaie /api/v1/* (WebSocket compris) vers l'API
# NestJS, qui écoute sur 127.0.0.1:4000 dans le même conteneur. Le cookie de session reste
# first-party, sans CORS. Voir docs/deploiement.md.
#
#   docker build -t talents-connectes .
#
# Pour un serveur à soi, backend/Dockerfile (API seule) et backend/docker-compose.yml restent valables.

FROM node:24-alpine
ENV PNPM_HOME=/pnpm PATH=/pnpm:$PATH NEXT_TELEMETRY_DISABLED=1
RUN corepack enable
WORKDIR /app

# Dépendances (couche mise en cache tant que les manifestes ne changent pas).
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
COPY backend/package.json backend/package.json
COPY frontend/package.json frontend/package.json
# Le postinstall du backend exécute `prisma generate` : schéma et configuration requis.
COPY backend/prisma backend/prisma
COPY backend/prisma.config.ts backend/prisma.config.ts
RUN pnpm install --frozen-lockfile

# Bandeau « Environnement de démonstration » (comptes fictifs) : true pour une version de test.
ARG NEXT_PUBLIC_DEMO_MODE=true
# Lu au moment du build par next.config.ts (les rewrites sont figés dans l'image).
ENV NEXT_PUBLIC_DEMO_MODE=$NEXT_PUBLIC_DEMO_MODE API_URL=http://127.0.0.1:4000

COPY backend backend
COPY frontend frontend
RUN pnpm --filter backend build && pnpm --filter frontend build

COPY deploy deploy
ENV NODE_ENV=production
# Les fichiers (photos, documents) sont stockés dans PostgreSQL : aucun disque persistant requis.
RUN chown -R node:node /app/frontend/.next
USER node
EXPOSE 3000
CMD ["sh", "deploy/start.sh"]
