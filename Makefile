# I-005 (ADR-0009, TAKTYL-6): skroty do Docker Compose. Na maszynie wystarczy Docker (Compose v2), git i make.
# Bez make dzialaja polecenia `docker compose ...` z README.
COMPOSE ?= docker compose
DEV_SERVICES = db migrate seed api-dev web-dev admin-dev proxy-dev
HTTP_PORT := $(shell sed -n 's/^PROXY_HTTP_PORT=//p' .env 2>/dev/null | head -n 1)
SITE_PORT := $(if $(filter-out 80,$(HTTP_PORT)),:$(HTTP_PORT),)

.DEFAULT_GOAL := help
.PHONY: help env up down dev dev-down test reset logs build ps lint typecheck audit-tokens smoke clean

help: ## lista polecen
	@grep -E '^[a-z-]+:.*## ' $(MAKEFILE_LIST) | sed 's/:.*## /\t/' | sort

env: ## tworzy .env z losowymi sekretami lokalnymi (nie nadpisuje istniejacego)
	@sh scripts/init-env.sh
	@if grep -q CHANGE_ME .env; then echo "W .env zostal placeholder CHANGE_ME: wpisz sekrety." >&2; exit 1; fi

up: env ## buduje i uruchamia pelny stos (tryb produkcyjny lokalnie), czeka na healthchecki
	$(COMPOSE) up --build -d --wait
	@echo "Sklep:     http://taktyl.localhost$(SITE_PORT)"
	@echo "Backpanel: http://admin.taktyl.localhost$(SITE_PORT)"
	@echo "API:       http://api.taktyl.localhost$(SITE_PORT)/health"

down: ## zatrzymuje stos (dane w wolumenach zostaja)
	$(COMPOSE) --profile dev --profile test --profile demo down --remove-orphans

dev: env ## hot reload (profil dev, kod montowany z hosta)
	$(COMPOSE) --profile dev up --build -d --wait $(DEV_SERVICES)
	@echo "Sklep (dev):     http://taktyl.localhost$(SITE_PORT)"
	@echo "Backpanel (dev): http://admin.taktyl.localhost$(SITE_PORT)"
	@echo "Logi: make logs"

dev-down: ## zatrzymuje stos dev
	$(COMPOSE) --profile dev down --remove-orphans

test: env ## Vitest w kontenerze test (baza testowa w tmpfs)
	$(COMPOSE) --profile test run --rm test
	$(COMPOSE) --profile test down --remove-orphans

reset: env ## przywraca dane demo z data/*.json (kasuje zmiany w bazie roboczej)
	$(COMPOSE) run --rm -e DEMO_MODE=true seed node dist/seed.js --reset

logs: ## logi wszystkich uslug (ogon 100 linii, na zywo); jedna usluga: make logs S=api
	$(COMPOSE) --profile dev logs -f --tail=100 $(S)

build: env ## buduje obrazy bez uruchamiania
	$(COMPOSE) build

ps: ## stan uslug i healthchecki
	$(COMPOSE) --profile dev --profile test --profile demo ps -a

lint: env ## ESLint w kontenerze
	$(COMPOSE) --profile test run --rm --no-deps test pnpm turbo run lint

typecheck: env ## TypeScript w kontenerze
	$(COMPOSE) --profile test run --rm --no-deps test pnpm turbo run typecheck

audit-tokens: env ## audyt tokenow w kontenerze
	$(COMPOSE) --profile test run --rm --no-deps test pnpm audit:tokens

smoke: ## test dymny dzialajacego stosu (noindex na hostach, /health, 18 produktow)
	@sh scripts/smoke-stack.sh

clean: ## zatrzymuje stos i KASUJE wolumeny (baza, media, node_modules dev)
	$(COMPOSE) --profile dev --profile test --profile demo down -v --remove-orphans
