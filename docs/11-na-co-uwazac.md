# 11 · Na co uważać, a na co nie tracić czasu

## 1. Prawo i fikcja

Sklep jest fikcyjny, ale ma wyglądać i działać jak prawdziwy polski sklep — dlatego elementy obowiązkowe dla e-commerce są zaimplementowane, a wszystko, co mogłoby kogoś wprowadzić w błąd albo dotknąć cudzych praw, jest wyłączone. Poniżej stan ogólny; przy uruchamianiu prawdziwego sklepu treści prawne do weryfikacji przez prawnika.

### 1.1. Żeby nikt nie wziął demo za sklep

| Wymaganie | Realizacja |
|---|---|
| Widoczna informacja, że to demo | F-001, stopka, kasa, ekran płatności (`docs/01` §5) |
| Brak indeksowania | `<meta name="robots" content="noindex, nofollow">` + nagłówek `X-Robots-Tag` |
| Brak prawdziwej płatności | symulacja; zero pól na dane kart, kody BLIK, hasła (F-177, F-200) |
| Brak prawdziwej korespondencji | nic nie jest wysyłane; komunikaty mówią to wprost („W sklepie demonstracyjnym nie wysyłamy e-maili”) |
| Dane firmy | „Taktyl (podmiot fikcyjny)”, adres `ul. Klawiszowa 87, 00-000 Warszawa (adres fikcyjny)`, telefon `+48 22 000 00 00`, e-maile `@taktyl.example` (domena zarezerwowana do przykładów). **Żadnych numerów NIP, REGON, KRS, BDO** — w ich miejscu „— (sklep fikcyjny)” |

### 1.2. Żeby nikt się nie „dowalił” o cudze prawa

| Ryzyko | Zasada |
|---|---|
| Znaki towarowe producentów | Żadnych nazw marek peryferiów, przełączników, sensorów, keycapów — także w parametrach („sensor optyczny 26 000 DPI”, nie nazwa modelu sensora). Porównania tylko do produktów Taktyl |
| Przewoźnicy i płatności | Metody tekstem i opisowo: „Automat paczkowy”, „Kurier”, „BLIK”, „Karta płatnicza”. Bez logotypów, bez nazw handlowych usług przewoźników |
| Zdjęcia | Tylko z manifestu (`docs/09`). Zdjęć z dema szablonu nie ma w licencji |
| Szablon | Regular License = jeden produkt końcowy (`docs/08` §2) |
| Font | Archivo, SIL OFL 1.1 — plik licencji dołączony (`assets/fonts/OFL.txt`) |
| Nazwa | Taktyl sprawdzona w domenach i TMview (`docs/01` §1.1); CEIDG/KRS do sprawdzenia przed realnym użyciem |
| Opinie | Tylko na kartach produktów, z etykietą „Opinie przykładowe — sklep demonstracyjny”. **Bez `aggregateRating` i `review` w danych strukturalnych** — oznaczanie zmyślonych opinii łamie zasady wyszukiwarek, nawet przy `noindex` nie wdrażamy złego wzorca |
| Społeczny dowód | Na stronie głównej brak opinii, liczników klientów, logotypów „zaufali nam” |

### 1.3. Obowiązki sklepu internetowego (zaimplementowane w demo)

