# syntax=docker/dockerfile:1.7
# I-012 (ADR-0009, TAKTYL-83): kontener pomiaru Lighthouse. Chromium bierzemy z obrazu Playwrighta (ten sam co e2e,
# przypiety digestem), Lighthouse CLI/API z npm w wersji przypietej w package.json.
#   docker build -t taktyl-perf:local perf
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
CMD ["node", "lighthouse.mjs"]
