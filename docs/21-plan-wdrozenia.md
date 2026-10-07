# 21 · Plan wdrożenia

Plan realizuje PRD (`docs/13`). Każdy kamień milowy to **epic** w task-managerze (projekt `taktyl`), każdy wiersz tabeli to **issue**. Tabele są wczytywane 1:1, więc: tytuły zaczynają się od czasownika, są unikalne, bez em-dash (tylko zwykły myślnik), a zależności wskazują tytuł zadania blokującego.

## Konwencje

- **Typ:** TASK, BUG, IMPROVEMENT. **Priorytet:** HIGH, MEDIUM, LOW (CRITICAL tylko dla awarii).
- **Tagi:** `m0`…`m7` (kamień milowy), obszar (`infra`, `domena`, `api`, `sklep`, `backpanel`, `design`, `tresci`, `qa`, `repo`), ID funkcji w nawiasie w tytule lub kryteriach (reguła 8 `CLAUDE.md`).
- **Zależności:** „Blokowane przez” = zadanie nie startuje, dopóki wskazane nie jest DONE. Kolumna „Blokuje” jest informacyjna (wynika z odwrotności).
- **Agent:** odpowiedzialny specjalista z `docs/20`: taktyl-architekt, taktyl-api, taktyl-sklep, taktyl-backpanel, taktyl-design-system, taktyl-domena, taktyl-tresci, taktyl-qa, taktyl-straznik-repo, taktyl-devops.
- Grupy ID backpanelu: B-001…B-099 auth/role/audyt, B-100… katalog i ceny, B-200… zamówienia, B-300… treści, B-400… ustawienia, B-500… media, B-600… pulpit. Infrastruktura: I-xxx.
- Definition of Done każdego zadania: `CLAUDE.md` (kryteria z `docs/12` dla zadania, klawiatura, 360 px, tokeny, brak treści z dema szablonu) plus uruchomienie w kontenerze (ADR-0009).
- Każde zadanie kodowe kończy się aktualizacją statystyk w task-managerze (commit i liczba linii).

---

## M0 · Fundament: repo, Docker, CI

**Epic:** M0 Fundament repo, Docker i CI · **Rezultat:** `docker compose up` startuje szkielet, CI zielone, higiena repo wdrożona (I-xxx).

| Tytuł | Typ | Priorytet | Tagi | Kryteria odbioru | Blokowane przez | Agent |
|---|---|---|---|---|---|---|
| Założyć szkielet monorepo pnpm i Turborepo | TASK | HIGH | m0, infra | Workspace z `apps/api`, `apps/web`, `apps/admin`, `packages/domain`, `packages/contracts`, `packages/tokens`; TypeScript strict; wspólny `tsconfig` i ESLint; `turbo run build` przechodzi na pustych pakietach (I-001) | - | taktyl-architekt |
| Przygotować pliki higieny repo | TASK | HIGH | m0, repo | `.gitignore` (m.in. `html/`, `vendor/`, `.env*`, `.idea/`, `*.sql`, `*.dump`), `.env.example` z placeholderami, `LICENSE` (MIT, Q-04), `SECURITY.md`, `CONTRIBUTING.md`; brak sekretów i prawdziwych adresów (I-002) | - | taktyl-straznik-repo |
| Napisać Dockerfile wielostopniowe dla api, web i admin | TASK | HIGH | m0, infra | Trzy obrazy: build wielostopniowy, finalny bez narzędzi budowania, użytkownik nie-root, Next.js `standalone`, wersje bazowe przypięte; `docker build` przechodzi dla każdego (I-003) | Założyć szkielet monorepo pnpm i Turborepo | taktyl-devops |
| Skonfigurować docker-compose z profilami | TASK | HIGH | m0, infra | Usługi `db`, `migrate`, `seed`, `api`, `web`, `admin`, `proxy`; profile `dev`, `test`, `demo`; healthchecki i `depends_on: service_healthy`; `docker compose up --build` kończy się stanem healthy (I-004) | Napisać Dockerfile wielostopniowe dla api, web i admin | taktyl-devops |
| Skonfigurować proxy Caddy z nagłówkiem noindex | TASK | MEDIUM | m0, infra | Hosty `taktyl.localhost`, `admin.taktyl.localhost`, `api.taktyl.localhost`; `X-Robots-Tag: noindex, nofollow` na każdej odpowiedzi; `curl -I` to potwierdza (F-244, I-005) | Skonfigurować docker-compose z profilami | taktyl-devops |
| Dodać Makefile ze skrótami Dockera | TASK | LOW | m0, infra | `make up`, `make dev`, `make test`, `make reset`, `make logs` działają i są opisane w README (I-006) | Skonfigurować docker-compose z profilami | taktyl-devops |
| Skonfigurować CI w GitHub Actions | TASK | HIGH | m0, infra, repo | Workflow: lint, typy, testy jednostkowe, budowa obrazów z cache, uruchomienie stosu testowego; PR blokowany przy czerwonym (I-007) | Skonfigurować docker-compose z profilami | taktyl-devops |
| Dodać skan sekretów i kontrolę ścieżek zakazanych | TASK | HIGH | m0, repo | gitleaks w pre-commit i CI (cała historia); job kończy się błędem, gdy śledzona jest ścieżka `html/`, `vendor/`, `*.zip`, `.env*` (poza `.env.example`) lub wzorzec prywatnego adresu e-mail; test negatywny z próbnym plikiem (ADR-0004, ADR-0008, I-008) | Skonfigurować CI w GitHub Actions | taktyl-straznik-repo |
| Przenieść tokeny i fonty do packages/tokens | TASK | HIGH | m0, design | `assets/tokens.css` skopiowany bez zmian, font Archivo z licencją OFL, `taktyl.css` pusty szkielet; skrypt CI: `#[0-9a-fA-F]{3,8}` i `rgb(` poza plikiem tokenów daje 0 trafień (reguła 2) | Założyć szkielet monorepo pnpm i Turborepo | taktyl-design-system |
| Opisać architekturę i granice modułów | TASK | MEDIUM | m0, docs | `docs/14` i `docs/17` zawierają topologię kontenerów, moduły Nest, tabelę znaczników propagacji (ADR-0003) i schemat danych; każdy ADR ma status | Założyć szkielet monorepo pnpm i Turborepo | taktyl-architekt |

