# 18 · Przepływy

Diagramy w składni Mermaid (renderuje je GitHub). Opisują zachowanie systemu zgodnie z ADR-0001…0009, `docs/03` (kreator), `docs/10` (pomiar), `docs/15` (backpanel). Przy rozbieżności obowiązują dokumenty źródłowe, ten plik trzeba poprawić.

Skróty: **API** — NestJS (`apps/api`), **Sklep** — Next.js (`apps/web`), **Backpanel** — Next.js (`apps/admin`), **DB** — PostgreSQL.

---

## A. Zmiana ceny w backpanelu → widoczna w sklepie (ADR-0003, B-104)

```mermaid
sequenceDiagram
    autonumber
    actor E as Edytor
    participant B as Backpanel
    participant A as API
    participant D as DB
    participant O as Outbox worker
    participant S as Sklep (Next.js)
    actor K as Klient

    E->>B: Zapisz wariant (cena 119,00 zł)
    B->>A: PATCH /admin/variants/:sku (CSRF, sesja)
    A->>A: guard roli (owner/editor), walidacja Zod, konwersja na grosze
    A->>D: BEGIN
    A->>D: UPDATE variant (price), INSERT price_history
    A->>D: INSERT audit_log (przed → po)
    A->>D: INSERT outbox (znaczniki: product:wrobel, category:myszki, catalog, presets)
    A->>D: COMMIT
    A-->>B: 200 {zapisano, znaczniki}
    O->>D: SELECT outbox WHERE sent_at IS NULL
    O->>S: POST /api/revalidate (nagłówek podpisu HMAC, znaczniki)
    S->>S: weryfikacja HMAC i znacznika czasu, revalidateTag(...)
    S-->>O: 200
    O->>D: UPDATE outbox SET sent_at
    K->>S: GET /myszki/wrobel
    S->>A: GET /products/wrobel (next.tags)
    A-->>S: produkt z ceną i lowest_30d wyliczonym z historii
    S-->>K: świeża strona (≤ 5 s od zapisu)
```

**Opis.** Zapis, historia cen, dziennik i wpis do kolejki powstają w **jednej transakcji**; wysyłka do sklepu dopiero po commicie. `lowest_30d` nie jest zapisywane przez nikogo: API liczy je z `price_history` przy odczycie (Omnibus, `docs/04` §5.2). Strony sklepu są cache'owane po znacznikach, więc po `revalidateTag` następne żądanie odbudowuje stronę.

### A.1. Obsługa awarii

```mermaid
flowchart TD
    W[Worker bierze wpis z outbox] --> P{POST /api/revalidate}
    P -- 200 --> OK[Oznacz wpis jako wysłany]
    P -- błąd sieci lub 5xx --> R{Liczba prób < 8?}
    R -- tak --> T[Odczekaj wykładniczo: 2 s, 4 s, 8 s ... do 5 min, zapisz próbę]
    T --> W
    R -- nie --> F[Oznacz wpis jako nieudany, alert w pulpicie B-606]
    P -- 401 niepoprawny podpis --> X[Przerwij, zapisz błąd konfiguracji REVALIDATE_SECRET, alert w pulpicie]
    F --> N[Sieć bezpieczeństwa: strony mają revalidate 300 s, więc zmiana pojawi się najpóźniej po 5 minutach]
    X --> N
    OK --> E[Koniec]
```

**Zasady.** Awaria sklepu **nie cofa** zapisu w API. Ponowienia są idempotentne (`revalidateTag` można wywołać wielokrotnie). Pulpit (B-606) pokazuje liczbę zdarzeń w kolejce i czas ostatniej udanej rewalidacji. Dane zmienne (stan, ceny w koszyku) i tak są weryfikowane przy wycenie, więc stara strona listingu nie sprzeda towaru bez stanu (F-157).

---

## B. Ścieżka zakupu: karta produktu → potwierdzenie (F-060…F-180, ADR-0007, `docs/10`)

