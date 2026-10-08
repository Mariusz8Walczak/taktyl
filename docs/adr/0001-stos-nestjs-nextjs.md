# ADR-0001 · Stos: NestJS + Next.js (React) zamiast Astro + localStorage

- **Status:** przyjęta (decyzja właściciela projektu, 2026-10-07)
- **Zastępuje:** `docs/02` §1 (Astro + czysty JS + localStorage) oraz `docs/11` §4 (wiersz „Backend, panel administracyjny, baza danych”)
- **Zachowuje:** wszystko inne z `docs/01`–`docs/12` (funkcje F-xxx, tokeny, animacje A-xx, zdarzenia, kryteria odbioru)

## Kontekst

Dokumentacja bazowa zakładała statyczny sklep (Astro) bez backendu. Właściciel chce **wzorcowej aplikacji** do pokazywania publicznie: działający backpanel, działający sklep, a zmiana w backpanelu ma być widoczna w sklepie. To wymaga API, bazy i mechanizmu propagacji zmian.

## Decyzja

| Warstwa | Wybór | Powód |
|---|---|---|
| Język | TypeScript (strict) wszędzie | jeden język, współdzielone typy i logika domeny |
| API + backpanel (backend) | **NestJS 11** | moduły, DI, guardy, pipes, OpenAPI — czytelna architektura do pokazania |
| Baza | **PostgreSQL 16** + **Prisma** | relacje (produkt → wariant → cena → historia cen), migracje, seed z `data/*.json` |
| Walidacja i kontrakt | **Zod** (pakiet `shared`) + OpenAPI generowane z DTO | jedna definicja kształtu danych dla API, sklepu i backpanelu |
| Sklep | **Next.js 15** (App Router, React 19, RSC) | SSR/ISR dla treści, wyspy kliencie dla koszyka, kreatora i filtrów |
| Backpanel (UI) | **Next.js 15** jako osobna aplikacja `apps/admin` | React, rozdzielony od sklepu: osobny build, osobne uprawnienia, brak kodu admina w paczce sklepu |
| Stan serwera w backpanelu | TanStack Query + React Hook Form + TanStack Table | standard dla paneli, mało własnego kodu |
| Style | tokeny z `assets/tokens.css` + własny układ (flex, CSS grid) + `taktyl.css`; bez Bootstrapa (WEB-007) | zgodnie z `docs/06`; szablon: ADR-0004 |
| Testy | Vitest (domena, API), Playwright (S1–S24), axe-core (a11y), Lighthouse CI (budżet `docs/12` §4) | każdy punkt `docs/12` ma automat |
| Uruchomienie | Docker Compose (db, api, web, admin, proxy) | `git clone` → `pnpm i` → `docker compose up` |

## Konsekwencje

- Reguła 4 z `CLAUDE.md` („dane tylko z `data/*.json`”) zmienia znaczenie: `data/*.json` to **dane początkowe (seed) i wzorzec**; w czasie działania źródłem prawdy jest baza, edytowana backpanelem. Model nadal niczego nie dopisuje do `data/*.json` ani do seedu (ADR-0005).
- Wymóg „budżet JS ≤ 150 KB na stronach treściowych” (`docs/12` §4) obowiązuje bez zmian — wymusza RSC i wyspy kliencie zamiast SPA.
- Reguła „żadnej biblioteki animacji” (`docs/07` §1) obowiązuje bez zmian.
- `docs/11` §4: backend jest teraz w zakresie; **nadal poza zakresem:** prawdziwe płatności, e-maile, przewoźnicy, wersje językowe.

## Odrzucone

| Opcja | Dlaczego nie |
|---|---|
| Zostać przy Astro + JSON | nie spełnia wymogu działającego backpanelu |
| Next.js jako jedyna aplikacja (API w route handlers) | gorsza demonstracja architektury, brak osobnych granic backend/frontend |
| Backpanel w tej samej aplikacji co sklep (`/admin`) | kod admina w paczce sklepu, wspólny budżet JS, trudniejsza izolacja uprawnień |
| Strapi / Payload / gotowy CMS | repo ma pokazywać własną, czystą architekturę, nie konfigurację cudzej |
