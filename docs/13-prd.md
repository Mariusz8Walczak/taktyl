# 13 · PRD: Taktyl, wzorcowy sklep demonstracyjny z backpanelem

Wersja 1.0 · 2026-10-07 · właściciel produktu: właściciel repozytorium · status: do zatwierdzenia

Dokument opisuje **co** budujemy i **po co**. Jak: `docs/14` (architektura), `docs/15` (backpanel), `docs/16` (API), `docs/17` (model danych), `docs/18` (przepływy), `docs/21` (plan). Funkcje sklepu mają ID z `docs/02` (F-xxx), animacje z `docs/07` (A-xx). Nowe przedrostki (D-001 w `docs/decyzje.md`): **B-xxx** backpanel i API, **I-xxx** infrastruktura, Docker i CI.

## 1. Cel i kontekst

### 1.1. Cel

Zbudować **wzorcową aplikację e-commerce**, którą właściciel pokazuje publicznie jako wizytówkę: czysta architektura (NestJS + Next.js + PostgreSQL w monorepo), pełna dokumentacja, działający sklep i działający backpanel, a całość uruchamia się jednym poleceniem w Dockerze.

Sklep jest fikcyjny (marka Taktyl, `docs/01`): nie realizuje zamówień, nie pobiera płatności, nie jest indeksowany. Rdzeń oferty to **kreator setu** (`docs/03`): klawiatura + myszka + podkładka, sprawdzone wymiarami przed zakupem, −10% za komplet.

### 1.2. Dlaczego ta zmiana wobec dokumentacji bazowej

Dokumentacja `docs/01`–`docs/12` opisuje sklep statyczny bez backendu. Właściciel zmienił zakres (ADR-0001): ma być backpanel, w którym zmiana jest widoczna w sklepie, i ma to działać w Dockerze (ADR-0009). Wszystko, czego te ADR-y nie zmieniają, obowiązuje bez zmian: funkcje, tokeny, animacje, zdarzenia pomiaru, kryteria odbioru.

## 2. Problem, wartość, efekt (PWE)

| | Treść |
|---|---|
| **Problem** | Typowe repozytoria „demo sklepu” to albo statyczny front bez backendu, albo CRUD bez dopracowanego sklepu. Trudno z nich ocenić, jak autor projektuje system: granice modułów, spójność danych, dokumentację, dostępność, wydajność, bezpieczeństwo. Dodatkowo publiczne repo łatwo skazić sekretami, cudzymi zasobami i licencjami. |
| **Wartość** | Jedno repozytorium pokazuje cały cykl: dokumentacja → decyzje (ADR) → kontrakt → logika domeny z testami → API → sklep → backpanel → propagacja zmian → testy odbioru w kontenerach. Do tego sklep z realnym problemem (dopasowanie wymiarów) rozwiązanym liczbami, nie przymiotnikami. |
| **Efekt** | Recenzent klonuje repo, wpisuje `docker compose up`, w kilka minut widzi działający sklep i backpanel, zmienia cenę w panelu i widzi ją w sklepie w ≤ 5 s. Każdą decyzję znajduje w ADR, każdy punkt kryteriów w teście. Właściciel może pokazać repo bez obaw o sekrety i licencje. |

## 3. Persony

| Persona | Kim jest | Cel | Co ją zniechęca |
|---|---|---|---|
| **Odwiedzający sklep** (anonim) | osoba oglądająca demo, bez konta | zrozumieć ofertę w 10 s i sprawdzić kreator | pop-upy, nieczytelne ceny, wymuszone logowanie |
| **Klient demo** | osoba przechodząca zakup od kreatora do potwierdzenia | złożyć set, który mieści się na biurku; kupić bez zakładania konta | ukryte koszty dostawy, błędy walidacji bez wskazówki, pułapki klawiaturowe |
| **Właściciel / editor backpanelu** | osoba zarządzająca katalogiem, cenami, stanami, treścią, zamówieniami | zmienić dane i od razu zobaczyć efekt w sklepie; mieć ślad zmian | ręczne przeliczanie „najniższej ceny z 30 dni”, brak historii zmian, utrata danych |
| **Viewer demo** | gość oglądający backpanel w trybie tylko do odczytu | zobaczyć panel bez ryzyka zepsucia danych | konieczność zakładania konta |
| **Recenzent repozytorium** | programista lub rekruter czytający kod | ocenić jakość architektury, testów i dokumentacji | brak instrukcji uruchomienia, sekrety w historii, martwe linki, niedziałający build |

