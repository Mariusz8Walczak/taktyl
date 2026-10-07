# 09 · Grafika i zdjęcia

## 1. Zasada: model nie tworzy grafiki

Model składa stronę z gotowych elementów: komponentów szablonu, tokenów, ikon szablonu i zdjęć z manifestu. Wszystko, co jest obrazem, dostarcza człowiek.

| Wolno (to jest interfejs) | Nie wolno (to jest grafika) |
|---|---|
| tła, obrysy, cienie i promienie z tokenów | ilustracje i rysunki w SVG |
| obrys fokusu, pierścień A-16, pasek postępu | klawiatura, myszka, przełącznik, dłoń narysowane w CSS, SVG lub canvas |
| prostokąty-placeholdery z podpisem (sekcja 5) | „dekoracyjne” plamy, siatki, wzory, gradienty udające tło zdjęcia |
| element `<kbd>` (`docs/06`) | logotyp inny niż wordmark złożony fontem |
| szkielet ładowania (A-18) | ikony rysowane samodzielnie, emoji w roli ikon |
| próbki kolorów z `data/colors.json → swatch` | obrazy generowane przez model, zdjęcia z internetu, zdjęcia z dema szablonu |
| ikony z zestawu ikon szablonu | logotypy płatności, przewoźników, partnerów |

Jeśli czegoś brakuje — model zostawia placeholder i dopisuje pozycję do `docs/decyzje.md` („brak ikony: …”, „brak zdjęcia: …”). Nie rysuje zastępstwa.

## 2. Ikony

Tylko font ikon dołączony do szablonu. Potrzebne: szukaj, serce, porównaj, koszyk, użytkownik, menu, zamknij, strzałki, plus, minus, potwierdzenie, uwaga, informacja, błąd, filtr, sortowanie, dostawa, zwrot, tarcza (bezpieczeństwo), zegar (termin), kopiuj link.

- Rozmiar ikon: 20 px w przyciskach, 24 px w pasku warunków. Kolor dziedziczony (`currentColor`).
- Ikona obok tekstu: `aria-hidden="true"`. Ikona bez tekstu: przycisk z `aria-label`.
- Brak ikony w zestawie (np. „klawiatura”) → sam tekst. Nie szukasz innego zestawu ikon i nie dodajesz CDN.

## 3. Manifest

`assets/manifest.json` — lista wszystkich obrazów sklepu. Komponent obrazu sprawdza `status`: `"gotowe"` → zdjęcie, `"brak"` → placeholder. Człowiek po dodaniu pliku zmienia status.

```json
{ "key": "k-bazalt-75_grafit_top", "product_id": "k-bazalt-75", "color": "grafit", "kind": "topdown",
  "dims_mm": { "w": 327, "d": 140 }, "files": ["img/top/k-bazalt-75_grafit_top@1x.webp", "img/top/k-bazalt-75_grafit_top@2x.webp"],
  "pixels": { "1x": [327, 140], "2x": [654, 280] }, "priority": "P0", "status": "brak" }
```

| Rodzaj (`kind`) | Do czego | Ile | P |
|---|---|---|---|
| `packshot` ujęcie `01-34` | karta produktu, listing, koszyk | 38 (jedno na model × kolor) | P0 |
| `packshot` ujęcia `02-gora`, `03-bok`, `04-detal` | galeria karty produktu | 114 | P1 |
| `topdown` | podgląd biurka w kreatorze (klawiatury i myszki) | 26 | P0 |
| `texture` | podgląd biurka (podkładki, kafel powtarzany) | 12 | P0 |

Razem 190 obrazów, w tym **76 w P0**. Do czasu ich powstania sklep działa w całości na placeholderach.

## 4. Specyfikacja zdjęć

### 4.1. Ujęcia produktowe (`packshot`)

- Kadr 1:1, plik wzorcowy 1600 × 1600, eksport do szerokości 400, 800, 1600 (`-400.webp`, `-800.webp`, `-1600.webp`).
- Przezroczyste tło (WebP z kanałem alfa), miękki cień kontaktowy zapisany w kanale alfa. Tło nadaje strona (`--tlo-alt`) — zmiana palety nie wymaga nowych zdjęć.
- Produkt zajmuje ~80% szerokości kadru, wyśrodkowany optycznie.
- Ujęcie `01-34`: z przodu, kamera 30° nad blatem, produkt obrócony o 35° w lewo. To samo ustawienie dla wszystkich produktów — siatka listingu ma wyglądać jak jedna sesja.
- Światło: miękkie, główne z lewej góry, to samo dla całego katalogu.
- Żadnych logotypów i nadruków marek innych niż `taktyl`.

