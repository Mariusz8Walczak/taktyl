# 25 · Plan pokazówki: backpanel i poprawki z audytu

Data: 2026-11-25. Źródła: audyt pokazówki z 25.11.2026 (plik właściciela, poza repo), przegląd backpanelu na stosie z `docker compose`, wzorzec układu: pulpit Bean Clock (javacoffee.donmario.pl, projekt własny donMario).

## 0. Zrobione 25.11.2026

- **P0-1 zdjęcia produktów.** Rendery istniały w `taktyl-rendery/out/img` (900 plików WebP, 300 wpisów manifestu), ale nie były wgrane do wolumenu `media` tej bazy, więc wszystkie wpisy miały `status = brak`. Wgrane przez `POST /v1/admin/media/{key}` (B-502, B-506): 300/300 `gotowe`, audit_log i outbox zapisane, listing bez placeholderów.
- **§1–3 backpanel (gałąź panelu):** pulpit B-610…B-619, ruch B-620, kolektor zdarzeń B-621 i generator historii demo B-622 (ADR-0012), „Jak to jest zrobione” B-623, pasek górny i menu w grupach B-624…B-627; opis w `docs/15` §12. Z §3 nie zrobione: akcje zbiorcze w tabelach, gęstość „kompakt”, wynik Lighthouse i e2e na stronie systemu.
- Brakuje jeszcze z P0-1: `image` w JSON-LD Product i `og:image` karty (sprawdzić, AVIF do decyzji).

## 1. Backpanel: co jest nie tak dziś

| Problem | Gdzie |
|---|---|
| Pulpit to 4 białe karty z tekstem; brak wykresów, trendów, porównań okres do okresu | `apps/admin/src/app/(panel)/page.tsx`, `GET /v1/admin/dashboard` |
| Pusta baza zamówień: każda statystyka pokazuje 0 zł i „Brak danych” | `orders = 0` po `db:reset-demo` |
| Treść wycentrowana w wąskiej kolumnie, duży pusty margines z lewej; karty nierównej wysokości | układ `(panel)/layout` |
| Menu boczne płaskie, bez grup, ikon, liczników („3 zgłoszenia”, „2 bez stanu”) | nawigacja panelu |
| „Ostatnie zmiany” to surowe wpisy typu `media p-tafla_mgla_tekstura` | `audit_log` bez ludzkich etykiet |
| Brak globalnego wyszukiwania (produkt, SKU, numer zamówienia) i skrótów klawiszowych | — |
| Brak trybu ciemnego, brak gęstości „kompakt” | tokeny admina |

## 2. Backpanel: docelowy pulpit (wzorzec Bean Clock)

Zasada z Bean Clock: każdy widżet ma tytuł, jedno zdanie „co to znaczy” i liczbę z kontekstem (zmiana do poprzedniego okresu, mini-wykres). Liczby wyłącznie z bazy, bez wartości wpisanych na sztywno.

**Pasek górny:** zakres dat (dziś / 7 / 30 / 90 dni / własny), porównanie z poprzednim okresem, wyszukiwarka globalna (`/`), znacznik „Dane demonstracyjne”, przełącznik motywu.

**Rząd 1: Stan interesu (4 kafle KPI ze sparkline i zmianą %)**
- Przychód (opłacone), liczba zamówień, średnia wartość koszyka (AOV), udział setów w przychodzie.

**Rząd 2: Sprzedaż**
- Wykres przychodu dzień po dniu z linią poprzedniego okresu.
- Lejek statusów zamówień (nowe → opłacone → wysłane → dostarczone, plus anulowane/zwroty) z czasem przejścia między statusami (`order_status_history`).
- Mapa cieplna zamówień: dzień tygodnia × godzina (`Europe/Warsaw`).