## 4. Zakres

Priorytety jak w `docs/02`: **P0** demo działa od wejścia do potwierdzenia zamówienia, plus backpanel w minimalnym, ale realnym zakresie i propagacja zmian; **P1** pełny sklep i pełny backpanel; **P2** później.

### 4.1. Sklep (storefront): odwołania do `docs/02`

| Priorytet | Zakres | ID |
|---|---|---|
| P0 | Pasek demo, nagłówek, menu mobilne, wyszukiwarka, okruszki, stopka, „Przejdź do treści” | F-001, F-002, F-004, F-005, F-008, F-009, F-245 |
| P0 | Listing z filtrami, stanem w adresie, sortowaniem, „Pokaż więcej” | F-020 do F-027, F-029 |
| P0 | Karta na listingu i karta produktu (warianty, cena, Omnibus, dostępność, termin wysyłki, specyfikacja, GPSR, dane strukturalne) | F-040, F-041, F-044, F-060, F-062 do F-073, F-078 |
| P0 | Kreator setu, reguły dopasowania, podgląd biurka, cena setu, link, gotowe sety | F-100 do F-112 |
| P0 | Koszyk: szuflada, strona, grupy setów, kody, darmowa dostawa, weryfikacja stanów | F-150 do F-157 |
| P0 | Zamówienie, walidacja, NIP, symulacja płatności, potwierdzenie, błąd płatności | F-170 do F-180 |
| P0 | Strony prawne i informacyjne (wzory), 404, baner zgód, toasty, `dataLayer`, `noindex`, sekcje ciemne | F-221 (część P0), F-222, F-240 do F-242, F-244, F-247 |
| P1 | Porównywarka, ulubione, konto demo, zapisane sety | F-130 do F-132, F-114, F-200 do F-203 |
| P1 | Poradnik (4 artykuły), opinie demo, kontakt i newsletter, strony informacyjne (reszta) | F-220, F-076, F-221, F-223 |
| P1 | Menu rozwijane, szybkie dodanie, drugie ujęcie, synonimy, strona wyników, skróty klawiszowe, panel zdarzeń, przejścia siatki, moment „Set kompletny” | F-003, F-042, F-043, F-006, F-007, F-010, F-243, F-030, F-113 |
| P2 | Ciemny motyw, podgląd 3D, powiadomienia o dostępności, faktura, formularz zwrotu, adresy w koncie | F-246, F-079, F-204 do F-206 |

### 4.2. Backpanel i API (nowe, ADR-0001, 0003, 0005, 0006)

Szczegółowa specyfikacja: `docs/15`. Grupy identyfikatorów:

| Grupa | Obszar | Priorytet | Najważniejsze wymagania |
|---|---|---|---|
| B-001 do B-099 | Uwierzytelnianie, role, audyt | P0 | logowanie (argon2id, sesja HttpOnly, CSRF, limit prób), role owner / editor / viewer, wejście viewer w trybie demo, `audit_log` każdej mutacji |
| B-100 do B-199 | Katalog i ceny | P0 | edycja produktów, wariantów, cen, stanów, plakietek; dodawanie i archiwizacja produktów; **historia cen i automatyczne „najniższa cena z 30 dni”** (bez pola ręcznego) |
| B-200 do B-299 | Zamówienia | P0 (lista i szczegóły), P1 (zmiana statusu, eksport) | lista, filtry, szczegóły, statusy zamówienia, widok płatności symulowanej |
| B-300 do B-399 | Treści i strony | P1 | opisy produktów, opinie demo, poradnik, strony prawne wzorcowe, FAQ; edytor ograniczony (bez HTML z zewnątrz) |
| B-400 do B-499 | Ustawienia sklepu | P0 (progi, rabat setu, kody), P1 (metody dostawy, punkty odbioru, etykieta demo) | wartości z `shop.json` edytowalne; walidacja zakresów |
| B-500 do B-599 | Media i zdjęcia | P1 | wgrywanie plików dostarczonych przez człowieka, zmiana `status` w manifeście (`brak` → `gotowe`), kontrola wymiarów wg `docs/09` |
| B-600 do B-699 | Pulpit | P1 | liczby z bazy: zamówienia, przychód demo, produkty z niskim stanem, ostatnie zmiany |
| API (publiczne) | Katalog, wycena koszyka, zamówienia, symulacja płatności | P0 | kontrakt Zod + OpenAPI, idempotencja zamówień, kwoty liczone po stronie serwera (ADR-0002, 0007) |
| Propagacja | `revalidateTag` + webhook HMAC + outbox | P0 | zmiana w backpanelu widoczna w sklepie w ≤ 5 s (ADR-0003) |

