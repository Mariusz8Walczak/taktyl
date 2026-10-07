# 06 · System designu

Tokeny są gotowe w `assets/tokens.css` — kopiujesz je bez zmian. Ten dokument mówi, skąd się wzięły i jak ich używać. Podgląd na żywo: `podglad/podglad-palety-i-animacji.html`.

## 1. Koncept: strona ubrana jak zestaw keycapów

Zestawy keycapów mają stały podział: **alfy** (litery, większość klawiatury, jasne), **mody** (modyfikatory: Shift, Ctrl, Tab — ciemniejsze), **akcenty** (Esc, Enter — jeden kolor, który ma przyciągać palec). To jest dokładnie proporcja 60 / 30 / 10, a „akcent = tu naciśnij” to znaczenie, jakie Enter ma w prawdziwym życiu.

| Rola na klawiaturze | Rola na stronie | Tokeny | Udział |
|---|---|---|---|
| Alfy | tła i powierzchnie | `--tlo`, `--tlo-alt`, `--powierzchnia` | ~60% |
| Mody | tekst, struktura, sekcje ciemne | `--tekst`, `--tekst-slaby`, `.sekcja--mod` | ~30% |
| Enter | wyłącznie działanie i cena | `--akcent` | ≤ 10% |

**Dlaczego kobalt.** Anodowane aluminium w kolorze kobaltu to częsty kolor obudów klawiatur — kolor materiałowy, nie ekranowy. Odróżnia Taktyl od typowych sklepów z peryferiami (czerń z neonową zielenią, czerwienią albo fioletem) i od kremowo-pomarańczowych palet, które dziś wyglądają jak szablon. Na neutralnych zdjęciach sprzętu (grafit, biel) niebieski przycisk jest jedynym kolorowym punktem — nie trzeba go niczym wspierać.

Kolory produktów w katalogu (Grafit, Mgła, Kobalt) celowo powtarzają paletę strony: set w kolorze Kobalt wygląda na stronie jak jej część.

## 2. Kolory

Pełne wartości w `assets/tokens.css`. Kontrasty policzone skryptem (WCAG 2.1, wzór z luminancji względnej):

| Para | Jasny | Ciemny | Próg |
|---|---|---|---|
| `--tekst` na `--tlo` | 14,7 | 15,9 | 4,5 |
| `--tekst-slaby` na `--tlo` / `--powierzchnia` / `--tlo-alt` | 6,9 / 7,6 / 6,3 | 8,5 / 6,9 / 7,6 | 4,5 |
| `--akcent-tekst` na `--akcent` | 5,9 | 7,0 | 4,5 |
| `--akcent` jako tekst na `--tlo` / `--powierzchnia` | 5,3 / 5,9 | 6,8 / 5,6 | 4,5 |
| `--linia-pola` na `--powierzchnia` / `--tlo` (obrysy pól) | 3,6 / 3,3 | 3,2 / 3,9 | 3,0 |
| `--sukces` / `--blad` / `--uwaga` na swoim tle | 4,7 / 4,7 / 4,8 | 6,2 / 6,0 / 7,0 | 4,5 |
| `--akcent` na `--akcent-slaby` (wybrany kafel) | 4,9 | 4,9 | 3,0 (obrys) |