### 4.2. Wycinki z góry (`topdown`)

To one robią podgląd biurka, więc liczy się **skala**, nie uroda.

- Kamera ortograficzna, dokładnie z góry.
- **Skala stała: 1 px = 1 mm** (`@1x`), 2 px = 1 mm (`@2x`). Wymiary pliku = `pixels` z manifestu, co do piksela.
- Kadr przycięty dokładnie do obrysu produktu (bez marginesu).
- Orientacja: klawiatura spacją do dołu; myszka przodem (przyciski) do góry.
- Przezroczyste tło, **bez cienia** (cień dodaje CSS: `--cien-obiektu`).
- WebP z alfą, jakość 85.

### 4.3. Tekstury podkładek (`texture`)

- Kafel bezszwowy, wycinek 200 × 200 mm powierzchni widzianej z góry; pliki 200 × 200 (`@1x`) i 400 × 400 (`@2x`).
- Równe światło, bez krawędzi, szwów, logotypów i cieni.
- Strona powtarza kafel na prostokącie o wymiarach maty (`background-size: 200px 200px` w płótnie 1 px = 1 mm) — jedna tekstura obsługuje wszystkie rozmiary.

### 4.4. Teksty alternatywne

- Ujęcie produktowe: „Bazalt 75 w kolorze Grafit, ujęcie z przodu pod kątem”. Wzór: `{nazwa} w kolorze {kolor}, {opis ujęcia z manifestu}`.
- Elementy w podglądzie biurka: `alt=""` — opis niesie `aria-label` całego płótna (`docs/03` §5.4).
- Miniatury galerii: `alt=""` (powtarzają zdjęcie główne), przycisk miniatury ma `aria-label` „Pokaż ujęcie: widok z góry”.

## 5. Placeholdery

| Rodzaj | Wygląd |
|---|---|
| `packshot` | kwadrat `--tlo-alt`, w środku dwie linie `--t-xs` `--tekst-slaby`: nazwa produktu i kolor; pod spodem „zdjęcie w przygotowaniu”. Te same wymiary, `srcset` i proporcje co docelowe zdjęcie — zero przesunięć po podmianie |
| `topdown` | prostokąt dokładnie `dims_mm` (w płótnie 1 px = 1 mm), tło `--powierzchnia`, obrys 2 px przerywany `--linia-pola`, podpis „Bazalt 75 · 32,7 × 14 cm” (`docs/03` §5.3) |
| `texture` | prostokąt maty wypełniony `colors.json → swatch` koloru wariantu, obrys 1 px `--linia-pola` |

Placeholder nie udaje produktu: żadnych zaokrągleń „jak mysz”, żadnych rzędów kwadratów „jak klawisze”.

## 6. Jak przygotować zdjęcia (dla człowieka)

| Sposób | Dla czego | Uwagi |
|---|---|---|
| **Blender** (zalecany) | wycinki z góry, tekstury, ujęcia produktowe | proste modele w wymiarach z `data/products.json`; kamera ortograficzna: rozdzielczość renderu = wymiary w mm (np. 327 × 140), „Orthographic Scale” = dłuższy bok w metrach (0,327) — daje dokładnie 1 px = 1 mm; jedna scena i jedno światło dla całego katalogu. Blender jest podpięty do Claude na Twoim komputerze — rendery może przygotować osobna sesja |
| Generator obrazów | ujęcia produktowe, zdjęcia „na biurku” | wycinki z góry wymagają ręcznego skalowania i sprawdzenia wymiarów; generowane obrazy nie mogą przypominać produktów prawdziwych marek |
| Zdjęcia własnego sprzętu | — | odradzane: logotypy prawdziwych marek, niespójne światło |

Obróbka: jeden skrypt (np. `sharp` w Node) robi rozmiary i WebP z plików wzorcowych i ustawia `status: "gotowe"` w manifeście.

## 7. Inne obrazy od człowieka

| Plik | Specyfikacja |
|---|---|
| `public/favicon.svg`, `public/favicon-32.png`, `public/apple-touch-icon.png` (180 × 180) | znak z wordmarku lub litera `t` |
| `public/og.jpg` | 1200 × 630, do udostępnień |
| `public/img/poradnik/{slug}.webp` | 1200 × 675 (16:9) dla 4 artykułów, P1 |
| `public/models/{id}.glb` | modele 3D, P2 |

Do czasu ich dostarczenia: brak `og:image` w meta, favicon pusty — nie tworzysz zastępstw.