### 4.3. Infrastruktura (I-xxx, ADR-0009)

| Priorytet | Zakres |
|---|---|
| P0 | `docker compose up` uruchamia bazę, migracje, seed, API, sklep, backpanel i proxy; profile `dev`, `test`, `demo`; healthchecki; proxy z `X-Robots-Tag: noindex, nofollow`; `.env.example`; Makefile |
| P0 | CI: lint, typy, testy jednostkowe, budowa obrazów, testy odbioru w kontenerze, audyt tokenów, skan sekretów, kontrola ścieżek zakazanych |
| P1 | Lighthouse CI i axe w CI, Dependabot, `pnpm audit`, przypięte digesty obrazów |
| P2 | publiczny hosting demo, monitoring |

### 4.4. Poza zakresem

Prawdziwe płatności i bramki, integracje z przewoźnikami i mapa punktów, wysyłka e-maili, wersje językowe i waluty, konta z hasłami w sklepie, reset hasła klienta, czat i asystent AI, widżety zewnętrzne, treści pod pozycjonowanie, faktury PDF (P2), kalendarz świąt w terminach dostawy (P2), dźwięki. Model nie tworzy grafiki, nie dodaje produktów do `data/*.json` (reguły 1 i 4 `CLAUDE.md`).

## 5. Wymagania niefunkcjonalne

| Obszar | Wymaganie | Źródło |
|---|---|---|
| Wydajność | strony treściowe: pierwszy widok ≤ 800 KB, JS ≤ 150 KB, CSS ≤ 60 KB, LCP ≤ 2,0 s, CLS ≤ 0,05, INP ≤ 200 ms, ≤ 30 żądań; strony z aplikacją (kreator, koszyk, zamówienie): ≤ 1 500 KB, JS ≤ 400 KB, LCP ≤ 2,5 s, CLS ≤ 0,1, ≤ 45 żądań; obce domeny: 0 | `docs/12` §4 |
| Dostępność | WCAG 2.1 AA w sklepie i backpanelu; cele ≥ 44 × 44 px; fokus widoczny; pułapka fokusu w nakładkach; `prefers-reduced-motion` | `docs/06`, `docs/12` §6 |
| System designu | tylko tokeny; ≤ 7 rozmiarów fontu; 1 rodzina; 1 wariant przycisku głównego; 2 promienie; 0 trafień `#hex` i `rgb(` poza plikiem tokenów | `CLAUDE.md` reguła 2, `docs/12` §3 |
| Ruch | tylko katalog A-01…A-18; `transform` i `opacity`; brak bibliotek animacji | `docs/07` |
| Pieniądze i język | grosze (liczby całkowite); `Intl.NumberFormat`, `Intl.PluralRules('pl')`; `Europe/Warsaw` | reguła 7 |
| Dane i prawo | dyrektywa Omnibus liczona z historii cen; GPSR; brak prawdziwych marek, NIP-ów, telefonów; e-maile tylko `@taktyl.example` | `docs/11`, reguły 5 i 10 |
| Bezpieczeństwo | kwoty z klienta nigdy nie są ufane; walidacja Zod na granicy API; ciasteczka `HttpOnly`/`Secure`/`SameSite=Strict`; CSRF; limity żądań (throttler); nagłówki `helmet`/CSP; zero sekretów w repo i w obrazach; webhook podpisany HMAC; zależności skanowane | ADR-0006, 0008 |
| Docker-first | każdy tryb (prod lokalny, dev, test, reset demo) działa w kontenerach; bez lokalnego Node i Postgresa; healthchecki; użytkownik nie-root; wersje obrazów przypięte | ADR-0009 |
| Utrzymanie | strict TypeScript; logika domeny bez I/O i z testami; migracje wersjonowane; seed idempotentny | ADR-0002, 0005 |
| Obserwowalność | logi strukturalne API, `/health`, `audit_log`, tabela `outbox` ze stanem dostarczenia | `docs/14` |
| Publiczne repo | brak plików płatnych (Crafto), brak danych osobowych, e-mail commitów `noreply` | ADR-0004, 0008 |