| Obowiązek | Gdzie |
|---|---|
| **Przycisk z informacją o obowiązku zapłaty** — „Zamawiam i płacę” (art. 17 ust. 3 ustawy o prawach konsumenta) | F-176 |
| **Najniższa cena z 30 dni** przy każdej obniżce (ustawa o informowaniu o cenach, Omnibus) | F-064, `docs/04` §5.2 |
| Ceny brutto, koszty dostawy znane przed zamówieniem | F-155, F-073 |
| Prawo odstąpienia: ustawowo 14 dni; Taktyl daje 30 — pisz oba („Ustawowo masz 14 dni na odstąpienie od umowy. W Taktylu — 30.”) + wzór formularza odstąpienia w regulaminie | `/zwroty-i-reklamacje`, `/regulamin` |
| Reklamacje konsumenckie jako **„niezgodność towaru z umową”** (terminologia od 2023), nie „rękojmia” | `/zwroty-i-reklamacje` |
| **Bez odnośnika do platformy ODR** — unijną platformę wyłączono 20 lipca 2025 | stopka, regulamin |
| Dane bezpieczeństwa produktu (GPSR): producent, adres pocztowy i elektroniczny, identyfikacja produktu, ostrzeżenia | F-072 |
| Dostępność cyfrowa sklepu (Europejski akt o dostępności, w Polsce od 28.06.2025; wyjątek dla mikroprzedsiębiorstw usługowych) — budujemy do WCAG 2.1 AA niezależnie od wyjątku | `docs/12` §6 |
| Zużyty sprzęt elektryczny: informacja o zbiórce i odbiorze starego sprzętu przy zakupie nowego, numer rejestrowy BDO sprzedawcy (jeśli podlega) | `/zuzyty-sprzet`, stopka: „Nr BDO: — (sklep fikcyjny)” |
| Zgody: równorzędne „Akceptuję” i „Tylko niezbędne”, nic zaznaczonego z góry, regulamin osobno od marketingu | F-175, F-240 |
| Polityka prywatności wymienia realnie używane narzędzia (w demo: przeglądarka przechowuje koszyk lokalnie, brak narzędzi zewnętrznych do czasu podpięcia kontenera) | `/polityka-prywatnosci` |

Strony prawne mają na górze: „Wzór treści dla sklepu demonstracyjnego Taktyl. Nie stanowi oferty.”

## 2. Pułapki, w które model wpada najczęściej

| # | Pułapka | Jak ma być |
|---|---|---|
| 1 | Zostawione treści dema: „Ecomus” w `<title>` i stopce, angielskie etykiety („Add to cart”, „Quick view”), `$`, lorem ipsum, linki do dem | test z `docs/12` §5 — zero trafień |
| 2 | Kopiowanie sekcji szablonu razem z identyfikatorami → zdublowane `id` na stronie | każde `id` unikalne; test w `docs/12` §6 |
| 3 | Kolory, odstępy, rozmiary wpisane wprost | tylko tokeny; test z `CLAUDE.md` reguła 2 |
| 4 | Fonty, ikony, jQuery z CDN | wszystko lokalnie |
| 5 | Pieniądze na liczbach zmiennoprzecinkowych (`0.1 + 0.2`) | grosze jako liczby całkowite |
| 6 | Ręczne formatowanie („1299.00 PLN”, „1,299.00 zł”) | `Intl.NumberFormat('pl-PL', …)` |
| 7 | „2 produktów”, „5 produkty” | `Intl.PluralRules('pl')` |
| 8 | Wyszukiwanie nie znajduje „Łupek” po „lupek” | `docs/04` §9 — `ł` osobno |
| 9 | Daty w UTC, wysyłka „dziś” w niedzielę | strefa `Europe/Warsaw`, dni robocze |
| 10 | `localStorage` rzuca wyjątek w trybie prywatnym i strona przestaje działać | każdy odczyt i zapis w `try/catch`, stan w pamięci jako zapas |
| 11 | `alert()`, `confirm()`, `prompt()` | komunikaty w treści i toasty z „Cofnij” |
| 12 | Szuflady i okna bez pułapki fokusu, bez Esc, bez powrotu fokusu | wspólny moduł nakładek |
| 13 | „Szybko dodaj” dostępne tylko po najechaniu | na dotyku i z klawiatury zawsze widoczne |
| 14 | Skrót `/` działa, gdy ktoś pisze w polu | skróty wyłączone, gdy fokus jest w `input`, `textarea`, `[contenteditable]` |
| 15 | Komunikat dopasowania przesuwa treść | zarezerwowane miejsce (A-08) |
| 16 | Obrazy bez `width`/`height`, `loading="lazy"` na pierwszym ekranie | wymiary zawsze; pierwszy ekran `fetchpriority="high"` |
| 17 | Licznik ceny ogłaszany co klatkę przez czytnik | `aria-live` dostaje tylko wartość końcową (`docs/07` §3.3) |
| 18 | `<div onclick>` zamiast przycisku | `<button>` dla działań, `<a>` dla przejść |
| 19 | Podpowiedź w polu zamiast etykiety | etykieta nad polem zawsze |
| 20 | Cena zapisana w koszyku i pokazana po zmianie danych | ceny liczone przy wyświetleniu (`docs/03` §7) |
| 21 | Rabat setu od ceny regularnej, rozbicie bez reszty groszowej | od ceny aktualnej, reszta na ostatnią pozycję |
| 22 | Przekreślona `regular_price` przy promocji | przekreślona `lowest_30d` |
| 23 | Zdublowane `view-transition-name` → przejście się nie wykonuje | nazwa z ID produktu |
| 24 | Opisy z wymyślonymi parametrami („bateria 120 h”, „certyfikat…”) | tylko atrybuty (`docs/04` §7) |
| 25 | Proste cudzysłowy, brak twardych spacji, „w” na końcu wiersza | `docs/01` §4 |
| 26 | Przyklejony nagłówek lub pasek zasłania element z fokusem | `scroll-padding-top` = wysokość nagłówka; pasek dolny z rezerwacją miejsca |
| 27 | `100vh` na telefonie ucina szuflady | `100dvh` |
| 28 | `z-index: 9999` | tylko `--z-*` |
| 29 | Atrybut `hidden` nie działa, bo komponent ma `display:flex` — ukryta szuflada rzuca cień na krawędź ekranu i łapie fokus | `[hidden]{ display:none !important; }` w arkuszu bazowym |
| 30 | `animationend` z elementu potomnego zdejmuje klasę animacji rodzica za wcześnie | sprawdzaj `event.animationName` (lub `event.target === el`) |
| 31 | `<fieldset>` rozpycha układ na telefonie (domyślne `min-width: min-content`) | `fieldset{ min-width:0 }`, kolumny siatki `minmax(0, 1fr)` |