---

## M1 · Domena, API, seed

**Epic:** M1 Domena, API i seed · **Rezultat:** testy domeny zielone, API serwuje katalog z seedu, wycena i zamówienie przez API.

| Tytuł | Typ | Priorytet | Tagi | Kryteria odbioru | Blokowane przez | Agent |
|---|---|---|---|---|---|---|
| Zaimplementować pieniądze i formatowanie w packages/domain | TASK | HIGH | m1, domena | Grosze jako liczby całkowite (`Math.round(zł·100)` raz przy wczytaniu), `Intl.NumberFormat('pl-PL')`, `Intl.PluralRules('pl')`; testy: 1203.3 → „1203,30 zł”, 12999 → „12 999,00 zł”, 26000 DPI → „26 000 DPI”, odmiana 0/1/2/5/12/22/112 (`docs/12` §2) | Założyć szkielet monorepo pnpm i Turborepo | taktyl-domena |
| Zaimplementować wycenę setu i rozbicie rabatu | TASK | HIGH | m1, domena | 4 sety z `presets.json` zgodne co do grosza (1337,00→1203,30; 887,00→798,30; 1007,00→906,30; 857,00→771,30); suma rozbicia = rabat; reszta groszy na ostatnią pozycję (F-107, F-110) | Zaimplementować pieniądze i formatowanie w packages/domain | taktyl-domena |
| Zaimplementować reguły dopasowania z rules.json | TASK | HIGH | m1, domena | 6 przykładów kontrolnych z `docs/03` §4.4 wychodzi dokładnie; propozycje zmian w kolejności z §4.3; reguła bez wymaganych elementów nie jest zwracana (F-104, F-105) | Zaimplementować pieniądze i formatowanie w packages/domain | taktyl-domena |
| Zaimplementować termin wysyłki, NIP i normalizację wyszukiwania | TASK | HIGH | m1, domena | Środa 7.10.2026 13:00 → wysyłka dziś, kurier czwartek 8.10; 15:00 → dostawa piątek 9.10; sobota 10.10 → wysyłka poniedziałek 12.10; NIP: sumy kontrolne, poprawne numery generowane w teście; „lupek” znajduje „Łupek” (`docs/12` §2, F-065, F-173, F-005) | Zaimplementować pieniądze i formatowanie w packages/domain | taktyl-domena |
| Zaimplementować silnik filtrów, facetów i sortowania | TASK | HIGH | m1, domena | Typy `multi`, `range`, `bool`, `buckets`, `number-match`; LUB w obrębie filtra, I między filtrami; liczniki z uwzględnieniem pozostałych filtrów; sortowania z `docs/04` §6; wyniki S1 do S4 odtworzone na danych z seedu (F-021, F-024) | Zaimplementować pieniądze i formatowanie w packages/domain | taktyl-domena |
| Zdefiniować schematy Zod i kontrakt API w packages/contracts | TASK | HIGH | m1, api | Schematy DTO dla katalogu, wyceny, zamówienia, płatności, backpanelu; typy eksportowane do `web` i `admin`; jedna definicja używana przez walidację API i OpenAPI | Założyć szkielet monorepo pnpm i Turborepo | taktyl-architekt |
| Zaprojektować schemat Prisma i migracje | TASK | HIGH | m1, api | Encje z `docs/17`: produkt, wariant, cena, historia cen, kategoria, zamówienie, pozycja, ustawienia, użytkownik, `audit_log`, `outbox`; migracja uruchamia się w kontenerze `migrate` | Zdefiniować schematy Zod i kontrakt API w packages/contracts | taktyl-api |
| Napisać seed z data/*.json wraz z historią cen | TASK | HIGH | m1, api | Idempotentny; 18 produktów, 99 wariantów, 4 sety; Granit TKL: najniższa z 30 dni 699 zł, Wróbel 139 zł; stany pokazowe (`K-BZL75-KOB-SZP` i `P-LOD-L-MGL` brak, `K-KRD98-GRF-TRZ` 3 szt., `M-JRZ-MGL` 2 szt.); model niczego nie dopisuje do danych (ADR-0005) | Zaprojektować schemat Prisma i migracje | taktyl-api |
| Zaimplementować API katalogu i wyszukiwania | TASK | HIGH | m1, api | Endpointy kategorii, listingu z filtrami i stanem z adresu, produktu po slugu, wyszukiwarki; promocja i „najniższa z 30 dni” liczone z historii; odpowiedzi zgodne z kontraktem Zod (F-020 do F-029, F-064) | Napisać seed z data/*.json wraz z historią cen; Zaimplementować silnik filtrów, facetów i sortowania | taktyl-api |
| Zaimplementować API wyceny koszyka | TASK | HIGH | m1, api | `POST /cart/quote` bez cache: ceny, rabat setu, kod rabatowy (`TAKTYL10` nie obejmuje setów), próg darmowej dostawy, lista wariantów bez stanu; kwoty z klienta ignorowane (F-152 do F-157) | Zaimplementować wycenę setu i rozbicie rabatu; Napisać seed z data/*.json wraz z historią cen | taktyl-api |
| Zaimplementować API zamówień i symulacji płatności | TASK | HIGH | m1, api | `POST /orders` z `Idempotency-Key`, numer `TK-RRMMDD-XXXX` (Europe/Warsaw), walidacja pól zależnych od dostawy, NIP; symulacja `paid`/`failed`; stan magazynu zmniejszany przy `paid` w transakcji z blokadą; brak pól na dane kart (F-170 do F-180) | Zaimplementować API wyceny koszyka | taktyl-api |
| Wystawić OpenAPI, healthchecki i limity żądań | TASK | MEDIUM | m1, api | `/health` i `/ready`, dokument OpenAPI generowany z DTO, `helmet`, throttler, CORS ograniczony do hostów z `.env`, logi strukturalne | Zaimplementować API katalogu i wyszukiwania | taktyl-api |

---

## M2 · Sklep P0: katalog

**Epic:** M2 Sklep P0 katalog · **Rezultat:** listing, karta produktu, wyszukiwarka, strony informacyjne (S1 do S8, S22, S23).

| Tytuł | Typ | Priorytet | Tagi | Kryteria odbioru | Blokowane przez | Agent |
|---|---|---|---|---|---|---|
| Zbudować układ bazowy sklepu | TASK | HIGH | m2, sklep | Pasek demo zamykany na sesję, nagłówek przyklejony z licznikiem koszyka, menu mobilne z pułapką fokusu, stopka 4-kolumnowa bez logotypów, „Przejdź do treści”, `noindex` w meta; działa na 360 px i z klawiatury (F-001, F-002, F-004, F-009, F-244, F-245) | Przenieść tokeny i fonty do packages/tokens; Wystawić OpenAPI, healthchecki i limity żądań | taktyl-sklep |
| Zbudować komponenty podstawowe z tokenów | TASK | HIGH | m2, design | Przycisk główny i poboczny (A-01 z obsługą Enter/Spacji), próbka koloru, kafel wyboru, żeton filtra, plakietka, pole formularza, komunikat, tabela specyfikacji; stany spoczynek/najechanie/fokus/wciśnięcie/nieaktywny/błąd; audyt `docs/12` §3 w limitach | Przenieść tokeny i fonty do packages/tokens | taktyl-design-system |
| Zbudować wspólny moduł nakładek | TASK | HIGH | m2, design, sklep | Szuflada, okno, menu: pułapka fokusu, Esc, powrót fokusu, `100dvh`, `[hidden]{display:none !important}`, A-12; brak `alert()`/`confirm()` (F-241, pułapki 11, 12, 27, 29) | Zbudować komponenty podstawowe z tokenów | taktyl-design-system |
| Zbudować komponent obrazu z placeholderami | TASK | HIGH | m2, sklep | Odczyt manifestu: `gotowe` → zdjęcie z `srcset`, `brak` → placeholder w tych samych wymiarach i proporcjach (packshot, topdown, texture); `width`/`height`/`alt` zawsze; zero grafiki rysowanej (reguła 1, `docs/09`) | Zbudować komponenty podstawowe z tokenów | taktyl-sklep |
| Zbudować listing kategorii z filtrami | TASK | HIGH | m2, sklep | `/klawiatury`, `/myszki`, `/podkladki`: filtry z `facets.json`, stan w adresie, żetony, „Pokaż więcej” po 12, szuflada filtrów na telefonie z licznikiem, pusty wynik z propozycjami; S1 do S4 przechodzą (F-020 do F-027, F-029, F-040, F-041, F-044) | Zaimplementować API katalogu i wyszukiwania; Zbudować komponent obrazu z placeholderami; Zbudować układ bazowy sklepu | taktyl-sklep |
| Zbudować kartę produktu | TASK | HIGH | m2, sklep | Galeria, wybór wariantu (adres `?sku=`), cena z Omnibusem (przekreślona `lowest_30d`, nie `regular_price`), dostępność i termin wysyłki, ilość, specyfikacja, „W zestawie”, GPSR, dostawa i zwroty, dane strukturalne `Product` bez `aggregateRating`, przyklejony pasek zakupu na telefonie; S5 do S8 (F-060 do F-073, F-078) | Zbudować listing kategorii z filtrami | taktyl-sklep |
| Zbudować wyszukiwarkę z podpowiedziami | TASK | MEDIUM | m2, sklep | Podpowiedzi po 2 znakach, strzałki i Enter, odporność na brak polskich znaków; S22: „lupek”, „lod”, „pustulka”, „tkl” (F-005) | Zbudować układ bazowy sklepu; Zaimplementować API katalogu i wyszukiwania | taktyl-sklep |
| Napisać opisy produktów do descriptions.json | TASK | HIGH | m2, tresci | 18 opisów po 60 do 120 słów, 2 do 3 akapity, wyłącznie z atrybutów i `short`, zero zakazanych słów, porównania tylko do produktów Taktyl; tekst zgodny z `docs/01` §4 (twarde spacje, cudzysłowy „…”) (`docs/04` §7) | - | taktyl-tresci |
| Napisać strony prawne i informacyjne P0 jako wzory | TASK | MEDIUM | m2, tresci | Dostawa i płatności, Zwroty i reklamacje (14 dni ustawowo i 30 w Taktylu, „niezgodność towaru z umową”, wzór odstąpienia), Regulamin, Polityka prywatności, Cookies; baner „Wzór treści dla sklepu demonstracyjnego Taktyl. Nie stanowi oferty.”; bez NIP/REGON/KRS/BDO, bez ODR (`docs/11` §1.3) | - | taktyl-tresci |
| Zbudować strony informacyjne i 404 | TASK | MEDIUM | m2, sklep | Strony z treścią wzorcową, spis treści w dłuższych, strona 404 z wyszukiwarką i trzema kategoriami oraz kodem 404; S23 (F-221, F-222) | Napisać strony prawne i informacyjne P0 jako wzory; Zbudować wyszukiwarkę z podpowiedziami | taktyl-sklep |

---

## M3 · Kreator setu

**Epic:** M3 Kreator setu · **Rezultat:** S9 do S11, S21; strona główna z gotowymi setami.

| Tytuł | Typ | Priorytet | Tagi | Kryteria odbioru | Blokowane przez | Agent |
|---|---|---|---|---|---|---|
| Zbudować podgląd biurka DeskStage | TASK | HIGH | m3, sklep, design | Płótno 1 px = 1 mm skalowane `transform: scale(s)`, rezerwacja wysokości (CLS 0), trzy układy z `docs/03` §5.1, placeholdery z podpisem tylko gdy ≥ 80 px, `role="img"` z `aria-label` składanym z danych; proporcje zgodne z mm z danych (F-106) | Zbudować komponent obrazu z placeholderami; Zaimplementować reguły dopasowania z rules.json | taktyl-sklep |
| Zbudować kroki kreatora setu | TASK | HIGH | m3, sklep | `/zbuduj-set`: kroki 0 do 4 jako `<ol>` z `aria-current="step"`, kafle radio, wybór wariantu z domyślnym przełącznikiem profilu, wyniki reguł na żywo, propozycje jednym kliknięciem, układ komputer i telefon z dolnym paskiem; kreator nigdy nie blokuje (F-100 do F-105, F-107) | Zbudować podgląd biurka DeskStage; Zaimplementować wycenę setu i rozbicie rabatu; Zbudować listing kategorii z filtrami | taktyl-sklep |
| Zaimplementować stan i adres kreatora | TASK | HIGH | m3, sklep | `?profil=&dlon=&k=&m=&p=&krok=`, `replaceState` dla wyboru, `pushState` dla kroku, `taktyl.set.v1` w `try/catch`, link „Kopiuj link do setu” z zapasem w polu; nieznany SKU pomijany z komunikatem; S21 (F-108, F-109, F-111, F-112) | Zbudować kroki kreatora setu | taktyl-sklep |
| Zaimplementować animacje kreatora i pierwszego ekranu | TASK | MEDIUM | m3, design | A-02, A-04, A-05, A-06, A-07, A-08, A-16 zgodnie z katalogiem; tylko `transform` i `opacity`; `prefers-reduced-motion` pokazuje stany końcowe; brak „Layout” w nagraniu Performance (`docs/07`) | Zbudować kroki kreatora setu | taktyl-design-system |
| Zbudować stronę główną | TASK | HIGH | m3, sklep | Sekcje 1 do 7 i 10 z `docs/05` §2: pierwszy ekran z H1, przyciskami, paskiem warunków i DeskStage „Programista”, kafle kategorii z liczbami z danych, „Jak działa set” (sekcja ciemna), gotowe sety z cenami z API, polecane; bez karuzeli i opinii (F-247) | Zbudować podgląd biurka DeskStage; Zbudować kroki kreatora setu | taktyl-sklep |
| Zbudować blok Dokończ set | TASK | MEDIUM | m3, sklep | Sekcja ciemna na karcie produktu: trzy elementy dobrane wg `fit`, cena setu z rabatem, „Otwórz w kreatorze” i „Dodaj set do koszyka” (F-069) | Zbudować kroki kreatora setu; Zbudować kartę produktu | taktyl-sklep |

---

## M4 · Koszyk, zamówienie, pomiar

**Epic:** M4 Koszyk, zamówienie i pomiar · **Rezultat:** S12 do S20, S24; pełna ścieżka zakupu.

| Tytuł | Typ | Priorytet | Tagi | Kryteria odbioru | Blokowane przez | Agent |
|---|---|---|---|---|---|---|
| Zbudować moduł koszyka i szufladę | TASK | HIGH | m4, sklep | `taktyl.cart.v1` w `try/catch` z zapasem w pamięci, bez cen w koszyku, grupy setów, A-03, pułapka fokusu; wycena z `POST /cart/quote`; S12 (F-150, F-154, F-157) | Zaimplementować API wyceny koszyka; Zbudować wspólny moduł nakładek; Zbudować kroki kreatora setu | taktyl-sklep |
| Zbudować stronę koszyka | TASK | HIGH | m4, sklep | `/koszyk`: ilość, usuwanie z „Cofnij” w komunikacie (5 s), pasek darmowej dostawy (A-11), kod rabatowy z podpowiedzią, rozbicie setu z komunikatem; S13 do S16 (F-151 do F-156) | Zbudować moduł koszyka i szufladę | taktyl-sklep |
| Zbudować stronę zamówienia | TASK | HIGH | m4, sklep | `/zamowienie`: Kontakt, Dostawa, Faktura, Płatność, Zgody (nic zaznaczone z góry); pola zależne od metody; lista automatów z wyszukiwaniem po mieście; walidacja przy opuszczeniu pola i przy wysłaniu, fokus na pierwszy błąd; etykieta demo i „Zamawiam i płacę”; S17, S18 (F-170 do F-176) | Zbudować stronę koszyka; Zaimplementować API zamówień i symulacji płatności | taktyl-sklep |
| Zbudować symulację płatności i strony statusów | TASK | HIGH | m4, sklep | `/zamowienie/platnosc`, `/potwierdzenie`, `/blad-platnosci`: przyciski „Symuluj udaną/odrzuconą płatność”, zero pól na dane kart i kody BLIK, koszyk czyszczony tylko po `paid`; S19 (F-177 do F-180) | Zbudować stronę zamówienia | taktyl-sklep |
| Zaimplementować warstwę pomiaru i baner zgód | TASK | HIGH | m4, sklep | `track.ts` jako jedyne źródło zdarzeń, nazwy i parametry z `docs/10` bez zmian, tryb zgody domyślnie `denied`, `purchase` raz na `transaction_id` (`taktyl.tracked.v1`), wartości jako liczby, zero danych osobowych; baner z równorzędnymi przyciskami; S20, S24 (F-240, F-242) | Zbudować układ bazowy sklepu | taktyl-sklep |
| Napisać testy e2e scenariuszy S1 do S24 | TASK | HIGH | m4, qa | Playwright w kontenerze `test`, start od `db:reset-demo`, każdy scenariusz z `docs/12` §1 jako osobny test, wartości z seedu; raport w CI | Zbudować symulację płatności i strony statusów; Zaimplementować warstwę pomiaru i baner zgód; Zbudować kartę produktu | taktyl-qa |

---

## M5 · Backpanel P0 i propagacja

**Epic:** M5 Backpanel P0 i propagacja · **Rezultat:** S25 do S30; edycja ceny widoczna w sklepie w ≤ 5 s.

| Tytuł | Typ | Priorytet | Tagi | Kryteria odbioru | Blokowane przez | Agent |
|---|---|---|---|---|---|---|
| Zaimplementować uwierzytelnianie, role i audit_log | TASK | HIGH | m5, api | B-001 do B-099: argon2id, sesja `HttpOnly`/`Secure`/`SameSite=Strict`, CSRF, limit prób, role owner/editor/viewer, konto z `ADMIN_BOOTSTRAP_*` z `.env`, wejście viewer przy `DEMO_MODE`, każda mutacja zapisana w `audit_log` (kto, co, przed, po) (ADR-0006) | Wystawić OpenAPI, healthchecki i limity żądań | taktyl-api |
| Zaimplementować RevalidationService i outbox | TASK | HIGH | m5, api, sklep | Po commicie transakcji API wylicza znaczniki (tabela w `docs/14` §6) i woła `POST /api/revalidate` z podpisem HMAC; porażka trafia do `outbox` z ponowieniem; `revalidate: 300` jako siatka; sekret tylko w `.env` (ADR-0003) | Zaimplementować API katalogu i wyszukiwania; Zbudować kartę produktu | taktyl-api |
| Zaimplementować API katalogu i cen w backpanelu | TASK | HIGH | m5, api | B-100 do B-199: edycja produktów, wariantów, stanów, plakietek, dodawanie i archiwizacja; zmiana ceny dopisuje wiersz do `price_history`; „najniższa z 30 dni” liczona automatycznie; brak pola ręcznego; walidacja Zod | Zaimplementować uwierzytelnianie, role i audit_log; Zaimplementować RevalidationService i outbox | taktyl-api |
| Zaimplementować API zamówień w backpanelu | TASK | MEDIUM | m5, api | B-200 do B-299: lista z filtrami i stronicowaniem, szczegóły z pozycjami i płatnością symulowaną, zmiana statusu z walidacją przejść | Zaimplementować uwierzytelnianie, role i audit_log; Zaimplementować API zamówień i symulacji płatności | taktyl-api |
| Zaimplementować API ustawień sklepu | TASK | MEDIUM | m5, api | B-400 do B-499: próg darmowej dostawy, rabat setu, kody rabatowe z `shop.json`; walidacja zakresów; zmiana przepuszcza się przez znacznik `shop-settings` | Zaimplementować uwierzytelnianie, role i audit_log; Zaimplementować RevalidationService i outbox | taktyl-api |
| Zbudować szkielet backpanelu | TASK | HIGH | m5, backpanel, design | `apps/admin`: logowanie, układ z nawigacją, Radix UI bez stylu ostylowany tokenami, TanStack Query/Table, React Hook Form; ikony tylko z fontu szablonu; WCAG 2.1 AA; D-002 | Zaimplementować uwierzytelnianie, role i audit_log; Zbudować komponenty podstawowe z tokenów | taktyl-backpanel |
| Zbudować ekrany katalogu i cen w backpanelu | TASK | HIGH | m5, backpanel | B-100 do B-199: lista i edycja produktu, tabela wariantów, edycja ceny ze wskazaniem „najniższa z 30 dni” (tylko odczyt) i historią, stan magazynu, plakietki; błędy walidacji przy polu | Zbudować szkielet backpanelu; Zaimplementować API katalogu i cen w backpanelu | taktyl-backpanel |
| Zbudować ekran zamówień w backpanelu | TASK | MEDIUM | m5, backpanel | B-200 do B-299: lista z filtrami, szczegóły, zmiana statusu; zamówienie złożone w sklepie widoczne na liście | Zbudować szkielet backpanelu; Zaimplementować API zamówień w backpanelu | taktyl-backpanel |
| Zbudować ekran ustawień sklepu w backpanelu | TASK | MEDIUM | m5, backpanel | B-400 do B-499: formularz progów, rabatu setu i kodów; rola viewer widzi pola nieaktywne | Zbudować szkielet backpanelu; Zaimplementować API ustawień sklepu | taktyl-backpanel |
| Napisać testy e2e backpanelu i propagacji | TASK | HIGH | m5, qa | S25 do S30 w Playwright: zmiana ceny Wróbla widoczna na `/myszki/wrobel` w ≤ 5 s i `lowest_30d` z historii, zamówienie w panelu, stan 0 blokuje dodanie, viewer bez zapisu, wpis w `audit_log`, webhook z błędnym podpisem odrzucony | Zbudować ekrany katalogu i cen w backpanelu; Zbudować ekran zamówień w backpanelu; Napisać testy e2e scenariuszy S1 do S24 | taktyl-qa |

---

## M6 · P1

**Epic:** M6 Sklep P1 i pełny backpanel · **Rezultat:** porównywarka, ulubione, konto demo, poradnik, opinie, pełny backpanel, pulpit.

| Tytuł | Typ | Priorytet | Tagi | Kryteria odbioru | Blokowane przez | Agent |
|---|---|---|---|---|---|---|
| Zbudować porównywarkę i ulubione | TASK | MEDIUM | m6, sklep | Do 4 produktów jednej kategorii, pasek „Porównaj”, „Pokaż tylko różnice”, przyklejona kolumna nazw na telefonie, `/ulubione` ze spójnym stanem serduszka, A-10 (F-130 do F-132, F-045) | Zbudować listing kategorii z filtrami; Zbudować moduł koszyka i szufladę | taktyl-sklep |
| Zbudować konto demo i zapisane sety | TASK | MEDIUM | m6, sklep, api | „Zaloguj jako użytkownika demo” bez hasła, `/konto`, zamówienia powiązane z `order_token`, `/konto/sety` (maks. 10), „Zapisz set” (F-114, F-200 do F-203) | Zbudować symulację płatności i strony statusów; Zbudować kroki kreatora setu | taktyl-sklep |
| Napisać poradnik i opinie demonstracyjne | TASK | MEDIUM | m6, tresci | 4 artykuły po 600 do 900 słów z wejściem do kreatora z profilem; `reviews.json` 3 do 6 opinii na produkt z ocenami 3 do 5, każda o konkretnym atrybucie; etykieta opinii z `docs/04` §8; bez oznaczania w danych strukturalnych (F-220, F-076, `docs/04` §8) | Napisać opisy produktów do descriptions.json | taktyl-tresci |
| Zbudować poradnik, opinie i strony informacyjne P1 | TASK | MEDIUM | m6, sklep | `/poradnik`, `/poradnik/{slug}`, sekcja opinii z średnią i liczbą, O sklepie, Kontakt z `generate_lead`, FAQ, Zużyty sprzęt, newsletter (F-220, F-076, F-221, F-223) | Napisać poradnik i opinie demonstracyjne | taktyl-sklep |
| Zbudować szybkie dodanie, menu, synonimy i skróty | TASK | LOW | m6, sklep | Menu kategorii ze skrótami filtrów, „Szybko dodaj” z A-09 i A-18 dostępny na dotyku i z klawiatury, synonimy, `/szukaj`, skróty `/`, `Esc`, `?` z przełącznikiem, A-14 (F-003, F-006, F-007, F-010, F-030, F-042, F-043) | Zbudować kartę produktu; Zbudować wyszukiwarkę z podpowiedziami | taktyl-sklep |
| Zbudować panel podglądu zdarzeń | TASK | LOW | m6, sklep | `?pomiar=1`: wysuwany panel nasłuchujący `taktyl:track`, JSON, „Wyczyść”, „Kopiuj jako JSON”, bez wpływu na układ (F-243) | Zaimplementować warstwę pomiaru i baner zgód | taktyl-sklep |
| Zaimplementować API treści i opinii w backpanelu | TASK | MEDIUM | m6, api | B-300 do B-399: edycja opisów, opinii demo, poradników, stron prawnych i FAQ; sanityzacja treści; znaczniki propagacji dla stron | Zaimplementować API katalogu i cen w backpanelu | taktyl-api |
| Zbudować ekrany treści w backpanelu | TASK | MEDIUM | m6, backpanel | B-300 do B-399: edytor ograniczony (bez HTML z zewnątrz), podgląd, zapis widoczny w sklepie w ≤ 5 s | Zaimplementować API treści i opinii w backpanelu; Zbudować szkielet backpanelu | taktyl-backpanel |
| Zaimplementować media i manifest zdjęć | TASK | MEDIUM | m6, api, backpanel | B-500 do B-599: wgrywanie plików dostarczonych przez człowieka do wolumenu `media`, kontrola wymiarów i formatu wg `docs/09`, zmiana `status` `brak` → `gotowe`; model nie generuje obrazów | Zaimplementować API katalogu i cen w backpanelu; Zbudować szkielet backpanelu | taktyl-backpanel |
| Zbudować pulpit i dziennik audytu | TASK | LOW | m6, backpanel | B-600 do B-699 i widok `audit_log`: liczby z bazy (zamówienia, przychód demo, niski stan), ostatnie zmiany z filtrem po użytkowniku i encji | Zbudować ekran zamówień w backpanelu; Zaimplementować uwierzytelnianie, role i audit_log | taktyl-backpanel |
| Zaimplementować tryb demo i cykliczny reset | TASK | MEDIUM | m6, infra, api | `DEMO_MODE`: przycisk „Wejdź jako viewer”, profil `demo` uruchamia `db:reset-demo` cyklicznie, retencja danych zamówień 30 dni, limity żądań zaostrzone; S31 i S32 (ADR-0006, ADR-0007, I-xxx) | Zaimplementować uwierzytelnianie, role i audit_log; Skonfigurować docker-compose z profilami | taktyl-devops |

---

## M7 · Hardening i publikacja

**Epic:** M7 Hardening i publikacja · **Rezultat:** audyty, S1 do S36, README, publikacja i tag `v1.0.0`.

| Tytuł | Typ | Priorytet | Tagi | Kryteria odbioru | Blokowane przez | Agent |
|---|---|---|---|---|---|---|
| Wykonać audyt systemu designu | TASK | HIGH | m7, design, qa | Skrypt z `docs/12` §3 na każdej stronie P0 i ekranie backpanelu: ≤ 7 rozmiarów, 1 rodzina, 1 wariant przycisku, promienie `10px`/`999px`, 0 małych celów, 0 zdublowanych `id`; `#hex` i `rgb(` poza tokenami: 0 | Zbudować stronę główną; Zbudować ekran katalogu i cen w backpanelu | taktyl-design-system |
| Zmierzyć i dopiąć budżet wydajności | TASK | HIGH | m7, qa, sklep | Lighthouse CI na stosie produkcyjnym z `compose`: wartości z `docs/12` §4 dla stron treściowych i aplikacyjnych; obce domeny 0; obrazy z wymiarami, `srcset`, `alt`; PR blokowany przy przekroczeniu | Zbudować stronę główną; Zbudować symulację płatności i strony statusów | taktyl-qa |
| Wykonać audyt dostępności | TASK | HIGH | m7, qa | Ścieżka S9 do S19 tylko klawiaturą, axe: 0 błędów krytycznych i poważnych w sklepie i backpanelu, 200% i 320 px bez przewijania poziomego, `prefers-reduced-motion`, formularze z `aria-invalid` i `aria-describedby`; przejście czytnikiem w kreatorze | Zbudować stronę główną; Zbudować ekran katalogu i cen w backpanelu | taktyl-qa |
| Wykonać audyt treści | TASK | HIGH | m7, tresci, repo | Testy z `docs/12` §5 dają 0 trafień: marki, dema szablonu, lorem, angielskie etykiety, proste cudzysłowy; adresy tylko `@taktyl.example`; brak NIP/REGON/KRS/BDO, brak logotypów płatności i przewoźników (skill `taktyl-audyt-tresci`) | Zbudować poradnik, opinie i strony informacyjne P1 | taktyl-tresci |
| Przeprowadzić przegląd bezpieczeństwa | TASK | HIGH | m7, api, repo | Lista OWASP dla API i panelu: CSRF, brute force, IDOR na zamówieniach, nagłówki i CSP, sanityzacja treści, podpis webhooka, brak sekretów w obrazach, `pnpm audit` bez wysokich podatności, niewidoczność danych kart (ich brak) | Zaimplementować tryb demo i cykliczny reset; Zbudować ekrany treści w backpanelu | taktyl-architekt |
| Uruchomić pełne testy odbioru S1 do S36 w kontenerze | TASK | HIGH | m7, qa, infra | `docker compose --profile test run --rm test` zielone od czystego stosu; raport w CI; S31 (start od zera ≤ 10 min) zmierzony | Napisać testy e2e backpanelu i propagacji; Wykonać audyt systemu designu; Wykonać audyt dostępności; Zmierzyć i dopiąć budżet wydajności | taktyl-qa |
| Napisać README wizytówkę i instrukcję uruchomienia | TASK | HIGH | m7, docs, repo | README: czym jest Taktyl (fikcyjny sklep), architektura z diagramem, `cp .env.example .env` i `docker compose up`, tabela „co wolno” dla danych, informacja „Szablon Crafto nie jest częścią repozytorium”, linki do ADR i PRD, sekcja „Do zrobienia przez człowieka” (zdjęcia, favicon, subdomena) | Uruchomić pełne testy odbioru S1 do S36 w kontenerze | taktyl-architekt |
| Zweryfikować higienę repo przed publikacją | TASK | HIGH | m7, repo | Skill `taktyl-straznik-repo`: gitleaks na całej historii: 0; ścieżki zakazane nieśledzone; brak prywatnych adresów e-mail i telefonów; autor commitów `noreply`; licencje (MIT, OFL) obecne; pliki `.idea/` wykluczone; potwierdzone Q-01, Q-03, Q-04 | Napisać README wizytówkę i instrukcję uruchomienia; Przeprowadzić przegląd bezpieczeństwa; Wykonać audyt treści | taktyl-straznik-repo |
| Opublikować repozytorium i otagować wydanie | TASK | HIGH | m7, repo | Repo publiczne zgodne z Q-03, ochrona gałęzi `main` (PR, zielone CI, brak force-push), Dependabot włączony, tag `v1.0.0` z notatkami wydania; pierwszy push dopiero po zielonej weryfikacji higieny | Zweryfikować higienę repo przed publikacją | taktyl-straznik-repo |

---

## Podsumowanie

| M | Epic | Zadań |
|---|---|---|
| M0 | Fundament repo, Docker i CI | 10 |
| M1 | Domena, API i seed | 12 |
| M2 | Sklep P0 katalog | 10 |
| M3 | Kreator setu | 6 |
| M4 | Koszyk, zamówienie i pomiar | 6 |
| M5 | Backpanel P0 i propagacja | 10 |
| M6 | Sklep P1 i pełny backpanel | 11 |
| M7 | Hardening i publikacja | 9 |
| | **Razem** | **74** |

Ścieżka krytyczna: szkielet monorepo → Docker i compose → schemat Prisma → seed → API katalogu → listing → karta produktu → kreator → koszyk → zamówienie → uwierzytelnianie → propagacja → ekrany katalogu → testy S25 do S30 → pełne testy odbioru → higiena repo → publikacja.

Zadania możliwe do równoległego startu na początku: higiena repo, tokeny i fonty, opisy produktów i strony prawne (treści nie zależą od kodu), pakiet domeny.
