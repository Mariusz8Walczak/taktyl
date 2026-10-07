# syntax=docker/dockerfile:1.7
# I-002 (ADR-0009, TAKTYL-3): obraz API (NestJS + Prisma). Kontekst budowy: korzen repo.
#   docker build -f apps/api/Dockerfile --target api .
# Cele: api (produkcyjny, domyslny), migrate (prisma migrate deploy, narzedzia migracji), seed uzywa celu api.
# Obraz bazowy: tag z konkretna wersja + digest (aktualizuje Dependabot, ADR-0009).
ARG NODE_IMAGE=node:22.23.3-alpine@sha256:0a7108bf6c7bf5de370ffb1a3ed6be93d405b43ff159f681a8d18c0e2bc2e402

FROM ${NODE_IMAGE} AS base
ENV PNPM_HOME=/pnpm \
    npm_config_store_dir=/pnpm/store \
    CI=true
ENV PATH=$PNPM_HOME:$PATH
# Prisma (silnik zapytan) wymaga OpenSSL na Alpine.
RUN apk add --no-cache openssl \
 && corepack enable \
 && corepack prepare pnpm@9.15.4 --activate
WORKDIR /app

# 1) Przycinamy monorepo do @taktyl/api i jego zaleznosci workspace.
FROM base AS pruner
RUN npm install -g turbo@2.11.7
COPY . .
RUN turbo prune @taktyl/api --docker

# 2) Pelna instalacja (z devDependencies), generowanie klienta Prisma, bundle tsup.
FROM base AS build
COPY --from=pruner /app/out/json/ ./
COPY --from=pruner /app/out/pnpm-lock.yaml ./pnpm-lock.yaml
RUN --mount=type=cache,target=/pnpm/store pnpm install --frozen-lockfile
COPY --from=pruner /app/out/full/ ./
COPY tsconfig.base.json ./
RUN pnpm turbo run build --filter=@taktyl/api

# 3) Tylko zaleznosci produkcyjne + wygenerowany klient Prisma (silnik) z etapu build.
FROM base AS prod-deps
COPY --from=pruner /app/out/json/ ./
COPY --from=pruner /app/out/pnpm-lock.yaml ./pnpm-lock.yaml
RUN --mount=type=cache,target=/pnpm/store pnpm install --frozen-lockfile --prod --ignore-scripts
RUN --mount=from=build,source=/app,target=/b \
    set -eu; \
    src="$(ls -d /b/node_modules/.pnpm/@prisma+client@*/node_modules/.prisma)"; \
    dst="$(ls -d node_modules/.pnpm/@prisma+client@*/node_modules)"; \
    cp -r "$src" "$dst/"
# Narzedzia budowania, ktore wpadaja jako zaleznosci (tsx, esbuild, typescript, CLI Prisma), nie sa potrzebne w runtime.
RUN rm -rf node_modules/.pnpm/typescript@* node_modules/.pnpm/tsx@* node_modules/.pnpm/esbuild@* \
           node_modules/.pnpm/@esbuild+* node_modules/.pnpm/prisma@* node_modules/.pnpm/@prisma+engines@*

# Cel migrate: narzedzia migracji (CLI Prisma jest devDependency), nie jest to obraz ruchu produkcyjnego.
FROM build AS migrate
ENV NODE_ENV=production
USER node
WORKDIR /app/apps/api
CMD ["pnpm", "exec", "prisma", "migrate", "deploy"]

# 4) Finalny obraz: bez narzedzi budowania, bez devDependencies, bez npm/yarn, uzytkownik nie-root.
FROM ${NODE_IMAGE} AS api
ENV NODE_ENV=production \
    API_PORT=4000
RUN apk add --no-cache openssl \
 && rm -rf /usr/local/lib/node_modules/npm /usr/local/lib/node_modules/corepack \
           /usr/local/bin/npm /usr/local/bin/npx /usr/local/bin/corepack /opt/yarn-*
WORKDIR /app
COPY --from=prod-deps --chown=node:node /app/node_modules ./node_modules
COPY --from=prod-deps --chown=node:node /app/apps/api/node_modules ./apps/api/node_modules
COPY --from=build --chown=node:node /app/apps/api/package.json ./apps/api/package.json
COPY --from=build --chown=node:node /app/apps/api/dist ./apps/api/dist
# Dane wejsciowe seeda (ADR-0005): seed szuka katalogu z data/products.json w gore od dist/.
COPY --chown=node:node data ./data
COPY --chown=node:node content ./content
COPY --chown=node:node assets/manifest.json ./assets/manifest.json
RUN mkdir -p /data/media && chown node:node /data/media
USER node
WORKDIR /app/apps/api
EXPOSE 4000
HEALTHCHECK --interval=10s --timeout=3s --start-period=20s --retries=5 \
  CMD wget -qO- "http://127.0.0.1:${API_PORT}/health" >/dev/null || exit 1
CMD ["node", "dist/main.js"]
