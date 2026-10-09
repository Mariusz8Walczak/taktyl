# 02 · Funkcjonalności

Każda funkcja ma ID, priorytet i kryterium odbioru. Kryterium to warunek „działa”, sprawdzany w `docs/12`.

**Priorytety**
- **P0** — demo działa od wejścia do potwierdzenia zamówienia: nawigacja, listing z filtrami, karta produktu, kreator setu, koszyk, zamówienie z symulacją płatności, pomiar podstawowy. Bez P0 nie ma czego pokazać.
- **P1** — pełny sklep: porównywarka, ulubione, konto demo, poradniki, panel podglądu zdarzeń, skróty klawiszowe, opinie demo, zapisane sety.
- **P2** — później: ciemny motyw całej strony, podgląd 3D, powiadomienia o dostępności, faktura do pobrania, formularz zwrotu.

---

## 1. Stos i architektura

> **Zastąpione przez ADR-0001** (`docs/adr/0001-stos-nestjs-nextjs.md`): stos to NestJS + Next.js + PostgreSQL w Dockerze. Tabela poniżej zostaje jako historia decyzji; funkcje F-xxx i ich kryteria odbioru obowiązują bez zmian. Klucze `localStorage` (§1.2) obowiązują dla koszyka, ulubionych i porównania (ADR-0007). Wiersze „Generowanie stron” (Astro) i „Style” (Ecomus, Bootstrap 5) są zastąpione zgodnie z ADR-0001: Next.js 15 oraz tokeny i własne komponenty (flex, CSS grid, WEB-007), bez Bootstrapa i bez plików szablonu (TAKTYL-73).

| Warstwa | Decyzja | Powód |
|---|---|---|
| Generowanie stron | **Astro** w trybie statycznym | treść w kodzie strony (wyszukiwarki, szybkość), nagłówek i stopka jako komponenty zamiast kopiowania HTML do 40 plików, strony produktów generowane z `data/products.json` |
| Style | CSS szablonu Ecomus (Bootstrap 5) + `src/styles/tokens.css` + `src/styles/taktyl.css` (nadpisania) | szablon daje komponenty, tokeny dają wygląd |
| Skrypty | czyste ES modules w `src/scripts/`; jQuery tylko tam, gdzie wymaga go komponent szablonu | koszyk, kreator i filtry nie zależą od jQuery |
| Stan | `localStorage` (opakowany w `try/catch`) | brak backendu; demo |
| Dane | `data/*.json` importowane w czasie budowania + ten sam JSON ładowany przez kreator i filtry | jedno źródło prawdy |
| Hosting | pliki statyczne na serwerze (nginx), subdomena, nagłówek `X-Robots-Tag: noindex` | demo nie ma być indeksowane |

### 1.1. Struktura projektu

```
src/
  components/      Header, Footer, DemoBar, ProductCard, PriceBlock, Swatch, FitMessage, DeskStage, CartDrawer, Toast…
  layouts/         Base.astro (meta, tokeny, pasek demo, nagłówek, stopka)
  pages/           adresy z docs/05
  scripts/         cart.js, set-builder.js, fit-rules.js, filters.js, search.js, compare.js, wishlist.js, track.js, store.js, format.js
  styles/          tokens.css, taktyl.css
public/
  img/             produkty/, top/, tekstury/ (z assets/manifest.json)
  fonts/           archivo-pl-400-700-w100-125.woff2
  vendor/ecomus/   tylko potrzebne pliki szablonu
data/              bez zmian, tylko odczyt
```

### 1.2. Klucze w `localStorage`

