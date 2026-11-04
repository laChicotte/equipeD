# syntax=docker/dockerfile:1
# Image de production de l'API NestJS — à construire depuis la RACINE du monorepo :
#   docker build -f backend/Dockerfile -t talents-connectes-api .
# Cibles :
#   runtime (défaut) : API seule, dépendances de production, utilisateur non root.
#   migrate          : applique les migrations Prisma (`prisma migrate deploy`) puis s'arrête.

FROM node:24-alpine AS base
ENV PNPM_HOME=/pnpm PATH=/pnpm:$PATH
RUN corepack enable
WORKDIR /app

# ─── Dépendances (couche mise en cache tant que les manifestes ne changent pas) ─
FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
COPY backend/package.json backend/package.json
COPY frontend/package.json frontend/package.json
# Le postinstall du backend exécute `prisma generate` : schéma et configuration requis.
COPY backend/prisma backend/prisma
COPY backend/prisma.config.ts backend/prisma.config.ts
RUN --mount=type=cache,id=pnpm,target=/pnpm/store \
    pnpm install --frozen-lockfile --filter backend...

# ─── Compilation ─────────────────────────────────────────────────────────────
FROM deps AS build
COPY backend backend
RUN pnpm --filter backend build \
 && pnpm --filter backend deploy --prod --legacy /prod/backend

# ─── Migrations (outil ponctuel, contient la CLI Prisma) ─────────────────────
FROM build AS migrate
WORKDIR /app/backend
CMD ["npx", "prisma", "migrate", "deploy"]

# ─── Exécution ───────────────────────────────────────────────────────────────
FROM node:24-alpine AS runtime
ENV NODE_ENV=production PORT=4000
WORKDIR /app
COPY --from=build --chown=node:node /prod/backend/node_modules ./node_modules
COPY --from=build --chown=node:node /prod/backend/package.json ./package.json
COPY --from=build --chown=node:node /app/backend/dist ./dist
USER node
EXPOSE 4000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD wget -qO- http://127.0.0.1:4000/api/v1/health || exit 1
CMD ["node", "dist/main.js"]
