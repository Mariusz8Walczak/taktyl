# 22. Przegląd bezpieczeństwa (TAKTYL-70)

Data: 2026-10-08. Zakres: OWASP Top 10 dla API (`apps/api`), backpanelu (`apps/admin`), sklepu (`apps/web`), proxy (`infra/caddy`), obrazów Docker i zależności. Metoda: przegląd kodu względem `docs/14` par. 7 i ADR-0006/0007, testy w Dockerze (`docker compose -p tk70`), `pnpm audit`, kontrola obrazów (`docker inspect`, `docker history`), nagłówki z działającego stosu, pełny zestaw e2e (Playwright). Waga: wysoka, średnia, niska, informacyjna.

## 1. Ustalenia

| ID | Waga | Ustalenie | Status |
|---|---|---|---|
| SEC-01 | średnia | Sklep i backpanel nie wysyłały nagłówka `Content-Security-Policy` (`docs/14` par. 7 A05 wymaga CSP). Brak obrony w głąb przed wstrzyknięciem skryptu, ramek, `<base>`, `<object>` i cudzych `action` formularzy. | Naprawione: `apps/web/csp.mjs`, `apps/admin/csp.mjs`, nagłówek w `next.config.mjs` (produkcja). Pozostaje `script-src 'unsafe-inline'` (patrz Q-09). |
| SEC-02 | niska do średniej | `safeNext` (adres powrotu po logowaniu w backpanelu) przepuszczał `/\host`; przeglądarki traktują `\` jak `/`, więc adres wskazywał zewnętrzny serwis (otwarte przekierowanie po zalogowaniu). | Naprawione: `apps/admin/src/lib/auth/session.tsx`, test w `apps/admin/test/protection.test.tsx`. Odrzucane są też znaki sterujące i spacje. |
| SEC-03 | niska do średniej | `order_token` nie wygasał: po `ORDER_RETENTION_DAYS` (30 dni) dane osobowe zamówienia są czyszczone (B-209), ale skrót tokenu zostawał w bazie i token wciąż otwierał zamówienie oraz listę „Moje zamówienia”. | Naprawione: `orderTokenExpired` (`common/order-token.ts`), `OrderAccessService.authorize` i `OrdersService.list` (zamówienie starsze niż okno = 404 / pusta lista). Testy: jednostkowy i e2e. |
| SEC-04 | niska | Proxy wysyłał `X-Frame-Options: SAMEORIGIN`, a polityka aplikacji zakłada brak osadzania (`frame-ancestors 'none'`). Niespójność. | Naprawione: `DENY` w `infra/caddy/Caddyfile`. |
| SEC-05 | informacyjna | Webhook rewalidacji: okno 5 min bez pamięci użytych podpisów, więc powtórzenie przechwyconego żądania w oknie jest możliwe. Skutek ograniczony: `revalidateTag` jest idempotentne, treść żądania to wyłącznie lista dozwolonych znaczników, nie ma efektu ubocznego poza odświeżeniem cache. | Przyjęte, bez zmiany. Przy zmianie skutków webhooka dodać pamięć nonce (`X-Taktyl-Timestamp` + skrót podpisu). |
| SEC-06 | informacyjna | Logowanie (`POST /v1/admin/auth/login`) nie ma tokenu CSRF (nie ma jeszcze sesji). Atak „login CSRF” (zalogowanie ofiary na konto atakującego) wymaga poświadczeń atakującego, a ciasteczko jest `SameSite=Strict`. Ewentualne wzmocnienie: wymusić `Content-Type: application/json` na trasach mutujących. | Przyjęte. |
| SEC-07 | informacyjna | `app.set("trust proxy", 1)` zakłada dokładnie jedno proxy przed API (Caddy lub proxy Next). Za dodatkowym balancerem adres IP do limitów byłby adresem balancera. | Uwaga wdrożeniowa: przy hostingu z dodatkowym hopem zmienić liczbę zaufanych proxy w `app.setup.ts`. |
| SEC-08 | niska | `pnpm audit`: jedna luka niskiej wagi (esbuild, serwer deweloperski na Windows, ścieżka `tsup`), tylko zależność budowania, poza obrazem produkcyjnym. `e2e/`: brak luk. CI blokuje high i critical (job `audit-deps`). | Przyjęte do czasu aktualizacji `tsup`/esbuild (ADR-0010, najbliższa fala). |
| SEC-09 | informacyjna | Ciasteczko sesji nie ma prefiksu `__Host-`, bo wymaga atrybutu `Domain` (wspólne dla hostów). Ma `HttpOnly`, `SameSite=Strict`, `Secure` w produkcji. Backpanel używa proxy tego samego pochodzenia (`/v1/*`), więc `Domain` bywa zbędne. | Do rozważenia przy publikacji pod prawdziwą domeną. |

## 2. Co sprawdzono i jest w porządku

- **CSRF:** każda mutacja pod `/v1/admin/*` wymaga nagłówka `X-CSRF-Token` powiązanego z sesją (HMAC `SESSION_SECRET` nad id sesji i sekretem sesji), porównanie `timingSafeEqual`; guard domyślnie zamknięty (trasa bez `@Roles`/`@AdminPublic` = 403); kolejność: sesja, CSRF, rola.
- **Logowanie i brute force:** argon2id (19 MiB, 2 przebiegi), jednolity komunikat, sprawdzenie argon2 także dla nieistniejącego konta (brak enumeracji czasowej), blokada 5 prób na konto w 15 min i szerszy limit na IP (klucze zhashowane HMAC), dodatkowo throttler 10/min/IP, zapis zdarzeń w `audit_log` bez adresów e-mail.
- **Sesje:** token 32 B losowych, w bazie tylko SHA-256, wygasanie 12 h bezwzględnie i 30 min bezczynności, unieważnianie przy wylogowaniu, dezaktywacji i zmianie roli, `HttpOnly; SameSite=Strict; Secure` (produkcja).
- **IDOR na zamówieniach:** dostęp wyłącznie z `X-Order-Token`; baza trzyma SHA-256 tokenu; porównanie `timingSafeEqual` na skrótach; zły token i nieistniejący numer dają ten sam 404; brak tokenu 401; odczyt ograniczony do 30/min/IP; token pochodzi z HMAC (numer + klucz idempotencji) z kluczem serwera. Kwoty zamówienia API liczy samo (ADR-0007), niezgodna suma klienta daje 409.
- **Webhook rewalidacji:** HMAC-SHA256 nad `timestamp.body`, porównanie stałoczasowe, format podpisu i znacznika walidowany przed obliczeniem, okno 5 min w obie strony, limit ciała 16 kB, walidacja listy znaczników schematem z `contracts`, brak sekretu = 503, zły podpis = 401 bez ujawniania powodu.
- **Sanityzacja treści:** allowlista znaczników i adresów (`isSafeContentUrl`), dekodowanie encji przed oceną adresu, iteracja do punktu stałego, obrazy usuwane, końcowe `&lt;` dla wszystkiego poza dokładnie wypuszczonymi znacznikami; sklep i podgląd panelu składają elementy React (bez `dangerouslySetInnerHTML` dla treści użytkownika); JSON-LD serializowany z zamianą `<` na `<`; pozostałe `dangerouslySetInnerHTML` dotyczą wyłącznie własnych skryptów i JSON-LD.
- **Nagłówki:** API: `helmet` z CSP `default-src 'none'`, `frame-ancestors 'none'`, `Referrer-Policy: no-referrer`, bez `X-Powered-By`; proxy: `nosniff`, `Referrer-Policy`, `Permissions-Policy`, COOP, `-Server`, `noindex` z `defer` na każdym hoście i w błędach; CORS z jawnej listy źródeł, z `credentials`.
- **Obrazy Docker:** użytkownik `node` (nie root), brak `npm`, `corepack`, narzędzi budowania w obrazie API, brak sekretów w `Config.Env` i w `docker history`, `.dockerignore` wyklucza `.env*`, `docs`, `html`, `vendor`; kontekst budowy nie zawiera `.env`; obrazy bazowe przypięte digestem; proxy z `read_only`, `cap_drop: ALL`.
- **Repozytorium:** w indeksie git tylko `.env.example`; w CI działa skan `gitleaks` całej historii i `audit-deps`; `.gitleaks.toml` bez zmian.
- **Dane kart:** brak pól na numer karty, CVV, kod BLIK i hasła w sklepie (płatność to symulacja z wynikiem `paid`/`failed`); API przyjmuje wyłącznie `payment_type` i wynik symulacji.
- **Media:** upload tylko WebP (kontrola typu i sygnatury), limit rozmiaru, ścieżki rozwiązywane przez `resolveInMediaDir`.

## 3. Czego ten przegląd nie obejmuje

- Pełny skan historii gitleaksem lokalnie (robi go CI; `.gitleaks.toml` poza zakresem zadania).
- Testy penetracyjne na publicznie wystawionej instancji (nie ma jej; Q-05).
- CSP z nonce (wymaga decyzji, Q-09).

## 4. Zmiany w repozytorium

`apps/api/src/common/order-token.ts`, `apps/api/src/orders/order-access.service.ts`, `apps/api/src/orders/orders.service.ts`, `apps/api/test/orders.e2e.test.ts`, `apps/admin/src/lib/auth/session.tsx`, `apps/web/csp.mjs`, `apps/admin/csp.mjs`, `apps/web/next.config.mjs`, `apps/admin/next.config.mjs`, `infra/caddy/Caddyfile`, testy w `apps/web/test/csp.test.ts` i `apps/admin/test/csp.test.ts`.