```mermaid
sequenceDiagram
    autonumber
    actor K as Klient
    participant W as Sklep (przeglądarka)
    participant A as API
    participant D as DB
    participant L as dataLayer

    K->>W: Karta produktu, wybór wariantu
    W->>L: view_item
    K->>W: „Dodaj do setu” (lub „Dodaj do koszyka”)
    W->>W: kreator (patrz C) lub zapis pozycji w taktyl.cart.v1 (bez cen)
    W->>L: add_to_cart (po zapisie koszyka)
    K->>W: Otwarcie koszyka
    W->>A: POST /cart/quote {pozycje, grupy setów, kod}
    A->>D: SELECT warianty, ceny, stany, ustawienia
    A->>A: pakiet domain: suma, rabat setu, kod, dostawa, próg darmowej dostawy (grosze)
    A-->>W: wycena + lista problemów (brak stanu, zmiana ceny)
    W->>L: view_cart
    K->>W: „Przejdź do zamówienia”
    W->>L: begin_checkout
    K->>W: wybór dostawy
    W->>L: add_shipping_info
    K->>W: „Zamawiam i płacę”
    W->>A: POST /orders (Idempotency-Key, dane, pozycje)
    A->>A: walidacja (NIP, kod pocztowy, telefon), ponowna wycena z domain
    A->>D: INSERT order (status nowe), numer TK-RRMMDD-XXXX
    A-->>W: 201 {id, numer}
    W->>L: add_payment_info
    W->>W: /zamowienie/platnosc?id= (bez pól na dane karty i kody BLIK)
    alt Symuluj udaną płatność
        W->>A: POST /orders/:id/payment/simulate {outcome: paid}
        A->>D: BEGIN, blokada wierszy wariantów (SELECT FOR UPDATE)
        alt stan wystarcza
            A->>D: zmniejsz stany, status oplacone, COMMIT
            A->>D: outbox: product:{slug}, category:{kat}, catalog
            A-->>W: {status: paid}
            W->>L: purchase (raz na transaction_id, taktyl.tracked.v1)
            W->>W: czyść koszyk, /zamowienie/potwierdzenie?id=
        else brak stanu
            A->>D: ROLLBACK
            A-->>W: 409 {sku z brakiem}
            W->>W: komunikat „Wybierz inny wariant” z odnośnikiem do kreatora
        end
    else Symuluj odrzuconą płatność
        W->>A: POST /orders/:id/payment/simulate {outcome: failed}
        A->>D: status platnosc_nieudana (stany bez zmian)
        A-->>W: {status: failed}
        W->>L: payment_failed
        W->>W: /zamowienie/blad-platnosci?id= (koszyk NIE jest czyszczony)
        K->>W: „Spróbuj ponownie”
        W->>L: add_payment_info
        W->>W: wraca na /zamowienie/platnosc?id=
    end
```

**Opis.** Cena nigdy nie jest zapisana w koszyku (`docs/03` §7); każde otwarcie koszyka pyta API o wycenę. Zamówienie liczy API, kwoty z klienta są ignorowane. **Stan zmniejsza się przy udanej płatności**, nie przy utworzeniu zamówienia (ADR-0007). `purchase` wysyła klient dokładnie raz na `transaction_id`; odświeżenie potwierdzenia nie powiela go (S20). `Idempotency-Key` chroni przed podwójnym kliknięciem „Zamawiam i płacę”. Zdarzenia nie zawierają danych osobowych.

---

## C. Kreator setu (`docs/03`, F-100…F-115)

```mermaid
flowchart TD
    S([Wejście: hero, nav, pdp, pdp_complete, preset, share_link, guide, account]) --> ST{Adres ma parametry?}
    ST -- tak --> LOADU[Odtwórz set z adresu; stary set z taktyl.set.v1 → przycisk „Wczytaj niedokończony set”]
    ST -- nie --> LOADL[Odtwórz z taktyl.set.v1 lub pusty]
    LOADU --> EV1[track set_builder_start]
    LOADL --> EV1
    EV1 --> K0[Krok 0: Do czego? profil i długość dłoni; „Pomiń” = no_profile]
    K0 --> EV2[track set_profile_select]
    EV2 --> K1[Krok 1: Klawiatura; kafle sort wg fit profilu, potem cena]
    K1 --> V1[Wybór wariantu: kolor, przełącznik domyślny dla profilu]
    V1 --> K2[Krok 2: Myszka; znacznik dłoni pasuje lub poza zakresem]
    K2 --> K3[Krok 3: Podkładka; wynik reguły szerokości zanim klient wybierze]
    K3 --> RULES[Reguły z rules.json w pakiecie domain: pad-width-desk, pad-width-mouse, hand-size, two-receivers, color-harmony]
    RULES --> W{Wynik reguły}
    W -- ok --> SUM
    W -- uwaga --> SUG[Komunikat + przycisk propozycji „Zmień na …”; track set_fit_warning]
    SUG --> AP{Klik propozycji?}
    AP -- tak --> SW[Podmiana wariantu, przeliczenie reguł, A-06; track set_suggestion_apply]
    SW --> RULES
    AP -- nie --> SUM
    SUM[Krok 4: Podsumowanie; suma, rabat setu 10% tylko przy 3 kategoriach, razem, oszczędzasz] --> C3{Zmiana z 2 na 3 kategorie?}
    C3 -- tak --> DONE[A-16 raz; track set_complete]
    C3 -- nie --> ACT
    DONE --> ACT{Akcja}
    ACT -- Dodaj set do koszyka --> CART[Grupa set w taktyl.cart.v1; track add_to_cart i set_add_to_cart]
    ACT -- Kopiuj link do setu --> LINK[Schowek lub pole z zaznaczonym linkiem; track set_share]
    ACT -- Zapisz set P1 --> SAVE[taktyl.sets.v1, maks. 10; track set_save]
```