**Uwaga:** jasny `--akcent` (#2F54EB) na ciemnym tle ma tylko 2,8:1. Dlatego sekcja ciemna **nie** jest „ciemnym tłem z jasnymi tokenami” — `.sekcja--mod` przełącza cały zestaw na wartości ciemne, w tym akcent i fokus. Nigdy nie kładź elementu z jasnymi tokenami na ciemnym tle.

### 2.1. Zasady

- Akcent wyłącznie na: przycisku głównym, odnośnikach, wybranym kaflu/próbce, cenie promocyjnej, fokusie. Nigdy na plakietkach kategorii, ikonach dekoracyjnych, nagłówkach.
- Kolory stanów tylko dla stanów. Brak towaru to `--tekst-slaby`, nie `--blad`.
- Tło i tekst zawsze definiowane razem (komponent ustawia oba).
- Kolor nie jest jedynym nośnikiem informacji: wynik dopasowania ma ikonę i tekst, wybrany kafel ma znacznik, próbka koloru ma nazwę.
- Tylko trzy tła sekcji: `--tlo`, `--tlo-alt`, `.sekcja--mod`.

## 3. Typografia

**Archivo** (SIL OFL 1.1) — jedna rodzina ze zmienną osią szerokości. Nagłówki rozciągnięte do 125% przypominają nadruki na klawiszach i tabliczki znamionowe sprzętu; tekst w szerokości normalnej jest zwyczajnie czytelny. Jedna rodzina, jeden plik, dwie wyraźnie różne role.

Plik `assets/fonts/archivo-pl-400-700-w100-125.woff2` (64 KB): przycięty do łaciny z polskimi znakami, grubości 400–700, szerokości 100–125%, z cyframi tabelarycznymi (`tnum`). Hostowany lokalnie, wczytywany z `<link rel="preload" as="font" type="font/woff2" crossorigin>`. Żadnych fontów z Google Fonts ani CDN w produkcji.

| Rola | Rozmiar | Grubość | Szerokość | Interlinia | Inne |
|---|---|---|---|---|---|
| H1 pierwszego ekranu | `--t-3xl` | 700 | 125% | 1,05 | `--tracking-naglowek`, `text-wrap: balance` |
| H1 podstrony | `--t-2xl` | 700 | 125% | 1,1 | jw. |
| H2 | `--t-xl` | 700 | 125% | 1,15 | jw. |
| H3, nazwa w kaflu | `--t-l` | 700 | 100% | 1,25 | — |
| Wprowadzenie | `--t-l` | 400 | 100% | 1,5 | maks. 60 znaków w wierszu |
| Tekst | `--t-m` | 400 | 100% | 1,55 | kolumna maks. `--max-tekst` |
| Interfejs, przyciski, etykiety pól | `--t-s` | 700 / 400 | 100% | 1,3 | — |
| Metadane, plakietki | `--t-xs` | 700 / 400 | 100% | 1,3 | — |
| Cena | `--t-l` (karta), `--t-xl` (strona produktu) | 700 | 125% | 1 | `font-variant-numeric: tabular-nums` |
| Logotyp `taktyl` | `--t-l` | 700 | 125% | 1 | `letter-spacing: -0.02em`, małe litery |
| Klawisz (`<kbd>`) | `--t-xs` | 700 | 125% | 1 | — |

Zasady:
- Siedem rozmiarów, nie więcej. Rozmiar spoza tokenów to błąd.
- Bez wersalików w etykietach i nad nagłówkami. Bez wyróżniania jednego słowa w nagłówku innym kolorem lub kursywą.
- Polskie znaki sprawdzone: ą ć ę ł ń ó ś ź ż i wielkie — wszystkie w pliku.
- `text-wrap: pretty` dla akapitów, twarde spacje po jednoliterowych słowach w nagłówkach (`docs/01` §4).

## 4. Odstępy, siatka, promień, cienie

- Odstępy tylko ze skali `--s1`…`--s6` (8, 16, 24, 40, 64, 96). Między sekcjami `--s6` (komputer) / `--s5` (telefon), wewnątrz sekcji `--s3`–`--s4`.
- Siatka: Bootstrap 5 z szablonu (12 kolumn, odstęp `--s3`), kontener `--max`. Punkty przełamania Bootstrapa bez zmian: 576 / 768 / 992 / 1200 / 1400.
- Promień: `--r` (10 px) wszędzie — przyciski, karty, pola, kafle, szuflady. `--r-pelny` wyłącznie dla żetonów, plakietek, próbek kolorów i licznika na ikonie koszyka.
- Cienie: `--cien-1` (karta uniesiona, przycisk), `--cien-2` (szuflada, okno, menu). `--krawedz-klawisza*` to dolna krawędź przycisków (nie cień podniesienia). `--cien-obiektu` tylko dla zdjęć w podglądzie biurka.
- Warstwy: `--z-naglowek` < `--z-menu` < `--z-nakladka` < `--z-toast`. Inne wartości `z-index` nie występują.

## 5. Komponenty i stany

Stany obowiązkowe dla każdego elementu interaktywnego: spoczynek · najechanie · fokus klawiatury · wciśnięcie · nieaktywny · ładowanie (jeśli dotyczy) · błąd (jeśli dotyczy).

```css
:focus-visible{ outline:3px solid var(--fokus); outline-offset:2px; }
```

| Komponent | Wygląd | Stany | Szablon (bazowy) |
|---|---|---|---|
| **Przycisk główny** (keycap) | tło `--akcent`, tekst `--akcent-tekst` 700 `--t-s`, wys. 48 px, `--r`, `box-shadow: var(--krawedz-klawisza)` | najechanie: `--akcent-hover`; wciśnięcie: A-01; nieaktywny: tło `--linia`, tekst `--tekst-slaby`, bez krawędzi, obok powód; ładowanie: wskaźnik ładowania szablonu, etykieta zostaje dla czytnika | przycisk główny szablonu |
| Przycisk poboczny | tło `--powierzchnia`, tekst `--tekst`, obrys 1 px `--linia-pola`, `--krawedz-klawisza-pob` | jak wyżej | przycisk z obrysem |
| Przycisk tekstowy / odnośnik | `--akcent`, podkreślony w tekście ciągłym | najechanie: grubsze podkreślenie | — |
| Ikona-przycisk | 44 × 44, ikona szablonu 20 px, `aria-label` | przełączniki: `aria-pressed` | ikony nagłówka |
| Klawisz `<kbd>` | wys. 28 px, tło `--powierzchnia`, obrys `--linia-pola`, dolna krawędź 2 px, `--r` | użyty skrót: A-17 | — (własny, 6 linii CSS) |
| Karta produktu | tło `--powierzchnia`, `--r`, zdjęcie 1:1 na `--tlo-alt`, bez cienia w spoczynku | najechanie: A-09; fokus: obrys całej karty przez `:focus-within` | jedna wybrana `product-style-0X` |
| Próbka koloru | koło 28 px (`--r-pelny`), obwódka 1 px `--linia-pola` | wybrana: pierścień 2 px `--akcent` + nazwa koloru pogrubiona; brak: przekreślenie ukośne + „Brak” w etykiecie | próbki szablonu |
| Kafel wyboru (radio) | `--powierzchnia`, obrys 1 px `--linia-pola`, `--r`, padding `--s2` | wybrany: obrys 2 px `--akcent`, tło `--akcent-slaby`, znacznik (A-05); nieaktywny: tło `--tlo-alt`, tekst `--tekst-slaby`, „Brak” | `product-swatch-image.html` |
| Żeton filtra | wys. 44 px, `--r-pelny`, obrys `--linia-pola` | aktywny: tło `--akcent-slaby`, obrys `--akcent`, ikona „×” | żetony szablonu |
| Pole formularza | wys. 48 px, obrys 1 px `--linia-pola`, `--r`, etykieta nad polem 700 `--t-s`, podpowiedź pod polem `--t-xs` | błąd: obrys `--blad`, komunikat z ikoną pod polem, `aria-invalid`, `aria-describedby` | pola szablonu |
| Komunikat w treści | tło `--sukces-tlo` / `--uwaga-tlo` / `--blad-tlo` / `--tlo-alt` (info), ikona + tekst w kolorze stanu | — | alert szablonu |
| Toast | `.sekcja--mod`, `--r`, `--cien-2` | A-15 | — |
| Szuflada, okno | `--powierzchnia`, `--cien-2`, tło `--nakladka` | A-12; pułapka fokusu, Esc | koszyk wyskakujący, okna szablonu |
| Plakietka | `--r-pelny`, `--t-xs` 700 | Nowość / Bestseller: tło `--tekst`, tekst `--tlo`; Promocja: tło `--akcent-slaby`, tekst `--akcent`; Ostatnie sztuki: `--uwaga-tlo` / `--uwaga`; Brak: `--tlo-alt` / `--tekst-slaby` | plakietki szablonu |
| Pasek warunków | 4 pozycje: ikona szablonu + tekst `--t-s`, kolor `--tekst` | — | pasek „ikona + tekst” |
| Tabela specyfikacji | `th` `--tekst-slaby` 400, `td` `--tekst`, podziały `--linia` | — | zakładka „Additional information” |
| Licznik ilości | − / liczba / +, każdy 44 × 44 | min / maks: przycisk nieaktywny | licznik szablonu |
| Podgląd biurka `DeskStage` | `docs/03` §5 | A-02, A-06 | — (własny) |
| Lista wyników dopasowania | ikona + tekst, nagłówek „Pasuje” / „Pasuje z 1 uwagą” | A-08 | — (własny, z komunikatu w treści) |

### 5.1. Logotyp

Wordmark `taktyl` złożony fontem (Archivo 700, szerokość 125%, `letter-spacing: -0.02em`), kolor `--tekst`. Bez znaku graficznego, bez ikony, bez obrysu klawisza. Favicon i obraz do udostępnień dostarcza człowiek (`docs/09`).

## 6. Przestylowanie szablonu

1. Kolejność arkuszy: CSS szablonu → `tokens.css` → `taktyl.css`.
2. Usuń z szablonu import fontów zewnętrznych i ustaw `body{ font-family: var(--font); font-size: var(--t-m); line-height: var(--lh-tekst); color: var(--tekst); background: var(--tlo); }`.
3. Znajdź w szablonie zmienne kolorów (SCSS `$primary`… albo `--primary`…) i przypisz im tokeny. To, czego nie da się zmapować zmiennymi, nadpisz w `taktyl.css` selektorem komponentu — nigdy przez `!important` na całym serwisie.
4. Po przestylowaniu uruchom audyt z `docs/12` §3 (rozmiary fontów, warianty przycisków, promienie, małe cele). Wynik ma się zmieścić w limitach:

| Co | Limit |
|---|---|
| Rodziny fontów | 1 |
| Rozmiary fontów | 7 |
| Warianty przycisku głównego | 1 |
| Promienie | 2 (`--r`, `--r-pelny`) |
| Kolory akcentu | 1 |
| Cele < 44 × 44 px | 0 |