## 3. Czego nie robić

- Karuzeli w pierwszym ekranie, wyskakujących okien przy wejściu, liczników czasu promocji, „X osób ogląda”, „tylko dziś”.
- „Ostatnich sztuk” i zniżek, których nie ma w danych.
- Sekcji opinii i logotypów na stronie głównej.
- Dźwięków. Próbki brzmienia przełączników to kusząca funkcja, ale tylko P2, tylko po kliknięciu „Posłuchaj” i nigdy automatycznie.
- Czatu, asystenta AI, widżetów zewnętrznych.
- „Gamingowej” estetyki: tęczowe RGB, neon, skośne cięcia, glitch.
- Więcej niż jednego przycisku głównego na ekranie.
- Nieskończonego przewijania listingu (jest „Pokaż więcej”).
- Ciemnego motywu całej strony i podglądu 3D w P0.

## 4. Na co nie tracić czasu

| Temat | Dlaczego nie teraz |
|---|---|
| Prawdziwe płatności, API przewoźników, mapa punktów | demo; symulacja pokazuje przepływ |
| ~~Backend, panel administracyjny, baza danych~~ — **zastąpione przez ADR-0001** (`docs/adr/0001-stos-nestjs-nextjs.md`): backend, backpanel i baza są w zakresie | dane w JSON wystarczały do 99 wariantów; teraz JSON to seed (ADR-0005) |
| Wysyłka e-maili | demo |
| Wersje językowe i waluty | polski rynek |
| Treści pod wyszukiwarki | `noindex`; liczy się poprawna struktura, nie objętość tekstu |
| Ciemny motyw całej strony | P2; sekcje ciemne są w P0 |
| Odwzorowanie dema szablonu co do piksela | szablon jest źródłem komponentów, nie wzorem wyglądu |
| Stare przeglądarki | dwie ostatnie wersje Chrome, Safari, Firefox, Edge; bez wsparcia → łagodne wyłączenie efektów |
| Wynik 100 w PageSpeed | wystarczy budżet z `docs/12` §4 |
| Wszystkie ujęcia galerii | P0 to jedno ujęcie na kolor + wycinki z góry; reszta P1 |
| Konta z hasłami, reset hasła | „Zaloguj jako demo” |
| Kalendarz świąt w terminach dostawy | P2 |
| Faktury PDF | P2, wydruk z `invoice.html` |
