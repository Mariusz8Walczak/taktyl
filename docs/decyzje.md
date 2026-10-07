# Decyzje i pytania otwarte

Format wpisu (reguła 11 `CLAUDE.md`): data · ID · decyzja · powód.

## Decyzje

| Data | ID | Decyzja | Powód |
|---|---|---|---|
| 2026-10-07 | ADR-0001 | Stos NestJS 11 + Next.js 15 + Postgres/Prisma + Zod, TypeScript | polecenie właściciela: wzorcowa aplikacja z backpanelem |
| 2026-10-07 | ADR-0002 | Monorepo pnpm + Turborepo; pakiety `domain`, `contracts`, `tokens` | jedna logika w sklepie i w API |
| 2026-10-07 | ADR-0003 | Propagacja zmian: ISR + `revalidateTag` z webhookiem HMAC i outbox | zmiana w backpanelu widoczna w sklepie ≤ 5 s |
| 2026-10-07 | ADR-0004 | Szablon Crafto (`docs/08` §6); jego pliki nie trafiają do publicznego repo | licencja Regular nie pozwala na publikację źródeł |
| 2026-10-07 | ADR-0005 | `data/*.json` = seed; źródłem prawdy w runtime jest baza; „najniższa cena z 30 dni” liczona z historii cen | Omnibus; backpanel nie ma pola ręcznego |
| 2026-10-07 | ADR-0006 | Backpanel z logowaniem, role owner/editor/viewer, tryb demo | publiczne demo musi być bezpieczne |
| 2026-10-07 | ADR-0007 | Koszyk w przeglądarce, zamówienia i wycena na serwerze | backpanel widzi zamówienia, ceny nie są ufane z klienta |
| 2026-10-07 | ADR-0008 | Zasady higieny publicznego repo | repo jest wizytówką |
| 2026-10-07 | ADR-0009 | Docker-first: całość w Docker Compose | polecenie właściciela |
| 2026-10-07 | D-001 | Nowe przedrostki ID: `B-xxx` (backpanel i API), `I-xxx` (infrastruktura, Docker, CI) | reguła 8 wymaga ID; `F-`/`A-` nie obejmują backendu |
| 2026-10-07 | D-002 | Backpanel nie ma odpowiednika w szablonie. Komponenty: Radix UI (bez stylu) + tokeny z `docs/06`; ikony tylko z fontu ikon szablonu; bez własnej grafiki | reguła 3: szablon nie ma panelu admina, więc to wyjątek „nie ma w szablonie” |
| 2026-10-07 | D-003 | Treści (opisy, opinie demo, poradniki, strony prawne wzorcowe, FAQ) pisze model, zgodnie z `docs/04` §7–8, `docs/01` §4 i `docs/11`; człowiek zatwierdza | polecenie „sam wymyśl treści” |
| 2026-10-07 | D-004 | Tryb deweloperski i testowy też w Dockerze (profile `dev`, `test`) | ADR-0009 |
| 2026-10-07 | D-005 | Źródłem prawdy tokenów i fontu zostaje `assets/` (`tokens.css`, `fonts/`). `packages/tokens/css/tokens.css` i `packages/tokens/assets/fonts/` to kopie bajtowo identyczne (`pnpm --filter @taktyl/tokens sync`), commitowane, żeby pakiet działał bez kroku budowania i w kontekście Dockera; test vitest i `scripts/sync-tokens.mjs --check` łamią CI przy rozjeździe. Układ `css/` + `assets/fonts/` zachowuje względną ścieżkę `../assets/fonts/...` z `tokens.css` bez edycji pliku. `scripts/audit-tokens.mjs` (`pnpm audit:tokens`, turbo) pomija wyłącznie `packages/tokens/css/tokens.css` | reguła 2 i „kopiuj bez zmian” (`docs/06`); jedna prawda + automatyczna kontrola zgodności (TAKTYL-9) |

## Pytania otwarte (wymagają odpowiedzi właściciela)

| ID | Pytanie | Proponowana odpowiedź domyślna |
|---|---|---|
| Q-01 | Czy publikujemy repo wyłącznie z kodem własnym, a Crafto zostaje lokalnie w `vendor/crafto/` (ADR-0004)? Licencję szablonu czyta właściciel — to nie jest porada prawna. | tak; publiczna wersja działa na tokenach i Bootstrapie |
| Q-02 | Czy hasło w backpanelu (poza sklepem) jest akceptowalne mimo F-200 „żadnych pól hasła w serwisie”? | tak, tylko w backpanelu; sklep bez haseł |
| Q-03 | Nazwa repozytorium na GitHubie. | `taktyl` |
| Q-04 | Licencja kodu własnego. | MIT (font Archivo: OFL; szablon: osobna licencja, niedołączony) |
| Q-05 | Czy w publicznym demo chcemy wystawić backpanel w trybie `viewer` online, czy tylko lokalnie z Dockera? | tylko lokalnie z Dockera na start; hosting później |
| Q-06 | Zdjęcia: kiedy człowiek dostarczy 76 plików P0? Do tego czasu placeholdery (`docs/09`). | placeholdery |
