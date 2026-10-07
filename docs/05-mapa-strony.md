# 05 · Mapa strony i sekcje

Każda strona: adres, po co istnieje, jakie zdarzenie wywołuje. Strona bez zdarzenia nie powstaje. Pliki szablonu: `docs/08` §3.

## 1. Adresy

| Adres | Po co | Zdarzenie główne | P |
|---|---|---|---|
| `/` | wprowadzić do kreatora albo kategorii | `set_builder_start` (entry `hero`) / `select_item` | P0 |
| `/klawiatury`, `/myszki`, `/podkladki` | znaleźć produkt filtrami | `select_item` | P0 |
| `/{kategoria}/{slug}` (np. `/klawiatury/bazalt-75`) | wybrać wariant i kupić albo zacząć set | `add_to_cart` / `set_builder_start` (entry `pdp`) | P0 |
| `/zbuduj-set` | złożyć i kupić set | `set_add_to_cart` | P0 |
| `/koszyk` | sprawdzić i przejść dalej | `begin_checkout` | P0 |
| `/zamowienie` | podać dane, wybrać dostawę i płatność | `add_payment_info` | P0 |
| `/zamowienie/platnosc?id=` | symulacja płatności | — (przejście) | P0 |
| `/zamowienie/potwierdzenie?id=` | potwierdzić zamówienie | `purchase` | P0 |
| `/zamowienie/blad-platnosci?id=` | wrócić do płatności | `add_payment_info` (ponownie) | P0 |
| `/szukaj?q=` | wyniki wyszukiwania | `select_item` | P1 |
| `/porownaj` | porównać do 4 produktów | `add_to_cart` | P1 |
| `/ulubione` | wrócić do zapisanych produktów | `add_to_cart` | P1 |
| `/konto`, `/konto/zamowienia`, `/konto/zamowienia/{id}`, `/konto/sety` | demo konta | `set_builder_start` (entry `account`) | P1 |
| `/konto/adresy`, `/konto/zwroty` | demo konta | `return_request` | P2 |
| `/poradnik`, `/poradnik/{slug}` (4 artykuły z F-220) | odpowiedzieć na pytanie przed zakupem | `set_builder_start` (entry `guide`) | P1 |
| `/dostawa-i-platnosci`, `/zwroty-i-reklamacje`, `/regulamin`, `/polityka-prywatnosci`, `/cookies` | obowiązek informacyjny (treści wzorcowe, oznaczone jako demo) | — | P0 |
| `/o-sklepie`, `/kontakt`, `/faq`, `/zuzyty-sprzet` | zaufanie, kontakt | `generate_lead` (kontakt) | P1 |
| `/404` | wyprowadzić z błędnego adresu | `select_item` | P0 |

Adresy bez polskich znaków, małymi literami, słowa łącznikiem. Brak końcowego ukośnika. Wariant produktu w parametrze `?sku=`, adres kanoniczny bez parametru.

## 2. Strona główna `/`

| # | Sekcja | Treść | Plik szablonu |
|---|---|---|---|
| 1 | Pasek demo | `shop.json → demo.label` | — (własny, prosty) |
| 2 | Nagłówek | F-002 | `home-setup-gear.html` (nagłówek) |
| 3 | **Pierwszy ekran** | lewo: H1, podtytuł, przyciski, pasek warunków (`docs/01` §2.2); prawo: `DeskStage` z gotowym setem „Programista” i animacją A-02 | własny układ na siatce szablonu; `DeskStage` z `docs/03` §5 |
| 4 | Kategorie | 3 kafle: zdjęcie, nazwa, „6 modeli · od 299 zł” (liczone z danych), odnośnik | sekcja kategorii z `home-setup-gear.html` |
| 5 | Jak działa set (sekcja ciemna) | 3 kroki — to jest sekwencja, numeracja uzasadniona: „Wybierz klawiaturę” → „Dobierz myszkę do dłoni” → „Dopasuj podkładkę do biurka”; pod spodem przykład z liczbami z `docs/01` §2.3 i przycisk „Zbuduj set” | sekcja „ikonka + tekst” z szablonu |
| 6 | Gotowe sety | 4 karty z `presets.json`: zdjęcia trzech elementów, nazwa, `note`, „Razem 1203,30 zł · oszczędzasz 133,70 zł”, „Otwórz w kreatorze” | lookbook / karty kolekcji z `home-setup-gear.html` |
| 7 | Polecane | 8 produktów: po 2–3 z każdej kategorii, sortowanie „Polecane” | siatka produktów z `home-setup-gear.html` |
| 8 | Poradnik (P1) | 3 karty artykułów | sekcja bloga szablonu |
| 9 | Newsletter (P1) | 1 pole + przycisk „Zapisz się” | sekcja newslettera szablonu |
| 10 | Stopka (sekcja ciemna) | F-009 | stopka szablonu |

Na stronie głównej nie ma: karuzeli w pierwszym ekranie, sekcji opinii, logotypów marek, licznika czasu promocji, wyskakującego okna, przewijanego paska z hasłami.

## 3. Listing `/{kategoria}`

