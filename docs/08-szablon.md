# 08 · Szablon

## 1. Decyzja: Ecomus HTML zamiast Crafto

> **Nota (ADR-0004):** wybrano wariant **Crafto** wg §6 tego dokumentu (paczka leży w `html/`). Werdykt poniżej zostaje jako uzasadnienie pierwotnej rekomendacji. Pliki Crafto nie trafiają do publicznego repozytorium (`vendor/crafto/`, `.gitignore`).

Kryterium: **szablon ma dać modelowi gotowe komponenty sklepu**, żeby model nie projektował ich sam. Wygląd i ruch i tak definiują tokeny (`docs/06`) i katalog animacji (`docs/07`), więc „ładniejsze demo” waży mniej niż kompletność stron sklepowych.

| Kryterium | Ecomus HTML (Themesflat) | Crafto HTML (ThemeZaa) |
|---|---|---|
| Dema bliskie tematowi | `home-gaming-accessories` (klawiatury, myszki, słuchawki), `home-setup-gear` (akcesoria na biurko, maty), `home-electronic` | sklepy: moda, biżuteria, wystrój wnętrz |
| Listing | 6 układów, filtry: dostępność, **suwak ceny**, marka, kolory, rozmiar, żetony aktywnych filtrów, sortowanie, przełącznik 2–5 kolumn i lista, „pokaż więcej”, przewijanie nieskończone | 3 układy z kolumną filtrów: kategorie, kolor, rozmiar, tagi; bez suwaka ceny w demie |
| Karta produktu | 30+ wariantów: próbki kolorów i **próbki ze zdjęciem**, lupa, pełny ekran, **„kupowane razem”** z sumą i rabatem, **rabat ilościowy**, przyklejony pasek zakupu, tabela rozmiarów, **podgląd 3D** | 2 układy; próbki kolorów i rozmiarów, zakładki, „porównaj”, „zadaj pytanie” |
| Porównywarka | `compare.html` (tabela, usuwanie, „wyczyść”) | brak strony |
| Koszyk / kasa | koszyk wyskakujący, `view-cart.html`, `checkout.html` | mini koszyk, koszyk, kasa |
| Konto | `my-account`, zamówienia, szczegóły zamówienia, adresy, edycja, ulubione | logowanie / rejestracja |
| Statusy płatności | `payment-confirmation.html`, `payment-failure.html`, `invoice.html` | brak |
| Technologia | Bootstrap 5, jQuery, SCSS; noUiSlider, Swiper, Wow.js, Chart.js | Bootstrap 5, jQuery, SCSS; GSAP, Slider Revolution, Swiper, Anime, Atropos |
| Cena, popularność, aktualizacja | 29 USD (Regular), 1 138 sprzedaży, 4,80 (35 ocen), aktualizacja 10.07.2025 | 6 560 sprzedaży, 4,88 (108 ocen), aktualizacja 4.08.2026 |
| Zdjęcia z dema w paczce | nie („only used for preview purpose”) | nie („not the part of template download package”) |

**Werdykt:** Ecomus. Ma wszystkie strony sklepu, których Crafto nie ma (porównywarka, konto z zamówieniami, statusy płatności, „kupowane razem”, suwak ceny), a dwa jego dema dotyczą dokładnie tej kategorii produktów. Crafto ma lepiej dopracowane dema „z pudełka”, ale jego przewaga leży w efektach (GSAP, Slider Revolution, Atropos), które i tak usuwamy — są ciężkie i sprzeczne z `docs/07`. Brakujące strony sklepu trzeba by w Crafto zaprojektować od zera, czyli dokładnie to, czego model ma nie robić.

Ryzyko Ecomusa: ostatnia aktualizacja w lipcu 2025 i mniejsza baza kupujących. Dla statycznego sklepu demonstracyjnego bez integracji to bez znaczenia.

Dane z kart produktów na ThemeForest i z dem, stan na 7 października 2026. Nazwy plików poniżej pochodzą z indeksu dema — po zakupie sprawdź je w paczce.

## 2. Licencja