## 6. Metryki sukcesu

Wszystkie mierzalne w CI lub jednym poleceniem; żadnych założonych liczb użytkowników ani sprzedaży (to demo).

| # | Metryka | Cel | Jak mierzona |
|---|---|---|---|
| M-1 | Uruchomienie od zera | `git clone` → działający stos w ≤ 10 min na czystej maszynie z Dockerem | S31, pomiar w CI |
| M-2 | Scenariusze odbioru | S1 do S36 zielone | Playwright w kontenerze `test` |
| M-3 | Testy logiki domeny | 100% przypadków z `docs/12` §2 zielone | Vitest |
| M-4 | Propagacja zmian | zmiana w backpanelu widoczna w sklepie w ≤ 5 s | S25 |
| M-5 | Budżety wydajności | wszystkie wartości z `docs/12` §4 spełnione na stronach P0 | Lighthouse CI na stosie produkcyjnym |
| M-6 | Dostępność | 0 błędów krytycznych i poważnych axe na stronach P0 i ekranach backpanelu P0 | axe w Playwright |
| M-7 | System designu | audyt `docs/12` §3 w limitach; `#hex` i `rgb(` poza tokenami: 0 | skrypt CI |
| M-8 | Treść | zero trafień testów z `docs/12` §5 (marki, dema szablonu, lorem, proste cudzysłowy) | skrypt CI |
| M-9 | Higiena repo | 0 sekretów (gitleaks, cała historia), 0 śledzonych ścieżek zakazanych | CI + `taktyl-straznik-repo` |
| M-10 | Pokrycie dokumentacją | każda funkcja z ID ma wpis w `docs/12` lub w teście; każdy ADR ma status | przegląd przed M7 |
| M-11 | Spójność ID | każdy commit i każdy komentarz nad kodem realizującym funkcję zawiera F-/A-/B-/I- | kontrola w CI (komentarz commita) |

## 7. Założenia

1. Właściciel ma zainstalowany Docker z Compose v2 i konto GitHub; zdjęcia (76 plików P0) dostarczy człowiek, do tego czasu placeholdery (Q-06).
2. Właściciel posiada licencję Crafto i trzyma szablon lokalnie w `vendor/crafto/`; publiczne repo go nie zawiera (Q-01).
3. Treści (opisy, opinie demo, poradniki, wzory prawne, FAQ) pisze model z atrybutów i zgodnie z `docs/01` §4; człowiek zatwierdza (D-003).
4. Dane początkowe w `data/*.json` są kompletne i zgodne z `docs/04`; zmiany robi się w `data/_generator.py`.
5. Publiczne demo działa lokalnie z Dockera; hosting online jest decyzją późniejszą (Q-05).
6. Hasło w backpanelu, poza sklepem, jest akceptowalne (Q-02).

## 8. Ryzyka i mitygacja

