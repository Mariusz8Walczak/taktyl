# syntax=docker/dockerfile:1.7
# I-002 (ADR-0009, TAKTYL-3): obraz Next.js (sklep), tryb standalone. Kontekst budowy: korzen repo.
#   docker build -f apps/web/Dockerfile .
# Obraz bazowy: tag z konkretna wersja + digest (aktualizuje Dependabot, ADR-0009).
ARG NODE_IMAGE=node:22.23.3-alpine@sha256:0a7108bf6c7bf5de370ffb1a3ed6be93d405b43ff159f681a8d18c0e2bc2e402

FROM ${NODE_IMAGE} AS base
ENV PNPM_HOME=/pnpm     npm_config_store_dir=/pnpm/store     CI=true     NEXT_TELEMETRY_DISABLED=1
ENV PATH=$PNPM_HOME:$PATH
RUN apk add --no-cache libc6-compat  && corepack enable  && corepack prepare pnpm@9.15.4 --activate
WORKDIR /app

# 1) Przycinamy monorepo do @taktyl/web i jego zaleznosci workspace.
FROM base AS pruner
RUN npm install -g turbo@2.11.7
COPY . .
RUN turbo prune @taktyl/web --docker

# 2) Instalacja i build (next build, output: standalone).
FROM base AS build
COPY --from=pruner /app/out/json/ ./
COPY --from=pruner /app/out/pnpm-lock.yaml ./pnpm-lock.yaml
RUN --mount=type=cache,target=/pnpm/store pnpm install --frozen-lockfile
COPY --from=pruner /app/out/full/ ./
COPY tsconfig.base.json ./
# Adresy publiczne trafiaja do bundla klienta w czasie budowy (to nie sa sekrety).
ARG PUBLIC_SITE_URL=http://taktyl.localhost
ARG PUBLIC_API_URL=http://api.taktyl.localhost
ARG PUBLIC_ADMIN_URL=http://admin.taktyl.localhost
ARG PUBLIC_GTM_ID=
ENV PUBLIC_SITE_URL=$PUBLIC_SITE_URL PUBLIC_API_URL=$PUBLIC_API_URL     PUBLIC_ADMIN_URL=$PUBLIC_ADMIN_URL PUBLIC_GTM_ID=$PUBLIC_GTM_ID
RUN pnpm turbo run build --filter=@taktyl/web

# 3) Finalny obraz: tylko standalone + statyki, bez narzedzi budowania i bez npm/yarn, uzytkownik nie-root.
FROM ${NODE_IMAGE} AS runner
ENV NODE_ENV=production     NEXT_TELEMETRY_DISABLED=1     PORT=3000     HOSTNAME=0.0.0.0
RUN apk add --no-cache libc6-compat  && rm -rf /usr/local/lib/node_modules/npm /usr/local/lib/node_modules/corepack            /usr/local/bin/npm /usr/local/bin/npx /usr/local/bin/corepack /opt/yarn-*
WORKDIR /app
COPY --from=build --chown=node:node /app/apps/web/.next/standalone ./
COPY --from=build --chown=node:node /app/apps/web/.next/static ./apps/web/.next/static
# Katalog public/ (zdjecia dostarcza wolumen media przez proxy) dojdzie z zadaniami UI.
USER node
EXPOSE 3000
HEALTHCHECK --interval=10s --timeout=3s --start-period=20s --retries=5   CMD wget -qO- "http://127.0.0.1:${PORT}/api/health" >/dev/null || exit 1
CMD ["node", "apps/web/server.js"]