| Klucz | Zawartość |
|---|---|
| `taktyl.cart.v1` | pozycje koszyka i grupy setów, kod rabatowy |
| `taktyl.set.v1` | bieżący stan kreatora (profil, dłoń, wybrane SKU) |
| `taktyl.sets.v1` | zapisane sety (nazwa, SKU, data) — P1 |
| `taktyl.wishlist.v1` | lista SKU |
| `taktyl.compare.v1` | kategoria + do 4 ID produktów |
| `taktyl.recent.v1` | 8 ostatnio oglądanych ID |
| `taktyl.orders.v1` | zamówienia demo |
| `taktyl.consent.v1` | decyzja w banerze zgód + data |
| `taktyl.prefs.v1` | skróty klawiszowe wł./wył., pasek demo zamknięty w tej sesji |
| `taktyl.tracked.v1` | `transaction_id` już wysłanych `purchase` (ochrona przed duplikatem) |

Wersja w nazwie klucza: zmiana struktury = nowy klucz, stary usuwany przy starcie.

---

## 2. Nawigacja i wyszukiwanie

| ID | Funkcja | P | Kryterium odbioru |
|---|---|---|---|
| F-001 | Pasek demo nad nagłówkiem z tekstem z `shop.json → demo.label`, zamykany na sesję | P0 | widoczny przy pierwszym wejściu; po zamknięciu nie wraca do końca sesji; w stopce zawsze |
| F-002 | Nagłówek przyklejony: logotyp (wordmark), Klawiatury, Myszki, Podkładki, Zbuduj set, Poradnik; ikony: szukaj, ulubione, porównaj, koszyk z licznikiem | P0 | przy przewinięciu zostaje; licznik koszyka liczy sztuki (set = 1) |
| F-003 | Menu rozwijane kategorii: skróty filtrów („60–65%”, „Bezprzewodowe”, „Ciche”, „Do 60 g”, „Maty na biurko”) | P1 | każdy skrót otwiera listing z ustawionym filtrem w adresie |
| F-004 | Menu mobilne jako szuflada z lewej, pułapka fokusu, zamykanie Esc i tłem | P0 | działa na 360 px; fokus wraca na przycisk menu |
| F-005 | Wyszukiwarka z podpowiedziami: produkty, kategorie, poradniki; odporna na brak polskich znaków („lod” → Lód, „pustulka” → Pustułka) | P0 | podpowiedzi po 2 znakach; strzałki + Enter działają; „ł” traktowane jak „l” |
| F-006 | Synonimy w wyszukiwarce: „tkl”, „bezprzewodowa”, „cicha”, „lekka”, „mata”, „pionowa” mapowane na filtry | P1 | „cicha” zwraca produkty z profilem `cisza` ≥ 2 |
| F-007 | Strona wyników `/szukaj?q=` z tym samym układem co listing | P1 | brak wyników: komunikat + 3 najpopularniejsze produkty |
| F-008 | Okruszki (breadcrumb) na listingu, karcie produktu i w poradniku | P0 | dane strukturalne `BreadcrumbList` |
| F-009 | Stopka: 4 kolumny (Sklep, Pomoc, Informacje prawne, Kontakt), etykieta demo, metody płatności i dostawy tekstem | P0 | żadnych logotypów płatności ani przewoźników |
| F-010 | Skróty klawiszowe: `/` fokus w wyszukiwarce, `Esc` zamyka nakładki, `?` pokazuje listę skrótów z przełącznikiem „Wyłącz skróty” | P1 | skróty nie działają, gdy fokus jest w polu tekstowym; wyłączenie zapamiętane (WCAG 2.1.4) |

## 3. Listing kategorii