| # | Ryzyko | Prawdop. | Skutek | Mitygacja |
|---|---|---|---|---|
| R-1 | Publikacja plików Crafto narusza licencję | średnie | wysoki | `html/`, `vendor/` w `.gitignore`, kontrola ścieżek w CI, publiczny kod bazuje na własnych komponentach i tokenach (bez Bootstrapa), README z informacją (ADR-0004, Q-01) |
| R-2 | Sekret lub dane osobowe w historii git | niskie | wysoki | gitleaks w pre-commit i CI, skan całej historii przed pierwszym pushem, `.env.example`, e-mail `noreply`, skill `taktyl-straznik-repo` |
| R-3 | Publiczne demo zostaje zepsute przez obcych | średnie | średni | `DEMO_MODE`: rola viewer bez zapisu, limity żądań, cykliczny `db:reset-demo`, demo tylko lokalnie na start (ADR-0006, Q-05) |
| R-4 | Rozjazd logiki sklep ↔ API | średnie | wysoki | wspólny pakiet `domain`, API przelicza wszystko po swojej stronie, testy z `docs/12` §2 uruchamiane po obu stronach |
| R-5 | Przekroczenie budżetu JS przy Next.js | średnie | średni | RSC i wyspy kliencie, kreator i koszyk ładowane tylko na swoich stronach, Lighthouse CI blokuje PR |
| R-6 | Opóźnienie propagacji (webhook nie dochodzi) | niskie | średni | outbox z ponowieniami, `revalidate: 300` jako siatka, test S25 |
| R-7 | Pełzanie zakresu (backend rozrasta się poza demo) | wysokie | średni | zakres P0/P1/P2 w tym PRD, „poza zakresem” w §4.4, zmiany tylko przez ADR i `docs/decyzje.md` |
| R-8 | Brak zdjęć opóźnia „efekt wow” | wysokie | niski | placeholdery w prawdziwych wymiarach, kreator działa bez zdjęć (`docs/09`) |
| R-9 | Treści wygenerowane łamią reguły (marki, wymyślone parametry, nadużycie opinii) | średnie | średni | skill `taktyl-audyt-tresci`, opisy tylko z atrybutów, brak `aggregateRating`, etykieta „Opinie przykładowe” |
| R-10 | Dwa miejsca prawdy o danych (JSON i baza) mylą recenzenta | średnie | niski | ADR-0005 i tabela „co wolno” w README i `docs/17` |

## 9. Kamienie milowe

Szczegóły, zadania i kryteria odbioru: `docs/21`.

| M | Nazwa | Rezultat do pokazania |
|---|---|---|
| M0 | Fundament: repo, Docker, CI | `docker compose up` startuje pustą aplikację, CI zielone, higiena repo wdrożona |
| M1 | Domena, API, seed | testy domeny zielone; API zwraca katalog z seedu; wycena i zamówienie przez API |
| M2 | Sklep P0: katalog | listing, karta produktu, wyszukiwarka, strony informacyjne (S1 do S8, S22, S23) |
| M3 | Kreator setu | S9 do S11, S21; strona główna z gotowymi setami |
| M4 | Koszyk, zamówienie, pomiar | S12 do S20, S24; pełna ścieżka zakupu |
| M5 | Backpanel P0 i propagacja | S25 do S30; edycja ceny widoczna w sklepie |
| M6 | P1 | porównywarka, ulubione, konto demo, poradnik, opinie, pełny backpanel, pulpit |
| M7 | Hardening i publikacja | audyty, testy odbioru S1 do S36, README, publikacja i tag `v1.0.0` |

## 10. Otwarte pytania

Pełna lista z propozycjami odpowiedzi: `docs/decyzje.md`.

| ID | Temat | Wpływ na plan |
|---|---|---|
| Q-01 | Publikacja tylko kodu własnego, Crafto lokalnie | blokuje M7 (publikacja) i sposób budowy komponentów w M2 |
| Q-02 | Hasło w backpanelu mimo F-200 | blokuje B-001 do B-099 |
| Q-03 | Nazwa repozytorium na GitHubie | blokuje publikację |
| Q-04 | Licencja kodu własnego | blokuje publikację |
| Q-05 | Backpanel online czy tylko lokalnie | wpływa na I-xxx (hosting) i tryb demo |
| Q-06 | Termin dostarczenia zdjęć P0 | wpływa na efekt wizualny M3 i M7 |

## 11. Definicja ukończenia produktu

Produkt jest gotowy, gdy: (1) przechodzą wszystkie scenariusze S1 do S36 z `docs/12`; (2) testy jednostkowe, audyt designu, budżet wydajności, dostępność i treść z `docs/12` §2 do §6 mieszczą się w limitach; (3) `docker compose up` działa od zera na czystej maszynie; (4) repo przeszło kontrolę `taktyl-straznik-repo`, ma README, LICENSE i SECURITY.md; (5) `docs/decyzje.md` zawiera każdą decyzję spoza dokumentacji i każdy brak (ikona, zdjęcie).