**Zasady.** Kreator doradza i **nigdy nie blokuje**: każdy set da się dodać do koszyka (`docs/03`, zasada nadrzędna). Wynik reguł liczy ten sam pakiet `domain`, który w API wycenia zamówienie, więc podgląd i serwer nie rozjadą się. Brak stanu wariantu nie usuwa go z setu — oznacza „Brak, wybierz inny wariant” i wyłącza dodanie do koszyka z wyjaśnieniem. Przykłady kontrolne (6 setów z `docs/03` §4.4 i 4 sety z `presets.json`) są testami jednostkowymi pakietu `domain`.

---

## D. Logowanie do backpanelu i tryb demo (ADR-0006, B-001…B-009)

```mermaid
flowchart TD
    A([Wejście na admin.taktyl.localhost]) --> S{Ważna sesja?}
    S -- tak --> P[Pulpit]
    S -- nie --> L[/logowanie/]
    L --> M{DEMO_MODE=true?}
    M -- tak --> VB[Widoczny przycisk „Wejdź jako viewer”]
    M -- nie --> FORM
    VB -- klik --> VS[API tworzy sesję roli viewer bez hasła]
    VS --> P
    L --> FORM[Formularz e-mail i hasło]
    FORM --> RATE{Limit prób przekroczony?}
    RATE -- tak --> BLK[„Za dużo prób. Spróbuj za 15 minut.”]
    RATE -- nie --> CHK[API: argon2id verify]
    CHK -- błąd --> ERR[„Nieprawidłowy e-mail lub hasło.” bez wskazywania pola]
    CHK -- ok --> SES[Sesja: HttpOnly, Secure, SameSite=Strict, token CSRF]
    SES --> P
    P --> ROLE{Rola}
    ROLE -- owner --> FULL[Pełny dostęp]
    ROLE -- editor --> EDIT[Katalog, treści, zamówienia, media; ustawienia tylko odczyt]
    ROLE -- viewer --> RO[Tylko odczyt, dane osobowe zamaskowane przez API]
    P --> EXP{Bezczynność 30 min lub 12 h?}
    EXP -- tak --> OUT[„Sesja wygasła. Zaloguj się ponownie.” powrót na tę samą stronę po logowaniu]
```

**Zasady.** Konto początkowe powstaje z `ADMIN_BOOTSTRAP_EMAIL` i `ADMIN_BOOTSTRAP_PASSWORD` w `.env` (poza repozytorium; w repo tylko `.env.example` z placeholderami `@taktyl.example`). Rola `viewer` istnieje tylko przy `DEMO_MODE=true`, nie ma hasła i nie może zapisać niczego: guard w API odpowiada 403, nawet gdy ktoś pominie UI. Sklep nie ma żadnych pól hasła (F-200).

---

## E. Maszyna stanów zamówienia (B-203, B-205, F-177…F-180)

```mermaid
stateDiagram-v2
    [*] --> nowe: POST /orders
    nowe --> oplacone: symulacja paid (stany zmniejszone)
    nowe --> platnosc_nieudana: symulacja failed
    platnosc_nieudana --> oplacone: ponowna próba, paid
    platnosc_nieudana --> platnosc_nieudana: ponowna próba, failed
    platnosc_nieudana --> anulowane: backpanel lub brak płatności 7 dni
    nowe --> anulowane: backpanel lub brak płatności 7 dni
    oplacone --> w_realizacji: backpanel
    w_realizacji --> wyslane: backpanel
    wyslane --> dostarczone: backpanel
    oplacone --> anulowane: backpanel z powodem, stany wracają
    w_realizacji --> anulowane: backpanel z powodem, stany wracają
    dostarczone --> [*]
    anulowane --> [*]
```