- **Regular License** obejmuje jeden produkt końcowy, za którego używanie końcowi użytkownicy nie płacą. Sklep demonstracyjny = jedna licencja.
- System designu zbudowany na tym szablonie i użyty w kolejnym projekcie (np. u klienta) = **kolejny produkt końcowy, kolejna licencja**. Dotyczy kodu i stylów szablonu; tokeny i dokumentacja z tego folderu są Twoje.
- Zdjęć z dema nie ma w paczce i nie wolno ich pobierać ze strony dema.
- Fonty z szablonu usuwamy (zastępuje je Archivo na licencji OFL, `assets/fonts/OFL.txt`). Ikony: zestaw ikon z paczki szablonu, na jego licencji.

## 3. Mapowanie stron i komponentów

| Nasza strona / komponent | Plik Ecomus | Co bierzesz | Co zmieniasz |
|---|---|---|---|
| Nagłówek, stopka | `home-setup-gear.html` | układ nagłówka z wyszukiwarką i ikonami, stopka 4-kolumnowa | logotyp → wordmark; usuń waluty, języki, RTL, telefon wsparcia; dodaj pasek demo |
| Menu rozwijane kategorii | menu z `home-gaming-accessories.html` | układ kolumn | treść: skróty filtrów z F-003 |
| Pierwszy ekran | — | tylko siatka i typografia | własny układ: tekst + `DeskStage` (`docs/03` §5) |
| Kafle kategorii | sekcja kategorii z `home-setup-gear.html` | układ 3 kafli | 3 kategorie zamiast 4–6 |
| Gotowe sety | lookbook / kolekcje z `home-setup-gear.html` | karta z dużym zdjęciem i listą elementów | ceny z `presets.json` |
| Listing | `shop-filter-sidebar.html` + `shop-loadmore.html` | kolumna filtrów, żetony, sortowanie, przełącznik kolumn, „pokaż więcej”, szuflada filtrów na telefonie | filtry z `facets.json`; stan w adresie (F-022) |
| Karta produktu na listingu | jeden z `product-style-01…07.html` | ten z drugim ujęciem przy najechaniu, „Quick Add” i próbkami | **jeden styl w całym serwisie**; parametry kluczowe zamiast opisu |
| Szybki podgląd / szybkie dodanie | okno „Quick View” / „Quick Add” szablonu | okno z wyborem wariantu | tylko „Szybko dodaj” (F-043) |
| Karta produktu (strona) | `product-detail.html` | galeria + kolumna zakupu, zakładki | — |
| Kafle przełączników | `product-swatch-image.html` | próbki ze zdjęciem | zdjęcie → nazwa, typ, siła (bez zdjęcia przełącznika w P0) |
| Próbki kolorów | `product-color-swatch.html` | próbki | nazwa koloru widoczna obok |
| Blok „Dokończ set” | `product-frequently-bought-together.html` | lista pozycji z wyborem wariantu, suma, przycisk „dodaj wybrane” | 3 kategorie, rabat setu, „Otwórz w kreatorze” |
| Harmonijka na telefonie | `product-description-accordion.html` | harmonijka zamiast zakładek | — |
| Przyklejony pasek zakupu | pasek z `product-detail.html` | pasek | tylko na telefonie (F-068) |
| Podgląd 3D (P2) | `product-3d.html` | widok modelu | plik `.glb` od człowieka |
| Kreator setu | — | kafle (`product-swatch-image`), suma (`product-frequently-bought-together`), przyklejone podsumowanie (`checkout.html`), zakładki szablonu jako kroki | cały układ i logika z `docs/03` |
| Porównywarka | `compare.html` | tabela | „Pokaż tylko różnice”, przyklejona kolumna na telefonie |
| Ulubione | `wishlist.html` | siatka | — |
| Szuflada koszyka | koszyk wyskakujący szablonu | szuflada | grupy setów, pasek darmowej dostawy |
| Koszyk | `view-cart.html` | tabela pozycji, kod, podsumowanie | grupy setów (`docs/03` §7) |
| Kasa | `checkout.html` | dwie kolumny, sekcje formularza, podsumowanie | pola z `shop.json`, NIP, symulacja płatności, „Zamawiam i płacę” |
| Statusy | `payment-confirmation.html`, `payment-failure.html` | układ | treści z F-178, F-179 |
| Konto | `my-account.html`, `my-account-orders.html`, `my-account-orders-details.html`, `my-account-wishlist.html` | układ z menu bocznym | „Zaloguj jako demo”, zakładka „Moje sety” |
| Faktura (P2) | `invoice.html` | układ | oznaczenie „dokument demonstracyjny” |
| Poradnik | strony bloga szablonu | lista i artykuł | — |
| 404 | strona 404 szablonu | układ | treść z F-222 |

