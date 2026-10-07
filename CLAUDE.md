# Taktyl — stałe reguły dla modelu

Projekt: fikcyjny sklep demonstracyjny **Taktyl** (klawiatury, myszki, podkładki + kreator setu). Dokumentacja w `docs/`, dane w `data/`. Przed pierwszym zadaniem przeczytaj `README.md`, potem `docs/01`–`docs/12` po kolei. Przed każdym kolejnym zadaniem przeczytaj dokument, którego zadanie dotyczy.

## Reguły nadrzędne

1. **Nie tworzysz grafiki.** Żadnych ilustracji w SVG, rysunków w CSS lub canvas, wygenerowanych ikon, logo, wzorów tła, gradientów udających obraz. Ikony wyłącznie z zestawu ikon szablonu. Zdjęcia wyłącznie z `assets/manifest.json`. Brak zdjęcia oznacza placeholder opisany w `docs/09`, nigdy rysunek.
2. **Wygląd tylko z tokenów** (`docs/06`). Kolor, odstęp, promień, cień, rozmiar czcionki, czas i krzywa animacji istnieją wyłącznie jako zmienne w `:root`. Poza plikiem tokenów wyszukanie `#[0-9a-fA-F]{3,8}` i `rgb(` ma dać zero trafień. Jedyny wyjątek: kolory próbek produktów, czytane z `data/colors.json → swatch`.
3. **Komponenty z szablonu** (`docs/08`). Jeśli szablon ma odpowiednik, bierzesz go i przestylowujesz tokenami. Nowy komponent projektujesz tylko wtedy, gdy `docs/08` mówi, że szablon go nie ma.
4. **Dane tylko z `data/*.json`.** Nie dopisujesz produktów, wariantów, cen, stanów, parametrów ani marek. Opisy produktów piszesz wyłącznie z atrybutów (`docs/04`, sekcja Opisy).
5. **Żadnych prawdziwych bytów.** Bez prawdziwych marek (także w parametrach: nazwy producentów przełączników, sensorów, przewoźników, operatorów płatności), bez logotypów płatności i przewoźników, bez prawdziwych adresów, NIP-ów, numerów telefonów. Adresy e-mail tylko w domenie `taktyl.example`.
6. **Ruch tylko z katalogu** `docs/07`. Animujesz `transform` i `opacity` (płynna zmiana koloru dozwolona), nigdy wymiarów ani położenia w układzie. Każda animacja wyłączona przy `prefers-reduced-motion: reduce`.
7. **Polszczyzna przez API, nie ręcznie.** Ceny: `Intl.NumberFormat('pl-PL', {style:'currency', currency:'PLN'})`. Liczebniki: `Intl.PluralRules('pl')`. Daty: strefa `Europe/Warsaw`. Kwoty liczone w groszach (liczby całkowite).
8. **Każda funkcja ma ID** (`F-xxx` z `docs/02`, `A-xx` z `docs/07`). Podawaj ID w opisach commitów i w komentarzu nad kodem, który ją realizuje.
9. **Zdarzenia pomiaru tylko z `docs/10`**, nazwy i parametry bez zmian.
10. **Sklep jest demonstracyjny.** Pasek „Taktyl to sklep demonstracyjny…” jest widoczny, płatność jest symulacją, nie ma pól na dane kart, kody BLIK ani hasła. Strona ma `noindex`.
11. **Brak w dokumentach = pytanie, nie zgadywanie.** Drobne decyzje implementacyjne zgodne z tokenami podejmujesz sam i zapisujesz w `docs/decyzje.md` (data, ID, decyzja, powód).

## Definicja ukończenia zadania

Zadanie jest skończone, gdy spełnia odpowiednie punkty `docs/12-kryteria-odbioru.md`, działa z klawiatury i na szerokości 360 px, nie dodało wartości spoza tokenów i nie zostawiło treści z dema szablonu.

## Aneks po ADR-0001..0009

Decyzje architektoniczne: `docs/adr/`. Dokumenty rozszerzające: `docs/13`–`docs/21` (PRD, architektura, backpanel, API, model danych, przepływy, repozytorium, zespół agentów i skille, plan). Agenci i skille projektu: `.claude/agents/`, `.claude/skills/`. Powyższe reguły 1–11 obowiązują bez zmian; aneks je doprecyzowuje.

- **Stos (ADR-0001):** NestJS 11 (API + backpanel) · Next.js 15 / React 19 (sklep `apps/web`, backpanel `apps/admin`) · PostgreSQL 16 + Prisma · Zod · TypeScript strict · monorepo pnpm + Turborepo (ADR-0002). Stos z `docs/02` §1 (Astro, localStorage) jest zastąpiony; funkcje F-xxx i kryteria odbioru obowiązują.
- **Reguła 4 po zmianie (ADR-0005):** `data/*.json` to seed i wzorzec. W runtime źródłem prawdy jest baza edytowana backpanelem. Model nadal nie dopisuje produktów, wariantów, cen, stanów, parametrów ani marek do `data/*.json` ani do seedu; testy startują od `db:reset-demo`. „Najniższa cena z 30 dni” liczy API z historii cen.
- **Przedrostki ID (reguła 8):** oprócz `F-xxx` i `A-xx` używamy `B-xxx` (backpanel i API) oraz `I-xxx` (infrastruktura, Docker, CI). Podawaj je w commitach i w komentarzach nad kodem.
- **Docker-first (ADR-0009):** całość (baza, API, sklep, backpanel, proxy, seed, testy) działa w Dockerze; nie zakładaj lokalnego Node ani Postgresa. Testy i audyty mierz na stosie z `docker compose`.
- **Publiczne repo (ADR-0008, ADR-0004):** nigdy nie commituj `html/`, `vendor/`, `.env*` (poza `.env.example`), kluczy, haseł, dumpów bazy ani plików szablonu Crafto. Przed każdym pushem lista kontrolna z `docs/19`. Adres e-mail tylko w domenie `taktyl.example`; commity z adresem `noreply` GitHuba.
- **Wersje zależności (ADR-0010):** przed przypięciem wersji sprawdź najnowszą stabilną: `npm view <pkg> version` (i `dist-tags`) albo `docker buildx imagetools inspect <obraz>`; nie polegaj na pamięci. Piny i warunki odblokowania (TypeScript, jsdom, Postgres 16) są w ADR-0010.
- **Kolejność czytania:** `README.md` → `docs/01`–`docs/12` → `docs/adr/` → `docs/13`–`docs/21` → `docs/decyzje.md`.