1. Okruszki.
2. H1 z `categories.json`, wstęp (2 zdania), odnośnik do poradnika („Jaki rozmiar klawiatury wybrać?”).
3. Żetony profilu (P1): „Do gier”, „Do pracy”, „Ciche”.
4. Pasek narzędzi: licznik wyników, sortowanie, przełącznik siatki (3 / 4 kolumny na komputerze, 2 na telefonie).
5. Kolumna filtrów (komputer) / przycisk „Filtry (2)” otwierający szufladę (telefon).
6. Żetony aktywnych filtrów + „Wyczyść wszystko”.
7. Siatka kart (F-040), po 12, „Pokaż więcej”.
8. Wstawka po 6. karcie (tylko klawiatury i podkładki): „Nie wiesz, co pasuje? Zbuduj set — sprawdzimy wymiary.” — jeden wiersz z przyciskiem, pełna szerokość siatki.

Plik szablonu: `shop-filter-sidebar.html` + zachowanie „Pokaż więcej” z `shop-loadmore.html`.

## 4. Karta produktu `/{kategoria}/{slug}`

Kolumna lewa (komputer 7/12): galeria. Kolumna prawa (5/12, przyklejona do przewinięcia galerii):

1. Okruszki.
2. Plakietki.
3. H1 = nazwa produktu.
4. `short`.
5. Ocena (P1): „4,6 · 5 opinii” z odnośnikiem do sekcji.
6. Blok ceny (F-064).
7. Wybór wariantu (F-062): kolejność — kolor, przełącznik (klawiatury) / rozmiar (podkładki).
8. Dostępność i termin (F-065).
9. Ilość + „Dodaj do koszyka” (główny) + „Dodaj do setu” (poboczny) + ikony ulubione / porównaj.
10. Pasek warunków.

Pod spodem, na pełną szerokość:

11. **Dokończ set** (F-069) — sekcja ciemna; trzy elementy w rzędzie, cena setu z rabatem, dwa przyciski.
12. Zakładki (komputer) / harmonijka (telefon): Opis (`descriptions.json`), Specyfikacja, W zestawie, Bezpieczeństwo produktu, Dostawa i zwroty.
13. Opinie przykładowe (P1).
14. Podobne produkty (P1).
15. Ostatnio oglądane (P1).

Przyklejony pasek zakupu na telefonie: F-068.

Pliki szablonu: `product-detail.html` (układ), `product-swatch-image.html` (kafle przełączników), `product-color-swatch.html` (kolory), `product-frequently-bought-together.html` (blok „Dokończ set”), `product-description-accordion.html` (harmonijka na telefonie).

## 5. Kreator `/zbuduj-set`

Pełny opis w `docs/03`. Układ: `docs/03` §3. Elementy z szablonu: kafle wariantów (`product-swatch-image.html`), podsumowanie z sumą (`product-frequently-bought-together.html`), przyklejone podsumowanie (`checkout.html`, kolumna zamówienia), zakładki/kroki (komponent zakładek szablonu).

## 6. Koszyk `/koszyk`

1. H1 „Koszyk” + licznik („3 produkty”).
2. Pasek do darmowej dostawy.
3. Lista: pozycje i grupy setów (grupa w ramce, nagłówek „Twój set · −10%”, „Edytuj set”).
4. Pole kodu z podpowiedzią kodów demo.
5. Podsumowanie (przyklejone): wartość produktów, rabat za set, kod, dostawa, razem; „Przejdź do zamówienia”.
6. Pod listą: „Dokończ set” (gdy w koszyku są 1–2 kategorie bez grupy) albo Polecane.

Plik szablonu: `view-cart.html`; szuflada: koszyk wyskakujący szablonu.

## 7. Zamówienie `/zamowienie`

Kolumna lewa: Kontakt → Dostawa → Faktura na firmę (zwinięta) → Płatność → Zgody → etykieta demo → „Zamawiam i płacę”. Kolumna prawa: podsumowanie (pozycje zwinięte do liczby, rozwijane; kwoty). Telefon: podsumowanie zwinięte nad formularzem („Pokaż podsumowanie · 1203,30 zł”).

Plik szablonu: `checkout.html`; statusy: `payment-confirmation.html`, `payment-failure.html`.

## 8. Strony informacyjne

Jedna kolumna tekstu do 720 px, spis treści przy dłuższych (regulamin). Na górze każdej: „Wzór treści dla sklepu demonstracyjnego Taktyl. Nie stanowi oferty.” Treści regulaminu i polityki prywatności — `docs/11` §1.

## 9. Elementy wspólne

| Element | Gdzie | Uwagi |
|---|---|---|
| Pasek demo | wszystkie strony | F-001 |
| Szuflada koszyka | wszystkie strony | F-150 |
| Pasek porównania | gdy porównanie ma ≥ 1 produkt | F-130 |
| Baner zgód | pierwsza wizyta | F-240; nie zasłania przycisku głównego pierwszego ekranu na telefonie (dolny pasek ≤ 40% wysokości) |
| Toasty | wszystkie strony | F-241 |
| Panel pomiaru | `?pomiar=1` | F-243 |
