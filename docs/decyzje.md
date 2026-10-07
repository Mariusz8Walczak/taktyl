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
| 2026-10-07 | F-064 F-107 (TAKTYL-11) | `@taktyl/domain` definiuje własne typy wejściowe (katalog, koszyk) i nie importuje `@taktyl/contracts` (jest pusty szkielet); gdy kontrakt API powstanie, typy domeny zostaną z nim uzgodnione, bez zmiany logiki. Importy względne z `.js` (ESM), testy czytają `data/*.json` z roota repo przez `test-utils.ts` (poza buildem) | zależność od pustego pakietu nie ma sensu; ESM w Node wymaga rozszerzeń |
| 2026-10-07 | F-107 (TAKTYL-11) | Kwoty ze znakiem (`+50,00 zł` w propozycjach) przez `Intl.NumberFormat` z `signDisplay: 'exceptZero'`, bez ręcznego składania znaku | reguła 7 |
| 2026-10-07 | F-152 F-153 F-155 (TAKTYL-12) | Darmowa dostawa od `afterDiscounts >= próg` (równo 299,00 zł już jest darmowa); `TAKTYL10` liczony jednym zaokrągleniem od sumy pozycji spoza setów i rozbijany na linie (jak rabat setu); kod bez pozycji spoza setów ma status `sets-only`; nieznany SKU pomijany z wpisem w `issues`, brak stanu i ilość ponad stan zgłaszane w `issues`, nie blokują wyceny | docs/03 §7 i docs/04 §5 nie rozstrzygają równości progu ani zaokrągleń kodu |
| 2026-10-07 | F-104 F-105 (TAKTYL-13) | Reguły liczone w kodzie wg `id` z `rules.json` (liczby, progi i komunikaty z JSON-a); `color-harmony`: elementy `neutralny` pasują do każdego koloru, reguła jest `ok`, gdy wśród pozostałych jest najwyżej jedna grupa harmonii, `{color}` = etykieta koloru nieneutralnego; `{profile}` przy braku profilu = „bez profilu”; propozycja podkładki: najmniejszy większy rozmiar spełniający regułę (typ ten sam co reguły, w stoku), remis ceny: ten sam kolor, potem kolejność w katalogu; propozycja myszki: wśród równorzędnych `fit[profil]` malejąco, potem cena; `cheapestCompliantPad` bierze podkładki typu biurko (szerokość i głębokość) lub mysz (szerokość >= strefa) | docs/03 §4.2-4.3 nie rozstrzygają tych brzegów |
| 2026-10-07 | F-065 F-173 F-005 (TAKTYL-14) | Termin wysyłki: godzina < `cutoff_hour` (14:00:00 już po odcięciu), czas ścienny z `Intl.DateTimeFormat` w strefie z `shop.json`, daty obywatelskie liczone na UTC (bez DST), święta jako opcjonalna lista `RRRR-MM-DD` (P2); etykieta „Wysyłka jutro” tylko gdy wysyłka następnego dnia kalendarzowego, inaczej „Wysyłka: poniedziałek, 12 października” (bez ręcznej odmiany dnia); początek zdania o dostawie („Dostawa kurierem”) podaje wywołujący. NIP: separatory spacja i myślnik dozwolone, przyjmowane tylko 10 cyfr, cyfra kontrolna 10 odrzucana, sama suma kontrolna (bez listy wykluczeń typu same zera). Wyszukiwanie: `\p{M}` zamiast zakresu znaków łączących (ten sam efekt co `docs/04` §9), `ł` osobno | docs/04 §5.4, §9 i docs/12 §2 nie podają tych brzegów |
| 2026-10-07 | C-001 | `packages/contracts` używa **Zod 4** (`^4.1`, stabilny), schematy `strictObject` dla żądań, `z.int()` dla groszy; pakiet niezależny od Nest/Next/Prisma i od `@taktyl/domain`. Eksporty: `shared/`, `public/`, `admin/` (+ subpath `./public`, `./admin`). TAKTYL-16 | Zod 4 ma wbudowany `z.toJSONSchema` (OpenAPI 3.1 z `docs/16`), nowy kod nie dziedziczy długu v3; `strict` realizuje regułę 10 (brak pól kart/BLIK/haseł) |
| 2026-10-07 | C-002 | Rozbieżność dokumentów: `docs/16` §6 podaje numer `TK-261007-A1B2` (zawiera `1`), a `docs/17` §3.4 wyklucza `0/O/1/I` z alfabetu `XXXX`. Kontrakt waliduje tolerancyjnie `TK-\d{6}-[A-Z0-9]{4}`; zawężenie alfabetu to decyzja generatora w API (do ujednolicenia przez `taktyl-api`: albo zmienić przykład, albo alfabet). TAKTYL-16 | przykład z dokumentacji musi przechodzić parse; alfabet jest szczegółem generatora, nie formatu |
| 2026-10-07 | C-003 | Pola `lowest_30d` w API nazywają się `lowest_30d_gr` (reguła sufiksu `_gr`, `docs/16` §1); `regular_price_gr` występuje wyłącznie w odpowiedziach admina. Identyfikatory BigInt (`audit_log.id`, `outbox.id`) w JSON jako string cyfr. TAKTYL-16 | brak liczb zmiennoprzecinkowych i utraty precyzji w JSON |

## Pytania otwarte (wymagają odpowiedzi właściciela)

| ID | Pytanie | Proponowana odpowiedź domyślna |
|---|---|---|
| Q-01 | Czy publikujemy repo wyłącznie z kodem własnym, a Crafto zostaje lokalnie w `vendor/crafto/` (ADR-0004)? Licencję szablonu czyta właściciel — to nie jest porada prawna. | tak; publiczna wersja działa na tokenach i Bootstrapie |
| Q-02 | Czy hasło w backpanelu (poza sklepem) jest akceptowalne mimo F-200 „żadnych pól hasła w serwisie”? | tak, tylko w backpanelu; sklep bez haseł |
| Q-03 | Nazwa repozytorium na GitHubie. | `taktyl` |
| Q-04 | Licencja kodu własnego. | MIT (font Archivo: OFL; szablon: osobna licencja, niedołączony) |
| Q-05 | Czy w publicznym demo chcemy wystawić backpanel w trybie `viewer` online, czy tylko lokalnie z Dockera? | tylko lokalnie z Dockera na start; hosting później |
| Q-06 | Zdjęcia: kiedy człowiek dostarczy 76 plików P0? Do tego czasu placeholdery (`docs/09`). | placeholdery |
| 2026-10-07 | D-006 | Treści seed leżą w repo: opisy produktów w `data/descriptions.json` (źródło: `scripts/build-descriptions.mjs`, kontrola: `scripts/validate-descriptions.mjs` w `node:22-alpine`), strony prawne i informacyjne w `content/pages/*.md` (frontmatter: slug, title, updated, demo; twarde spacje: `scripts/nbsp-pages.mjs`). Seed ładuje je do bazy (ADR-0005), w runtime źródłem prawdy jest baza i backpanel. Treści czekają na zatwierdzenie człowieka (D-003). Numer D-006, bo D-005 zajęło zadanie TAKTYL-9 | `data/` trzyma dane katalogowe, a strony to dokumenty; jeden plik na stronę ułatwia seed i edycję w backpanelu |