**Rząd 3: To jest USP Taktyla, pokaż je**
- **Sety i rabat:** ile zamówień to pełny set, ile rabatu setu oddano, ile zarobiono na sprzedaży pakietowej (przychód z setów vs pojedyncze).
- **Konfigurator 3D:** liczba zamówionych konfiguracji własnych, najpopularniejsze kolory obudowy/klawiszy, średnia dopłata za wykończenie (`M-…-CFG-…` w `order_items`).
- **Kolory:** ranking kolorystyk wariantów (sztuki, przychód), z próbką koloru z `colors.json → swatch`.
- **Top produkty:** tabela z miniaturą (teraz są zdjęcia), sztuki, przychód, zmiana do poprzedniego okresu.

**Rząd 4: Operacje (co wymaga reakcji)**
- Zamówienia czekające > 24 h, niski stan z prognozą „skończy się za ~N dni” (sprzedaż z 30 dni / stan), zgłoszenia bez odpowiedzi, zaległe i nieudane zdarzenia `outbox`.
- Zdjęcia: postęp P0/P1 (dziś 300/300).
- Omnibus: produkty w promocji z najniższą ceną z 30 dni (z `price_history`).

**Rząd 5: Aktywność**
- Dziennik zmian po ludzku: „owner wgrał zdjęcia Tafla Mgła (tekstura)”, z ikoną rodzaju, grupowaniem seryjnych zmian („+38 zdjęć w 2 min”) i linkiem do encji.

**Panel „Jak to jest zrobione” (audyt P2-6)** jako osobna strona: stos, wynik ostatniego Lighthouse (`perf/`), wynik testów e2e, rozmiar paczek JS, kondycja usług (`/health` api, kolejka outbox).

## 3. Backpanel: układ i nawigacja

- Menu w grupach z ikonami Lucide i licznikami: **Start** (Pulpit) · **Sprzedaż** (Zamówienia, Zgłoszenia) · **Katalog** (Produkty, Ceny i stany, Zdjęcia) · **Treści** (Opisy, Opinie, Poradnik, Strony, FAQ) · **System** (Dziennik zmian, Ustawienia, Jak to zrobione).
- Treść na pełną szerokość z siatką 12 kolumn; karty w rzędzie równej wysokości; zwijane menu; poprawny widok 360 px.
- Tabele (TanStack Table już jest): sortowanie, filtry w adresie, miniatury produktów, akcje zbiorcze (zmiana stanu, plakietki).
- Paleta poleceń `Ctrl+K`: przejście do produktu/SKU/zamówienia, akcje.
- Tryb ciemny jako drugi zestaw tokenów admina (reguła 2).

## 4. Sklep: poprawki z audytu (kolejność)

1. **P0-2** rzuty z góry w podglądzie biurka (wpisy `topdown` są teraz `gotowe`), strefa ruchu myszy, „Zamień na XXL” w podglądzie.
2. **P0-3** 3D na główną i jako pierwszy slajd galerii karty, „Zaprojektuj własny” obok „Dodaj do koszyka”.
3. **Błędy P1 1–7:** „Do czego?: Do czego?”, profil w „Dokończ set”, „Dokończ set” w koszyku liczy brakującą kategorię, miniatury i nazwy wariantów w koszyku, panele bez własnego scrolla, przewijanie do steppera, miejsce na komunikat błędu.
4. P1 8–14: sortowanie dopasowania, nagłówki kategorii, menu „Klawiatury”, krój H1 konfiguratora, oznaczenie cen edycji, `SITE_URL` w JSON-LD.
5. UX: karty produktów (5 kropek + „+N”, hierarchia akcji), filtr „Typ przełącznika”, konfigurator (sticky cena, akordeon, gotowe style, „Kopiuj link”), podsumowanie zamówienia z listą.
6. Pasek demo zapamiętuje zamknięcie + link do case study; `sitemap.xml`.
7. Test 360/390 px i Lighthouse.

## 5. Decyzje właściciela (otwarte)

Rozstrzygnięte 2026-11-25 (`docs/decyzje.md`): generator zamówień demo; własny kolektor zdarzeń z `docs/10` (ADR-0012); wykresy z biblioteki (Recharts) w kolorach z tokenów; backpanel i sklep równolegle.
