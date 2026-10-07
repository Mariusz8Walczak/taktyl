# syntax=docker/dockerfile:1.7
# I-010 (ADR-0009, TAKTYL-44): kontener testow e2e. Obraz Playwrighta MUSI miec ta sama wersje co @playwright/test
# w package.json (przegladarki sa dopasowane do wersji). Kontekst budowy: katalog e2e/.
#   docker build -t taktyl-e2e:local e2e
ARG PLAYWRIGHT_IMAGE=mcr.microsoft.com/playwright:v1.63.0-noble@sha256:eff16c30e6f3f4af0a03fa4b706120d5e9b0891c344a27d64559aff5900a4a27
FROM ${PLAYWRIGHT_IMAGE}
ENV PNPM_HOME=/pnpm \
    npm_config_store_dir=/pnpm/store \
    CI=true \
    TZ=Europe/Warsaw
ENV PATH=$PNPM_HOME:$PATH
RUN corepack enable && corepack prepare pnpm@12.10.1 --activate
WORKDIR /work
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN --mount=type=cache,target=/pnpm/store pnpm install --frozen-lockfile
COPY . .
CMD ["pnpm", "exec", "playwright", "test"]