| ID | Funkcja | P | Kryterium odbioru |
|---|---|---|---|
| F-020 | Listing `/klawiatury`, `/myszki`, `/podkladki`: H1 i wstęp z `categories.json` | P0 | jeden H1 na stronę |
| F-021 | Filtry z `data/facets.json` (lista wielokrotnego wyboru, zakres ceny z suwakiem i polami, przełącznik tak/nie, przedziały wagi, dopasowanie długości dłoni) | P0 | każdy filtr pokazuje liczbę wyników przy wartości; wartość z zerem wyników nieaktywna |
| F-022 | Stan filtrów, sortowania i strony w adresie (`?rozmiar=75,tkl&lacznosc=bt&cena=300-700&sort=cena-rosnaco&strona=2`) | P0 | odświeżenie i link odtwarzają widok; przycisk Wstecz cofa zmianę filtra |
| F-023 | Aktywne filtry jako żetony nad wynikami + „Wyczyść wszystko” | P0 | usunięcie żetonu zdejmuje filtr |
| F-024 | Sortowanie: Polecane (domyślne, wg dopasowania i dostępności), Cena rosnąco, Cena malejąco, Nowości, Najlżejsze (tylko myszki) | P0 | sortowanie po cenie bierze najniższą cenę dostępnego wariantu |
| F-025 | Licznik wyników z poprawną odmianą („12 produktów”, „3 produkty”, „1 produkt”) | P0 | `Intl.PluralRules('pl')` |
| F-026 | „Pokaż więcej” zamiast numerów stron (12 na raz), stan w adresie | P0 | fokus przechodzi na pierwszy nowy produkt |
| F-027 | Filtry na telefonie w szufladzie z przyciskiem „Pokaż 12 produktów” | P0 | liczba na przycisku aktualizuje się na żywo |
| F-028 | Szybkie żetony profilu nad listingiem: „Do gier”, „Do pracy”, „Ciche” | P1 | ustawiają sortowanie Polecane dla profilu |
| F-029 | Pusty wynik: komunikat, przycisk „Wyczyść filtry”, 3 propozycje | P0 | brak pustej siatki |
| F-030 | Przejścia siatki przy filtrowaniu przez View Transitions (A-14) | P1 | bez wsparcia przeglądarki — zmiana natychmiastowa |

## 4. Karta produktu na listingu

| ID | Funkcja | P | Kryterium odbioru |
|---|---|---|---|
| F-040 | Karta: zdjęcie 1:1, nazwa, 3 parametry kluczowe, cena (z Omnibusem przy promocji), plakietki, próbki kolorów | P0 | cała karta klikalna przez jeden odnośnik na nazwie (pseudoelement) |
| F-041 | Parametry kluczowe: klawiatury — rozmiar, łączność, przełączniki; myszki — waga, kształt, dłoń cm; podkładki — powierzchnia, rozmiary, materiał | P0 | z atrybutów, bez przymiotników |
| F-042 | Najechanie (tylko `pointer: fine`): drugie ujęcie (A-09) i przycisk „Szybko dodaj” | P1 | na dotyku i z klawiatury „Szybko dodaj” dostępne bez najechania |
| F-043 | „Szybko dodaj” otwiera mały panel wyboru wariantu (kolor, przełącznik lub rozmiar) | P1 | niedostępne warianty nieaktywne z opisem |
| F-044 | Plakietki: Nowość, Bestseller, Promocja −X%, Ostatnie sztuki (stan ≤ 3), Brak | P0 | „Ostatnie sztuki” tylko z danych; procent od `lowest_30d` |
| F-045 | Ikony: ulubione, porównaj — przyciski z etykietą dostępną dla czytnika | P1 | stan wciśnięty `aria-pressed` |

## 5. Karta produktu (strona)

