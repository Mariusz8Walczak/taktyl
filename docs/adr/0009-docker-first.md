# ADR-0009 · Docker-first: całość działa w kontenerach

- **Status:** przyjęta (polecenie właściciela, 2026-10-07)

## Wymaganie

Całość — baza, API, sklep, backpanel, proxy, seed, testy — uruchamia się w Dockerze. Na maszynie wystarczy Docker (z Compose v2) i git. Nie wymagamy lokalnego Node, pnpm ani PostgreSQL.

## Decyzja

Jeden `docker-compose.yml` z profilami, wspólne `Dockerfile` wielostopniowe w `apps/*`.

| Usługa | Obraz / rola | Port (host) | Profil |
|---|---|---|---|
| `db` | `postgres:16-alpine`, wolumen `pgdata`, healthcheck | — (wewnętrzny) | domyślny |
| `migrate` | jednorazowo: `prisma migrate deploy` | — | domyślny |
| `seed` | jednorazowo: wczytanie `data/*.json` (idempotentnie) | — | domyślny |
| `api` | NestJS (`apps/api`), healthcheck `/health` | wewnętrzny 4000 | domyślny |
| `web` | Next.js sklep (`apps/web`) | wewnętrzny 3000 | domyślny |
| `admin` | Next.js backpanel (`apps/admin`) | wewnętrzny 3001 | domyślny |
| `proxy` | Caddy: `taktyl.localhost` → web, `admin.taktyl.localhost` → admin, `api.taktyl.localhost` → api; nagłówek `X-Robots-Tag: noindex, nofollow` na wszystkim | 80 / 443 | domyślny |
| `dev` | tryb deweloperski z montowanym kodem i hot reload (`web`, `admin`, `api` w trybie watch) | j.w. | `dev` |
| `test` | Vitest + Playwright (obraz z przeglądarkami), start od `db:reset-demo` | — | `test` |
| `reset-demo` | cykliczny reset danych demo (tylko gdy `DEMO_MODE=true`) | — | `demo` |

## Polecenia dla człowieka (docelowe, opisane w README)

```
cp .env.example .env              # uzupełnić sekrety lokalne
docker compose up --build         # produkcyjny tryb lokalny: sklep, backpanel, API, baza
docker compose --profile dev up   # praca z hot reload
docker compose --profile test run --rm test
```

Skróty przez `make` (lub `just`) w pliku w repo: `make up`, `make dev`, `make test`, `make reset`, `make logs`.

## Zasady

- Obrazy aplikacji: budowa wielostopniowa, finalny obraz bez narzędzi budowania, użytkownik nie-root, `NODE_ENV=production`, Next.js w trybie `standalone`.
- Wersje obrazów bazowych przypięte (tag + digest w CI).
- Sekrety wyłącznie przez `.env` / `env_file` (poza repo); w obrazach brak sekretów.
- Healthchecki na każdej usłudze; `depends_on: condition: service_healthy`.
- Katalog `vendor/crafto/` (jeśli istnieje u właściciela) jest montowany **tylko do budowy lokalnej** przez `docker compose -f docker-compose.yml -f docker-compose.crafto.yml`, ten plik nadpisań jest w `.gitignore` (ADR-0004).
- Zdjęcia (manifest `docs/09`): wolumen `media` montowany do `api`, serwowany przez `proxy`; backpanel wgrywa tam pliki dostarczone przez człowieka.
- Testy odbioru (`docs/12`) wykonują się w kontenerze `test` przeciw pełnemu stosowi `compose`, więc wynik jest taki sam na każdej maszynie i w CI.
- CI buduje te same obrazy (GitHub Actions + buildx cache), uruchamia `compose` ze stosem testowym i publikuje raport.

## Konsekwencje

- Budżet wydajności i audyt designu mierzone są na stosie z `compose` (build produkcyjny), nie na trybie dev.
- Dokumentacja architektury (`docs/14`) opisuje topologię kontenerów jako część systemu, nie dodatek.