| Status | Znaczenie | Kto przechodzi dalej |
|---|---|---|
| `nowe` | zamówienie utworzone, czeka na płatność | klient (symulacja), system (po 7 dniach → `anulowane`) |
| `platnosc_nieudana` | symulacja odrzucona, koszyk klienta nietknięty | klient, system |
| `oplacone` | symulacja udana, stany zmniejszone | edytor |
| `w_realizacji` | zamówienie pakowane | edytor |
| `wyslane` | oznaczone jako wysłane (w demo nic nie jest wysyłane) | edytor |
| `dostarczone` | koniec | — |
| `anulowane` | z powodem; z `oplacone` i `w_realizacji` zwraca stany | — |

**Reguły.** Przejście spoza tabeli → 409 w API. Każda zmiana statusu zapisuje wiersz historii (kto, kiedy) i wpis w `audit_log`. Zmniejszenie stanu następuje tylko na przejściu `→ oplacone`, zwrot tylko na `oplacone|w_realizacji → anulowane`. Wysyłki i dostawy są symulowane: system nigdy nie kontaktuje się z przewoźnikiem ani nie wysyła e-maili.

---

## F. Przepływ pracy agentów: od zadania do `DONE`

```mermaid
flowchart TD
    T0[Zadanie w task-managerze, projekt taktyl, status BACKLOG, kryteria odbioru, tagi, zależności] --> T1[list_issues status BACKLOG onlyUnblocked=true]
    T1 --> T2[move_issue_status → IN_PROGRESS]
    T2 --> SK[Skill taktyl-funkcja-flow: czytaj CLAUDE.md i właściwy docs/xx, zbierz ID F/A/B/I]
    SK --> SP{Specjalista wg obszaru}
    SP -- API, baza --> AG1[agent API NestJS]
    SP -- sklep --> AG2[agent sklep Next.js]
    SP -- backpanel --> AG3[agent backpanel]
    SP -- domena --> AG4[agent domena i testy]
    SP -- treści --> AG5[agent treści]
    SP -- tokeny, ruch, a11y --> AG6[agent design system]
    AG1 --> IMPL
    AG2 --> IMPL
    AG3 --> IMPL
    AG4 --> IMPL
    AG5 --> IMPL
    AG6 --> IMPL
    IMPL[Gałąź feature/ID-krótki-opis; kod z komentarzem nad funkcją z ID; testy] --> LOC[Lokalnie w Dockerze: lint, typy, testy, audyt tokenów]
    LOC --> PR[Pull request, opis z ID funkcji]
    PR --> CI{CI}
    CI -- czerwone --> FIX[Komentarz w zadaniu, wróć do IN_PROGRESS, popraw]
    FIX --> LOC
    CI -- zielone --> REV[move_issue_status → REVIEW, przegląd]
    REV -- uwagi --> FIX
    REV -- ok --> MG[Merge do main, move_issue_status → DEPLOY]
    MG --> DN[move_issue_status → DONE]
    DN --> ST[update_issue_stats: commit, linesAdded, linesRemoved]
```

**CI sprawdza** (wszystko w kontenerach, ADR-0009): lint, typy, testy jednostkowe (`domain`, API), gitleaks (sekrety), audyt tokenów (zero trafień `#[0-9a-fA-F]{3,8}` i `rgb(` poza plikiem tokenów, poza `colors.json → swatch`), kontrolę ścieżek (`html/`, `vendor/`, `*.zip`, `.env*` nie są śledzone), budowę obrazów, a na gałęzi `main` także e2e (S1–S25) i budżet wydajności. Commit zawiera ID funkcji w opisie (reguła 8 `CLAUDE.md`). Gdy przegląd lub CI zawiedzie: `add_comment` z powodem, powrót do `IN_PROGRESS`. Zadanie bez kryteriów odbioru nie wchodzi do `IN_PROGRESS` (Definition of Ready).

---

## G. Uruchomienie Docker Compose od zera i reset demo (ADR-0009, ADR-0005)