| ID | Funkcja | P | Kryterium odbioru |
|---|---|---|---|
| F-060 | Galeria: zdjęcie główne + miniatury, przewijanie gestem na telefonie | P0 | zdjęcia wariantu po zmianie koloru |
| F-061 | Powiększenie po najechaniu (A-13) i pełny ekran po kliknięciu | P1 | pełny ekran zamykany Esc, z pułapką fokusu |
| F-062 | Wybór wariantu: kolor (próbka + nazwa), przełącznik (kafel z typem i siłą), rozmiar podkładki (kafel z wymiarami w cm) | P0 | wybór zmienia SKU, cenę, stan, zdjęcia i adres (`?sku=`) |
| F-063 | Warianty niedostępne widoczne, nieaktywne, z opisem „Brak w tym kolorze” | P0 | nie da się dodać do koszyka |
| F-064 | Cena: aktualna; przy promocji przekreślona najniższa z 30 dni + zdanie „Najniższa cena z 30 dni przed obniżką: X zł” | P0 | zgodne z `docs/04` §5 |
| F-065 | Dostępność i termin: „Wysyłka dziś” / „Wysyłka jutro” / data dostawy wg `shop.json → dispatch` | P0 | weekendy pomijane; strefa Warszawa |
| F-066 | Ilość (1–10, nie więcej niż stan) + „Dodaj do koszyka” + „Dodaj do setu” | P0 | dodanie otwiera szufladę koszyka (A-03) |
| F-067 | Pasek warunków pod przyciskami (4 pozycje z `docs/01` §2.2) | P0 | — |
| F-068 | Przyklejony pasek zakupu na telefonie (cena, wariant, przycisk) po przewinięciu poza przycisk główny | P0 | nie zasłania fokusu ani stopki |
| F-069 | Blok „Dokończ set”: dla klawiatury proponuje myszkę i podkładkę, dla myszki — klawiaturę i podkładkę itd., dobrane wg profilu z najwyższym `fit` produktu; cena setu z rabatem | P0 | „Otwórz w kreatorze” przenosi wybór; „Dodaj set do koszyka” dodaje grupę |
| F-070 | Specyfikacja w tabeli (wszystkie atrybuty, jednostki z twardą spacją) | P0 | `<table>` z nagłówkami wierszy |
| F-071 | „W zestawie” — lista z `in_box` | P0 | pusta lista = sekcja ukryta |
| F-072 | „Bezpieczeństwo produktu” (dane GPSR: producent, adres, kontakt, ostrzeżenia) | P0 | dane z `gpsr` |
| F-073 | „Dostawa i zwroty” — metody i ceny z `shop.json`, 30 dni na zwrot | P0 | — |
| F-074 | Porównanie przełączników (okno z 4 kaflami z `switches.json`) | P1 | dostępne z wyboru przełącznika |
| F-075 | Jak zmierzyć dłoń (okno: instrukcja słowna + pole cm, zapisuje do profilu kreatora) | P1 | wpisana długość pokazuje dopasowanie tej myszki |
| F-076 | Opinie demonstracyjne z etykietą „Opinie przykładowe — sklep demonstracyjny” | P1 | średnia zawsze z liczbą opinii |
| F-077 | Podobne produkty (ta sama kategoria) i Ostatnio oglądane | P1 | bez bieżącego produktu |
| F-078 | Dane strukturalne `Product` z `offers` (cena, waluta, dostępność) dla domyślnego wariantu | P0 | bez `aggregateRating` (`docs/11`) |
| F-079 | Podgląd 3D (plik `.glb` dostarczony przez człowieka) w zakładce galerii | P2 | brak pliku = brak zakładki |

## 6. Kreator setu

Pełna specyfikacja: `docs/03`. Tu lista do odhaczania.

