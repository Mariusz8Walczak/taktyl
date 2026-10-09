# I-005 (ADR-0009, TAKTYL-6): skroty do Docker Compose. Na maszynie wystarczy Docker (Compose v2), git i make.
# Bez make dzialaja polecenia `docker compose ...` z README.
COMPOSE ?= docker compose
DEV_SERVICES = db migrate seed api-dev web-dev admin-dev proxy-dev
HTTP_PORT := $(shell sed -n 's/^PROXY_HTTP_PORT=//p' .env 2>/dev/null | head -n 1)
SITE_PORT := $(if $(filter-out 80,$(HTTP_PORT)),:$(HTTP_PORT),)

.DEFAULT_GOAL := help
.PHONY: help env up down dev dev-down test e2e reset logs build ps lint typecheck audit-tokens audit-design smoke smoke-outbox demo smoke-demo smoke-mcp perf clean

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
	$(COMPOSE) --profile dev --profile test --profile demo --profile e2e --profile perf down --remove-orphans

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

# I-010 (TAKTYL-44): Playwright S1-S36 (docs/12; S25+ w projekcie backpanel po S1-S24, TAKTYL-54) w kontenerze e2e na pelnym stosie; kazdy przebieg zaczyna od db:reset-demo.
# Raport HTML: e2e/playwright-report/index.html, slady i zrzuty bledow: e2e/test-results. Pojedynczy plik: make e2e ARGS="tests/pomiar.spec.ts".
e2e: env ## Playwright S1-S36 w kontenerze e2e (stos, reset demo, testy); ARGS="..." przekazuje argumenty do playwright test
	$(COMPOSE) up -d --build --wait
	$(COMPOSE) --profile e2e run --rm --build e2e pnpm exec playwright test $(ARGS)

# I-012 (TAKTYL-83): Lighthouse (docs/12 par. 4, S36) w kontenerze perf na pelnym stosie; wyniki w perf/reports. PERF_ENFORCE=0 = tylko raport.
perf: env ## Lighthouse: LCP, CLS, TBT, waga i liczba zadan pierwszego widoku (5 stron, mediana z 3), progi docs/12
	$(COMPOSE) up -d --build --wait
	$(COMPOSE) --profile perf run --rm --build perf

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

audit-design: env ## audyt designu docs/12 par. 3 w przegladarce (strony P0 sklepu i ekrany backpanelu; wymaga dzialajacego stosu)
	$(COMPOSE) --profile e2e run --rm --build e2e sh -c "pnpm exec playwright test --project=setup && pnpm exec playwright test tests/audyt-designu.spec.ts tests/backpanel/audyt-designu-panel.spec.ts --no-deps --project=desktop --project=mobile --project=backpanel"

smoke: ## test dymny dzialajacego stosu (noindex na hostach, /health, 18 produktow)
	@sh scripts/smoke-stack.sh

# I-011 (S30, TAKTYL-71): wylacza sklep, zmienia cene, wlacza sklep; outbox ma dostarczyc zdarzenie (wymaga dzialajacego stosu).
smoke-outbox: ## test S30: sklep wylaczony na czas zmiany ceny, outbox dostarcza po jego powrocie
	@sh scripts/smoke-outbox.sh

# I-014 (docs/24): serwery MCP (front i backoffice) na prawdziwym stosie; KONCZY resetem danych demo, wiec wymaga DEMO_MODE=true.
smoke-mcp: env ## smoke serwerow MCP na dzialajacym stosie (wymaga DEMO_MODE=true; konczy resetem danych demo)
	@grep -q '^DEMO_MODE=true' .env || { echo "Ustaw DEMO_MODE=true w .env (smoke konczy sie resetem danych demo)." >&2; exit 1; }
	$(COMPOSE) up --build -d --wait
	$(COMPOSE) --profile test run --rm --no-deps --build test sh -c 'pnpm turbo run build --filter=@taktyl/mcp-front --filter=@taktyl/mcp-admin && TAKTYL_API_URL=http://api:4000 TAKTYL_ADMIN_EMAIL="$$ADMIN_BOOTSTRAP_EMAIL" TAKTYL_ADMIN_PASSWORD="$$ADMIN_BOOTSTRAP_PASSWORD" pnpm --filter @taktyl/mcp-core smoke'

# I-009 (B-014, TAKTYL-65): tryb demo. Wymaga DEMO_MODE=true w .env; NIGDY z prawdziwymi danymi (reset kasuje zamowienia).
demo: env ## stos z trybem demo (profil demo: cykliczny reset co DEMO_RESET_INTERVAL_MINUTES, domyslnie 60)
	@grep -q '^DEMO_MODE=true' .env || { echo "Ustaw DEMO_MODE=true w .env (tylko dla srodowiska bez prawdziwych danych)." >&2; exit 1; }
	$(COMPOSE) --profile demo up --build -d --wait
	@echo "Sklep:     http://taktyl.localhost$(SITE_PORT)"
	@echo "Backpanel: http://admin.taktyl.localhost$(SITE_PORT)  (Wejdz jako viewer; reset: Ustawienia, tylko owner)"

smoke-demo: ## test dymny trybu demo (reset przywraca seed); wymaga make demo
	@sh scripts/smoke-demo.sh

clean: ## zatrzymuje stos i KASUJE wolumeny (baza, media, node_modules dev)
	$(COMPOSE) --profile dev --profile test --profile demo --profile e2e down -v --remove-orphans