```mermaid
flowchart TD
    U([Człowiek: git clone, cp .env.example .env, uzupełnia sekrety]) --> UP[docker compose up --build]
    UP --> DB[db: postgres:16-alpine, wolumen pgdata]
    DB --> H1{healthcheck db OK?}
    H1 -- nie --> DB
    H1 -- tak --> MIG[migrate: prisma migrate deploy, jednorazowo]
    MIG --> SEED[seed: wczytanie data/*.json i manifestu, historia cen, idempotentnie, jednorazowo]
    SEED --> API[api: NestJS, healthcheck /health]
    API --> H2{API zdrowe?}
    H2 -- nie --> API
    H2 -- tak --> WEB[web: Next.js sklep]
    H2 -- tak --> ADM[admin: Next.js backpanel]
    WEB --> PRX[proxy: Caddy, noindex na wszystkim]
    ADM --> PRX
    PRX --> READY([taktyl.localhost, admin.taktyl.localhost, api.taktyl.localhost])
```

```mermaid
flowchart LR
    R1[make reset lub przycisk B-014 lub usługa reset-demo, tylko DEMO_MODE=true] --> R2[Zatrzymaj zapisy: transakcja z blokadą]
    R2 --> R3[TRUNCATE encji runtime: zamówienia, zgłoszenia, audit_log, outbox, historia cen]
    R3 --> R4[Ponowny seed z data/*.json]
    R4 --> R5[Rewalidacja wszystkich znaczników w sklepie]
    R5 --> R6[Wpis w audit_log: reset wykonał owner lub harmonogram]
```

**Zasady.** Sekrety tylko w `.env`, nie w obrazach. Obrazy działają jako użytkownik nie-root, Next.js w trybie `standalone`. Testy (`docker compose --profile test run --rm test`) zaczynają od `db:reset-demo`, bo wartości oczekiwane z `docs/12` wynikają z seedu. Reset nie rusza użytkowników backpanelu ani plików wgranych do wolumenu `media` (poza opcją „z mediami” dla `owner`).

---

## H. Publikacja repozytorium (ADR-0008, skill `taktyl-straznik-repo`)

```mermaid
flowchart TD
    P0([Chcę wypchnąć zmiany do publicznego repo]) --> P1[Skill taktyl-straznik-repo: lista kontrolna]
    P1 --> C1{Czy git status zawiera html/, vendor/, *.zip, .env*, .idea, dumpy SQL?}
    C1 -- tak --> STOP1[STOP: usuń z indeksu, dopisz do .gitignore, nie commituj]
    C1 -- nie --> C2{gitleaks: sekrety, tokeny, klucze?}
    C2 -- trafienia --> STOP2[STOP: usuń, zmień wyciekły sekret, wyczyść historię jeśli już była zacommitowana]
    C2 -- brak --> C3{Skan danych osobowych: e-mail inny niż @taktyl.example i noreply, telefony, NIP, prawdziwe adresy?}
    C3 -- trafienia --> STOP3[STOP: zastąp danymi fikcyjnymi]
    C3 -- brak --> C4{Audyt treści: marki producentów, logotypy płatności i przewoźników, zdjęcia, grafika wygenerowana?}
    C4 -- trafienia --> STOP4[STOP: usuń, placeholder wg docs/09]
    C4 -- brak --> C5{Autor commita: nazwa GitHub + adres noreply?}
    C5 -- nie --> STOP5[STOP: popraw git config w repo]
    C5 -- tak --> C6[Opis commita zawiera ID funkcji F/A/B/I]
    C6 --> C7[Pull request do main, ochrona gałęzi: zielone CI, bez force-push]
    C7 --> C8[CI: lint, typy, testy, gitleaks, audyt tokenów, kontrola ścieżek, pnpm audit]
    C8 -- zielone --> MG[Merge]
    C8 -- czerwone --> FX[Napraw w tej samej gałęzi]
    FX --> C8
    MG --> README[README przypomina: sklep fikcyjny, szablon niedołączony, płatności to symulacja]
```

**Zasady.** Historia git jest publiczna na zawsze, więc kontrole działają **przed** commitem; sekret, który raz trafił do commita, uznaje się za wyciekły (zmiana sekretu jest obowiązkowa, samo usunięcie pliku nie wystarcza). Licencja szablonu Crafto nie pozwala na publikację jego plików: w repo są wyłącznie nasze komponenty na Bootstrapie i tokenach, a katalog `vendor/crafto/` jest lokalny i w `.gitignore` (ADR-0004; pytanie Q-01 w `docs/decyzje.md` czeka na potwierdzenie).