| ID | Funkcja | P | Kryterium odbioru |
|---|---|---|---|
| F-100 | Adres `/zbuduj-set`, kroki: Do czego (opcjonalny), Klawiatura, Myszka, Podkładka, Podsumowanie | P0 | każdy krok osiągalny z paska postępu |
| F-101 | Profil (5 profili z `rules.json`) i długość dłoni (opcjonalnie) | P0 | pominięcie profilu = `no_profile` z komunikatem |
| F-102 | Lista produktów w kroku, sortowana wg `fit[profil]`, potem cena | P0 | — |
| F-103 | Wybór wariantu w kroku (kolor, przełącznik z domyślnym dla profilu, rozmiar) | P0 | — |
| F-104 | Reguły dopasowania z `rules.json → checks`, wyniki na żywo | P0 | wynik nigdy nie blokuje dodania do koszyka |
| F-105 | Propozycja zmiany przy ostrzeżeniu (jedno kliknięcie podmienia wariant) | P0 | po podmianie ostrzeżenie znika |
| F-106 | Podgląd biurka w skali (DeskStage), placeholdery w prawdziwych wymiarach do czasu zdjęć | P0 | proporcje zgodne z mm z danych |
| F-107 | Podsumowanie ceny: suma, rabat setu, razem, „Oszczędzasz X zł”, licznik przewijany (A-04) | P0 | kwoty zgodne z `shop.json → set_discount` |
| F-108 | Stan w adresie (`?profil=&dlon=&k=&m=&p=`) i w `taktyl.set.v1` | P0 | link otwarty w nowej karcie odtwarza set |
| F-109 | „Kopiuj link do setu” | P0 | komunikat „Link skopiowany”; bez schowka — pole z zaznaczonym linkiem |
| F-110 | „Dodaj set do koszyka” jako grupa | P0 | `docs/03` §7 |
| F-111 | Gotowe sety z `presets.json` jako punkt startu | P0 | wczytanie zastępuje bieżący wybór po potwierdzeniu w treści strony (bez okna przeglądarki) |
| F-112 | Wejście z karty produktu („Dodaj do setu”) z gotowym wyborem | P0 | kreator otwiera się na następnym pustym kroku |
| F-113 | Moment „Set kompletny” (A-16) | P1 | raz na skompletowanie |
| F-114 | Zapisz set (nazwa, lista w koncie) | P1 | maks. 10 setów |
| F-115 | Spójna kolorystyka — plakietka przy zgodnych kolorach | P1 | z reguły `color-harmony` |

## 7. Porównywarka i ulubione

| ID | Funkcja | P | Kryterium odbioru |
|---|---|---|---|
| F-130 | Porównanie do 4 produktów jednej kategorii; pasek „Porównaj (2)” na dole ekranu | P1 | produkt z innej kategorii: komunikat i propozycja wyczyszczenia |
| F-131 | Tabela `/porownaj`: zdjęcie, nazwa, cena, wszystkie atrybuty; „Pokaż tylko różnice” | P1 | na telefonie przewijanie poziome z przyklejoną kolumną nazw |
| F-132 | Ulubione `/ulubione`: lista SKU, przeniesienie do koszyka | P1 | stan serduszka spójny w całym serwisie |

## 8. Koszyk

| ID | Funkcja | P | Kryterium odbioru |
|---|---|---|---|
| F-150 | Szuflada koszyka z prawej (A-03): pozycje, sety jako grupy, suma, przyciski „Przejdź do zamówienia” i „Zobacz koszyk” | P0 | pułapka fokusu, Esc, fokus wraca na przycisk wywołujący |
| F-151 | Strona `/koszyk`: zmiana ilości, usuwanie z „Cofnij” w komunikacie (5 s) | P0 | bez okien `confirm()` |
| F-152 | Pasek do darmowej dostawy („Brakuje 42,00 zł do darmowej dostawy”) | P0 | próg z `shop.json`, liczony po rabatach |
| F-153 | Kody rabatowe z `shop.json → codes`; podpowiedź „Kody demo: TAKTYL10, DOSTAWA0” przy polu | P0 | `TAKTYL10` nie obejmuje pozycji w setach |
| F-154 | Grupa setu: jedna ilość dla całej grupy, „Edytuj set” wraca do kreatora, usunięcie elementu rozbija set (rabat znika, komunikat z „Cofnij”) | P0 | `docs/03` §7 |
| F-155 | Podsumowanie: wartość produktów, rabat setu, kod, dostawa („od 12,99 zł” przed wyborem metody), razem; wszystkie ceny brutto | P0 | arytmetyka w groszach |
| F-156 | Pusty koszyk: „Koszyk jest pusty. Zacznij od kreatora setu albo od klawiatury.” + 2 przyciski | P0 | — |
| F-157 | Weryfikacja stanów przy otwarciu koszyka (wariant bez stanu oznaczony, nie da się przejść dalej) | P0 | — |

## 9. Zamówienie (kasa)