## 4. Co usuwasz z szablonu

| Element | Powód |
|---|---|
| Przełącznik RTL, arkusze RTL | jeden język |
| Selektory waluty i języka | PLN, polski |
| Odnośniki „Buy now”, przełącznik dem, menu „Home 01–48” | to sklep, nie katalog szablonu |
| Wow.js i atrybuty `data-wow-*`, klasy `.wow` | `docs/07` §4 |
| Karuzela w pierwszym ekranie | `docs/05` §2 |
| Przewijane paski z hasłami (marquee) | `docs/07` §4 |
| Liczniki czasu promocji, „X osób ogląda” | brak danych = manipulacja |
| Wyskakujące okno newslettera i promocji przy wejściu | `docs/11` |
| Sekcje: opinie na stronie głównej, logotypy marek, kanał Instagram, lokalizator sklepów | brak prawdziwych danych |
| Chart.js | niepotrzebny |
| Import fontów z Google Fonts i każdy zasób z CDN | ścieżka krytyczna, `docs/12` §4 |
| Wszystkie teksty dema: „Ecomus” w tytułach, meta i stopce, angielskie etykiety, ceny w USD, lorem ipsum | `docs/12` §5 |
| Zdjęcia dema | licencja |

## 5. Jak przenosić szablon do Astro

1. Do `public/vendor/ecomus/` kopiujesz tylko: CSS (po kompilacji SCSS ze zmiennymi ustawionymi na tokeny), potrzebne JS (Bootstrap, jQuery jeśli konieczne, noUiSlider, Swiper tylko dla galerii produktu na telefonie, skrypt koszyka wyskakującego i okien), font ikon.
2. Dla każdej strony z tabeli §3 otwierasz plik szablonu, kopiujesz potrzebne sekcje do komponentu Astro, a treść zastępujesz danymi z `data/`.
3. Każdy komponent zaczyna się komentarzem: `<!-- źródło: ecomus/product-detail.html, sekcja główna produktu · F-060, F-062 -->`.
4. Skrypty szablonu ładujesz tylko na stronach, które ich używają (noUiSlider — listing; galeria — karta produktu).
5. Po każdej stronie: audyt z `docs/12` §3 i budżet z `docs/12` §4.

## 6. Wariant awaryjny: Crafto

Gdybyś został przy Crafto — tokeny, dane, kreator i animacje zostają bez zmian. Zmienia się tylko źródło komponentów:

| Nasza strona | Plik Crafto | Czego brakuje (do zbudowania z komponentów Bootstrapa) |
|---|---|---|
| Listing | `demo-fashion-store-shop.html` | suwak ceny, żetony aktywnych filtrów, „pokaż więcej” |
| Kategorie / kolekcje | `demo-decor-store-collections.html` | — |
| Karta produktu | `demo-fashion-store-single-product.html` | blok „Dokończ set”, przyklejony pasek zakupu, kafle przełączników |
| Koszyk | `demo-decor-store-cart.html` | grupy setów |
| Kasa | `demo-decor-store-checkout.html` | — |
| Konto | `demo-decor-store-account.html` | zamówienia, szczegóły, zapisane sety |
| Ulubione | `demo-fashion-store-wishlist.html` | — |
| FAQ | `demo-decor-store-faq.html` | — |
| Porównywarka, statusy płatności | — | całe strony |

Z Crafto usuwasz dodatkowo: Slider Revolution, GSAP i ScrollTrigger, Atropos, Anime, ekrany ładowania strony.
