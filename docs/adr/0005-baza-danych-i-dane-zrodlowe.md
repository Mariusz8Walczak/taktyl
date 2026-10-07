# ADR-0005 · Baza danych i status `data/*.json`

- **Status:** przyjęta

## Decyzja

- Runtime: **PostgreSQL 16 + Prisma**. Schemat odwzorowuje model z `docs/04` §3 (produkt → warianty → zdjęcia), plus encje, których backpanel potrzebuje (szczegóły: `docs/17`).
- `data/*.json` pozostają **jedynym źródłem danych początkowych**: `pnpm db:seed` (w Dockerze: usługa `seed`) wczytuje je do bazy. Zmiany w danych początkowych robi się jak dotąd w `data/_generator.py`.
- Seed jest idempotentny i deterministyczny. `db:reset-demo` przywraca stan z JSON-ów (używane w publicznym demo, patrz ADR-0006).
- Ceny w bazie w **groszach** (`Int`), przeliczone raz przy seedzie z `Math.round(zł · 100)`.
- **Historia cen** (`price_history`) jest tabelą prawdy dla „najniższej ceny z 30 dni” (Omnibus, `docs/04` §5.2). Backpanel **nie ma pola ręcznego `lowest_30d`**: wartość liczy API. Seed wstawia historię tak, by Granit TKL i Wróbel dały dokładnie dane z `docs/04` §2 (699 zł, 139 zł).
- `regular_price` zostaje polem wewnętrznym (nigdy nie jest wyświetlane jako cena przekreślona).

## Co wolno, a czego nie (reguła 4 `CLAUDE.md` po zmianie)

| Kto | Wolno | Nie wolno |
|---|---|---|
| Model (agent) | czytać `data/*.json`, pisać `descriptions.json`, `reviews.json`, treści stron, migracje i kod seedu | dopisywać produkty, warianty, ceny, stany, parametry, marki do `data/*.json` i do seedu |
| Człowiek w backpanelu | edytować, dodawać i ukrywać produkty, ceny, stany, plakietki, treści | — |
| Testy | używać danych z seedu | tworzyć własne „fikcyjne produkty” w fixture’ach (wartości oczekiwane z `docs/12` wynikają z `data/`) |

## Konsekwencje

- Każda wartość oczekiwana w testach odbioru (`docs/12`) musi się zgadzać z seedem, nie z bazą po edycjach: testy e2e startują od `db:reset-demo`.
- Usunięcie produktu w backpanelu to **ukrycie** (`status = archived`); twarde usuwanie tylko dla produktów bez zamówień.