| ID | Funkcja | P | Kryterium odbioru |
|---|---|---|---|
| F-170 | Jedna strona `/zamowienie`: Kontakt → Dostawa → Faktura → Płatność → Zgody, podsumowanie przyklejone z prawej (na telefonie zwinięte na górze) | P0 | brak logowania wymuszonego |
| F-171 | Pola zależne od metody dostawy (`shop.json → shipping_methods[].fields`): automat — e-mail, telefon, punkt; kurier — + imię i nazwisko, adres | P0 | pola adresu nie istnieją przy automacie |
| F-172 | Wybór automatu paczkowego z listy `pickup_points` z wyszukiwaniem po mieście | P0 | bez mapy |
| F-173 | Faktura na firmę: NIP (walidacja sumy kontrolnej), nazwa, adres | P0 | `docs/11` — bez przykładowych NIP-ów |
| F-174 | Walidacja przy polu po opuszczeniu pola i przy wysłaniu; komunikat pod polem z `aria-describedby`; fokus na pierwszy błąd | P0 | kod pocztowy `00-000`, telefon 9 cyfr |
| F-175 | Zgody: regulamin (wymagana, niezaznaczona), newsletter (opcjonalna, niezaznaczona) | P0 | żadna zgoda nie jest zaznaczona z góry |
| F-176 | Przycisk **„Zamawiam i płacę”**, nad nim etykieta demo | P0 | treść przycisku bez zmian |
| F-177 | Symulacja płatności `/zamowienie/platnosc?id=`: metoda, kwota, przyciski „Symuluj udaną płatność” i „Symuluj odrzuconą płatność” | P0 | zero pól na dane karty lub kod BLIK |
| F-178 | Potwierdzenie `/zamowienie/potwierdzenie?id=`: numer, pozycje, dostawa, termin, co dalej | P0 | `purchase` wysłany raz na `transaction_id` |
| F-179 | Błąd płatności `/zamowienie/blad-platnosci?id=`: co się stało, „Spróbuj ponownie”, „Zmień metodę płatności” | P0 | koszyk nie jest czyszczony |
| F-180 | Numer zamówienia `TK-RRMMDD-XXXX`, zapis w `taktyl.orders.v1`, czyszczenie koszyka po udanej płatności | P0 | — |

## 10. Konto (demo)

| ID | Funkcja | P | Kryterium odbioru |
|---|---|---|---|
| F-200 | „Zaloguj jako użytkownik demo” — jeden przycisk, bez hasła | P1 | żadnych pól hasła w serwisie |
| F-201 | `/konto` — skrót: ostatnie zamówienie, zapisane sety, ulubione | P1 | — |
| F-202 | `/konto/zamowienia` i szczegóły zamówienia | P1 | z `taktyl.orders.v1` |
| F-203 | `/konto/sety` — zapisane sety: otwórz w kreatorze, zmień nazwę, usuń | P1 | — |
| F-204 | `/konto/adresy` — zapisane adresy do zamówienia | P2 | — |
| F-205 | `/konto/zwroty` — formularz odstąpienia od umowy dla pozycji z zamówienia, numer zwrotu | P2 | treść pouczenia zgodna z `docs/11` |
| F-206 | Faktura demo do wydruku (`invoice.html` szablonu) | P2 | oznaczona jako dokument demonstracyjny |

## 11. Treści

| ID | Funkcja | P | Kryterium odbioru |
|---|---|---|---|
| F-220 | Poradnik: 4 artykuły — „Jak wybrać przełączniki”, „Rozmiary klawiatur: od 60% do 100%”, „Jak dobrać myszkę do dłoni”, „Jaka podkładka: szybka, kontrolna, mata na biurko” | P1 | 600–900 słów, każdy kończy się wejściem do kreatora z ustawionym profilem |
| F-221 | Strony informacyjne: O sklepie, Kontakt (formularz: e-mail, temat, wiadomość), FAQ, Dostawa i płatności, Zwroty i reklamacje, Regulamin, Polityka prywatności, Cookies, Zużyty sprzęt | P0 (Dostawa, Zwroty, Regulamin, Prywatność, Cookies), P1 (reszta) | treści oznaczone jako wzory dla sklepu demonstracyjnego |
| F-222 | Strona 404 z wyszukiwarką i trzema kategoriami; serwer zwraca kod 404 | P0 | — |
| F-223 | Newsletter: jedno pole e-mail, komunikat o potwierdzeniu (demo, nic nie jest wysyłane) | P1 | zgoda nie zaznaczona z góry |

