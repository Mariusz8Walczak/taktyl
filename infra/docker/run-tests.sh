#!/bin/sh
# I-003 (TAKTYL-4): skrypt kontenera test. Migracje na bazie testowej, potem Vitest dla calego monorepo.
# Miejsce na Playwright/axe/Lighthouse: dopisz kroki ponizej, gdy powstana scenariusze (docs/12).
set -eu
echo "[test] migracje bazy testowej"
pnpm --filter @taktyl/api exec prisma migrate deploy
echo "[test] vitest (turbo run test)"
pnpm turbo run test
