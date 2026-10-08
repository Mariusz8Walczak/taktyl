# 23 · Raport odbioru S1–S36 (TAKTYL-71)

Odbiór 2026-10-08 · baza: `main` @ `ecd7d58` + zmiany TAKTYL-71 · stos: Docker Compose, build produkcyjny, projekt `tk71`, od pustych wolumenów, `--build` przy każdym starcie · Docker 29.6, Windows 11 (bez `make` na hoście: użyto równoważnych poleceń `docker compose` z `Makefile`).

Dowody to wyjścia poleceń z przebiegu `tk71` (log Playwright, log Vitest, wyjścia skryptów); artefaktów z danymi lokalnymi nie commitujemy. Przy FAIL/SKIP podano zadanie.

## Wynik

| Obszar | Wynik |
|---|---|
| Playwright (`playwright test`, S1–S30, S34–S36 w części axe) | 149 passed, 2 skipped (testy `@mobile` w projekcie `desktop`, uruchamiane w projekcie `mobile`, tam przeszły), 0 flaky, 2,1 min |
| Vitest w kontenerze `test` (`make test`) | 1431 testów zielonych: domain 129, tokens 9, contracts 97, ui 112, admin 124, web 579, api 381 |
| `lint`, `typecheck` (18 zadań turbo), `audit:tokens` | zielone; `audit:tokens` i `audit:motion` 0 trafień |
| Budżet JS (`scripts/measure-js.mjs --budget`) | treść 141,8–149,5 kB gzip (limit 150), aplikacja: `/zbuduj-set` 166,6, `/koszyk` 152,5 kB (limit 400) |
| Audyt treści (`validate-content.mjs`) | OK (kontrola marek lokalna pominięta: brak `FORBIDDEN_BRANDS`, w CI jest) |
| Kontrola ścieżek zakazanych + self-test | OK |

## Tabela scenariuszy

| # | Wynik | Dowód |
|---|---|---|
| S1–S4 | PASS | `s01-s08-katalog.spec.ts` (filtry, liczniki, adres) |
| S5–S8 | PASS | `s01-s08-katalog.spec.ts` (ceny, Omnibus, Brak, ostatnie sztuki) |
| S9–S11, S21 | PASS | `s09-s11-s21-kreator.spec.ts` |
| S12–S16 | PASS | `s12-s16-koszyk.spec.ts` (w tym warianty `@mobile` w projekcie `mobile`) |
| S17–S20 | PASS | `s17-s20-zamowienie.spec.ts`; `pomiar.spec.ts` (jeden `purchase`, `payment_failed` przed nim) |
| S22–S24 | PASS | `s22-s24-wyszukiwarka-404-zgody.spec.ts` |
| S25 | PASS | `s25-cena-propagacja.spec.ts` (≤ 5 s od zapisu, Omnibus z historii, `audit_log`) |
| S26 | PASS | `s26-zamowienie-w-panelu.spec.ts` |
| S27 | PASS | `s27-stan-brak.spec.ts` (z odstępstwem Q-08: kafel nieaktywny z „Brak”, API 409) |
| S28, S29 | PASS | `s28-s29-role-i-dziennik.spec.ts` |
| S30 | PASS | podpis HMAC 401/200/422: `s30-s34-s35-webhook-i-api.spec.ts`; wyłączenie sklepu: `scripts/smoke-outbox.sh` (poniżej) |
| S31 | PASS | `docker compose -p tk71 up --build -d --wait` od pustych wolumenów: **80 s** (limit 600 s), wszystkie usługi `healthy`, `smoke-stack.sh` 12/12, sklep 200, panel 307 (do logowania), `/health` ok, w bazie 18/99/4 |
| S32 | PASS | `seed --reset` po edycjach (krok 5 skryptu `smoke-outbox.sh` po cenie 196 zł): cena Wróbla 12900 gr, stan `M-JRZ-MGL` 2, zamówienia 0, sklep pokazuje 129,00 zł; pętla `reset-demo` i przycisk: job CI `e2e-demo` (`smoke-demo.sh --cycle`), nieuruchamiane lokalnie (profil demo) |
| S33 | PASS (część lokalna) | `check-forbidden-paths.sh` i `--self-test` OK; gitleaks na całej historii tylko w CI (kontener nie widzi `.git` worktree) |
| S34 | PASS | `s30-s34-s35-webhook-i-api.spec.ts` + `smoke-stack.sh` (noindex na 3 hostach, w 404, meta, `robots.txt`) |
| S35 | PASS | `s30-s34-s35-webhook-i-api.spec.ts` (422 z listą SKU, 409 `price_changed`, idempotencja) |
| S36 | SKIP (część) | PASS: axe sklepu (`a11y-wcag.spec.ts`) i 7 ekranów panelu + logowanie, audyt designu §3 (sklep 17 stron × 2 szerokości, panel 14 ekranów), 0 obcych domen (S24 + audyt), budżet JS. **Brak Lighthouse CI**: LCP, CLS, INP i waga pierwszego widoku nie są mierzone w repo (CI ma to „do dodania”, `docs/12` §4). Zadanie TAKTYL-83 |

## S30: „wyłącz sklep”, rozwiązanie

Kontener `e2e` nie ma gniazda Dockera, więc `test.fixme` nie mógł być zamknięty testem Playwright. Wybrano skrypt na hoście, który na tym samym stosie robi dokładnie kroki z `docs/12` §7: `docker compose stop web` → zmiana ceny Wróbla przez API admina (owner) → sprawdzenie, że wiersz `outbox` nie jest `sent` i ma próby (wynik: 1 zdarzenie, 3 próby po 15 s) → `docker compose start web` → oczekiwanie na `sent` (wynik: 5 s po starcie sklepu) → HTML `/myszki/wrobel` zawiera nową cenę (196,00 zł) → `seed --reset`. Wynik 2026-10-08: wszystko ok. Skrypt: `scripts/smoke-outbox.sh` (+ `.mjs` w kontenerze `api`, jak `smoke-demo`), `make smoke-outbox`, krok w jobie CI `e2e-docker` (nie w `e2e-demo`, bo pętla `reset-demo` czyściłaby `outbox` w trakcie). `test.fixme` usunięty z Playwright (zastąpiony komentarzem z odwołaniem).

## Usterki i uwagi

- **Lighthouse (S36, `docs/12` §4)**: brak narzędzia w repo; zgłoszone jako TAKTYL-83 (projekt `taktyl`), nie zaokrąglane do PASS.
- Mała poprawka: w `Makefile` `.PHONY` zawierał sklejone `audit-designsmoke` (brakujące cele `audit-design` i `smoke` jako phony); poprawione.
- S31 zmierzono z ciepłym cache warstw Dockera (80 s); zimny pomiar z I-009 to 197 s. Oba w limicie 600 s.
- README mówi o `make e2e` / `make test`; oba działają w opisanych krokach (tu wykonane jako `docker compose -p tk71 --profile e2e run --rm --build e2e pnpm exec playwright test` i `--profile test run --rm test`).