## 12. Funkcje systemowe

| ID | Funkcja | P | Kryterium odbioru |
|---|---|---|---|
| F-240 | Baner zgód: „Akceptuję wszystkie” i „Tylko niezbędne” równorzędne wizualnie, „Ustawienia” z kategoriami | P0 | brak skryptów analitycznych przed zgodą (tryb zgody, `docs/10`) |
| F-241 | Komunikaty (toast) w prawym dolnym rogu, `role="status"`, znikają po 4 s, zatrzymanie przy najechaniu i fokusie | P0 | maks. 3 naraz |
| F-242 | Warstwa danych `dataLayer` ze zdarzeniami z `docs/10` | P0 | — |
| F-243 | Panel podglądu zdarzeń (`?pomiar=1`): wysuwany panel z listą zdarzeń na żywo | P1 | pokazuje parametry w JSON; nie wpływa na układ strony |
| F-244 | `noindex` w meta i nagłówku serwera, mapa strony i `robots.txt` przygotowane na wersję produkcyjną | P0 | — |
| F-245 | Odnośnik „Przejdź do treści” jako pierwszy element | P0 | widoczny przy fokusie |
| F-246 | Ciemny motyw całej strony (przełącznik + `prefers-color-scheme`) | P2 | tokeny ciemne z `docs/06` |
| F-247 | Sekcje ciemne („mody”) w jasnym motywie | P0 | lokalnie przełączają tokeny na ciemne |

## 13. Konfigurator kolorów 3D i własny set (ADR-0011)

| ID | Funkcja | P | Kryterium odbioru |
|---|---|---|---|
| F-250 | Konfigurator części na karcie produktu: model 3D (GLB) ładowany po wejściu na stronę konfiguratora, obrót myszą, dotykiem i klawiaturą, malowanie części (obudowa, klawisze, nadruki, korpus, przyciski) | P1 | zmiana koloru części widoczna od razu; bez WebGL lub przy błędzie ładowania działa wybór z listy ze zdjęciem produktu |
| F-251 | Wybór wykończenia części i wzoru podkładki (nadruk, nadruk pod szkłem w Lodzie) | P1 | tylko wykończenia dozwolone dla palety części; wzór pasuje do rodziny podkładki |
| F-252 | Ograniczenia techniczne: anodowanie tylko w modelach aluminiowych, półprzezroczyste tylko z podświetleniem, nadruk klawisza o kontraście poniżej 3:1 zamieniany na biel lub czerń z komunikatem | P1 | zgodnie z `packages/domain` i testami |
| F-253 | Wycena i SKU konfiguracji liczone wyłącznie po stronie serwera (`POST /v1/configurator/quote`), cena w groszach: model bazowy + dopłaty za wykończenie | P1 | klient nie wysyła ceny; ta sama konfiguracja daje to samo SKU |
| F-254 | Podsumowanie konfiguracji: cena bazowa, dopłata, razem, SKU, informacja „na zamówienie, wysyłka w 7 dni roboczych” | P1 | kwoty zgodne z odpowiedzią API |
| F-255 | „Stwórz własny set”: scena z klawiaturą, myszką i podkładką, dowolny wygląd każdej części, rabat setu jak w kreatorze | P1 | rabat liczy API wg `shop.json`; gotowe sety i „Zbuduj set” bez zmian |
| F-256 | Konfiguracja w koszyku i zamówieniu (pozycja na zamówienie, bez stanu magazynowego) | P1 | wycena serwerowa, widoczna w backpanelu |

