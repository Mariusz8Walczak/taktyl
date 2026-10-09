# 04 · Katalog i dane

Dane są gotowe w `data/`. Model ich nie wymyśla, nie uzupełnia i nie poprawia — czyta. Zmiana w danych = zmiana w `data/_generator.py` i ponowne uruchomienie (`python data/_generator.py .`).

## 1. Pliki

| Plik | Zawartość | Kto czyta |
|---|---|---|
| `data/categories.json` | 3 kategorie: id, slug, nazwa, H1, wstęp | strony, nawigacja |
| `data/products.json` | 18 produktów, 99 wariantów (SKU), atrybuty, zdjęcia, plakietki, `fit`, GPSR | wszystko |
| `data/switches.json` | 4 przełączniki: Ślizg, Próg, Trzask, Szept | karta produktu, kreator, filtry |
| `data/colors.json` | 49 kolorów (4 w wariantach + paleta konfiguratora, ADR-0011): kod w SKU, etykieta, grupa harmonii, kolor próbki (`swatch`) | próbki, reguła kolorystyki, placeholdery tekstur |
| `data/facets.json` | definicje filtrów dla każdej kategorii | listing |
| `data/rules.json` | profile, strefy myszki, reguły dopasowania i ich komunikaty | kreator |
| `data/presets.json` | 4 gotowe sety z policzoną ceną | strona główna, kreator |
| `data/shop.json` | waluta, próg darmowej dostawy, rabat setu, metody dostawy i płatności, kody, punkty odbioru, etykieta demo | koszyk, zamówienie, stopka |
| `assets/manifest.json` | 190 obrazów do przygotowania, z priorytetem i statusem | komponenty obrazów, `docs/09` |
| `data/descriptions.json` | **do napisania przez model** — opisy produktów (sekcja 7) | karta produktu |
| `data/reviews.json` | **do napisania przez model, P1** — opinie demonstracyjne (sekcja 8) | karta produktu |

## 2. Katalog w liczbach

| Kategoria | Modele | SKU | Ceny | Warianty |
|---|---|---|---|---|
| Klawiatury | Kwarc 60, Łupek 65, Bazalt 75, Kreda 98, Granit TKL, Marmur 100 | 56 | 299–749 zł | kolor × przełącznik |
| Myszki | Jerzyk, Mewa, Pustułka, Wróbel, Kos, Czapla | 12 | 129–449 zł | kolor |
| Podkładki | Tafla, Len, Szron, Lód, Filc, Korek | 31 | 59–329 zł | rozmiar × kolor |

Klawiatury noszą nazwy skał (ciężar, twardość), myszki — ptaków (lekkość), podkładki — powierzchni. Nazwy przełączników opisują odczucie: Ślizg, Próg, Trzask, Szept.

Stany pokazowe (celowo w danych): `K-BZL75-KOB-SZP` i `P-LOD-L-MGL` — brak; `K-KRD98-GRF-TRZ` (3 szt.) i `M-JRZ-MGL` (2 szt.) — ostatnie sztuki. Promocje: Granit TKL (599 zł, najniższa z 30 dni 699 zł), Wróbel (129 zł, najniższa z 30 dni 139 zł).

## 3. Model produktu

```json
{
  "id": "k-bazalt-75",
  "slug": "bazalt-75",
  "category": "klawiatury",
  "name": "Bazalt 75",
  "brand": "Taktyl",
  "short": "Aluminiowa 75% z pokrętłem głośności. …",
  "description": null,
  "attributes": { "size": "75", "size_label": "75%", "keys": 82, "layout": "ANSI (polski programisty)",
                  "connectivity": ["usb-c", "2.4ghz", "bt"], "case": "aluminium", "mount": "gasket", "hotswap": true,
                  "keycaps": "PBT double-shot", "backlight": "RGB", "battery": "4000 mAh", "knob": true,
                  "weight_g": 1850, "dims_mm": { "w": 327, "d": 140, "h": 36 } },
  "options": ["color", "switch"],
  "default_variant": "K-BZL75-GRF-SLZ",
  "variants": [ { "sku": "K-BZL75-GRF-SLZ", "color": "grafit", "switch": "slizg",
                  "price": 749.0, "regular_price": null, "lowest_30d": null, "stock": 17, "images": "grafit" } ],
  "images": { "grafit": { "packshots": ["k-bazalt-75_grafit_01-34", "…"], "topdown": "k-bazalt-75_grafit_top" } },
  "badges": ["nowosc"],
  "fit": { "fps": 2, "gry": 2, "programowanie": 3, "biuro": 3, "cisza": 2 },
  "in_box": ["kabel USB-C – USB-A 1,8 m", "…"],
  "gpsr": { "manufacturer": "Taktyl (podmiot fikcyjny)", "address": "…(adres fikcyjny)", "contact": "bezpieczenstwo@taktyl.example", "warnings": "…" }
}
```

- `fit` — przydatność do profilu, 0–3. Służy do sortowania „Polecane” i w kreatorze. Nie jest wyświetlany jako liczba.
- `images` — klucze do `assets/manifest.json`, zawsze według koloru (przełącznik nie zmienia wyglądu). Podkładki mają `texture` zamiast `topdown`.
- Ceny w JSON są w złotych (liczba). W kodzie zamieniaj na grosze raz, przy wczytaniu: `Math.round(cena * 100)`.

### 3.1. SKU

| Kategoria | Wzór | Przykład |
|---|---|---|
| Klawiatura | `K-{model}-{kolor}-{przełącznik}` | `K-BZL75-GRF-PRG` |
| Myszka | `M-{model}-{kolor}` | `M-PST-MGL` |
| Podkładka | `P-{model}-{rozmiar}-{kolor}` | `P-TFL-XL-KOB` |

Kody kolorów: GRF grafit, MGL mgła, KOB kobalt, NAT naturalny. Kody przełączników: SLZ Ślizg, PRG Próg, TRZ Trzask, SZP Szept.

## 4. Atrybuty — etykiety i formaty

### Klawiatury

| Klucz | Etykieta | Format |
|---|---|---|
| `size_label` | Rozmiar | jak w danych |
| `keys` | Liczba klawiszy | `82` |
| `layout` | Układ | jak w danych |
| `connectivity` | Łączność | `usb-c` → „przewód USB-C”, `2.4ghz` → „2,4 GHz”, `bt` → „Bluetooth”; łączone przecinkiem |
| `case` | Obudowa | „aluminium”, „tworzywo” |
| `mount` | Mocowanie płyty | jak w danych |
| `hotswap` | Wymiana przełączników bez lutowania | „tak” / „nie” |
| `keycaps` | Keycapy | jak w danych |
| `backlight` | Podświetlenie | jak w danych |
| `battery` | Akumulator | `null` → wiersz ukryty |
| `knob` | Pokrętło | „tak” / „nie” |
| `weight_g` | Waga | < 1000 → „590 g”; ≥ 1000 → „1,85 kg” |
| `dims_mm` | Wymiary (szer. × gł. × wys.) | „32,7 × 14 × 3,6 cm” |
| wariant: `switch` | Przełącznik | „Próg (taktylny, 55 g)” |

### Myszki

| Klucz | Etykieta | Format |
|---|---|---|
| `shape` | Kształt | jak w danych |
| `hand` | Ręka | `prawa` → „dla praworęcznych”, `obureczna` → „oburęczna” |
| `hand_note` | Uwagi | jak w danych |
| `size` | Rozmiar | S / M / L |
| `hand_cm` | Długość dłoni | „18–20,5 cm” |
| `grips` | Chwyt | `palm` → „dłoniowy (palm)”, `claw` → „szponowy (claw)”, `fingertip` → „opuszkowy (fingertip)” |
| `weight_g` | Waga | „49 g” |
| `dims_mm` | Wymiary (dł. × szer. × wys.) | z `d × w × h`: „12 × 6,3 × 3,8 cm” |
| `connectivity` | Łączność | `przewod` → „przewód”, reszta jak wyżej |
| `dpi_max` | Rozdzielczość maks. | „26 000 DPI” (`toLocaleString('pl-PL')`) |
| `polling_hz` | Częstotliwość raportowania | „4000 Hz” |
| `battery` | Bateria | `null` → wiersz ukryty |
| `sensor` | Sensor | jak w danych |

### Podkładki

| Klucz | Etykieta | Format |
|---|---|---|
| `surface` | Powierzchnia | jak w danych |
| `material` | Materiał | jak w danych |
| `thickness_mm` | Grubość | „4 mm” |
| `edge` | Krawędź | jak w danych |
| wariant: `size` | Rozmiar | „XL · 90 × 40 cm” (z `attributes.sizes`) |
| `sizes[].type` | Przeznaczenie | `mysz` → „pod myszkę”, `biurko` → „na całe biurko” |

Liczby z jednostką: zawsze twarda spacja (` `) między liczbą a jednostką; liczby w formacie polskim (`toLocaleString('pl-PL')`).

## 5. Ceny, promocje, dostępność

### 5.1. Cena na karcie i listingu

- Listing: „od X zł”, gdzie X to najniższa cena **dostępnego** wariantu. Wszystkie warianty bez stanu: najniższa cena + plakietka „Brak”.
- Karta produktu: cena wybranego wariantu. Wszystkie ceny brutto, z dopiskiem „z VAT” tylko w podsumowaniu zamówienia.

### 5.2. Promocja (dyrektywa Omnibus)

Wariant jest w promocji, gdy `lowest_30d !== null`.

- Wyświetlasz: cenę aktualną (`price`, kolor `--akcent`), obok przekreśloną **`lowest_30d`**, pod spodem zdanie: „Najniższa cena z 30 dni przed obniżką: 139,00 zł”.
- **Nie wyświetlasz `regular_price` jako ceny przekreślonej** — punktem odniesienia obniżki jest najniższa cena z 30 dni. `regular_price` jest tylko do użytku wewnętrznego.
- Plakietka: `Math.floor((lowest_30d − price) / lowest_30d · 100)` → „−14%” (Granit TKL), „−7%” (Wróbel).
- Rabat setu i kody rabatowe nie są ogłoszeniem obniżki ceny produktu: pokazujesz je jako osobne linie w podsumowaniu („Rabat za set”), bez przekreślania cen produktów.

### 5.3. Dostępność

| `stock` | Etykieta | Zachowanie |
|---|---|---|
| 0 | Brak | wariant nieaktywny; P2: „Powiadom o dostępności” |
| 1–3 | Ostatnie sztuki (zostały 2 szt.) | normalnie; ilość ≤ stan |
| ≥ 4 | Dostępny | ilość ≤ min(stan, 10) |

Nigdy nie pokazujesz „ostatnich sztuk” ani liczników presji, których nie ma w danych.

### 5.4. Termin wysyłki i dostawy

Z `shop.json → dispatch` w strefie `Europe/Warsaw`:
- dzień roboczy (pon.–pt.) przed 14:00 → „Wysyłka dziś”; po 14:00 → wysyłka w następny dzień roboczy;
- sobota, niedziela → wysyłka w poniedziałek;
- dostawa = dzień wysyłki + `eta_business_days` metody (kurier, automat: 1).
- Tekst (środa 7 października, 13:00): „Zamów do 14:00, wyślemy dziś. Dostawa kurierem: czwartek, 8 października.” Data przez `Intl.DateTimeFormat('pl-PL', {weekday:'long', day:'numeric', month:'long'})`.
- Święta ustawowe: P2 (lista dat w `shop.json`).

## 6. Filtry

Definicje w `data/facets.json`. Typy:

| Typ | UI | Parametr w adresie |
|---|---|---|
| `multi` | lista pól wyboru z licznikiem | `?rozmiar=75,tkl` (wartości `v` po przecinku) |
| `range` | suwak z dwoma uchwytami + dwa pola liczbowe | `?cena=300-700` |
| `bool` | przełącznik | `?hotswap=1` |
| `buckets` | lista pól wyboru (przedziały) | `?waga=do-60,60-80` |
| `number-match` | pole „Twoja dłoń (cm)” — pokazuje myszki, których `hand_cm` obejmuje wartość | `?dlon=19.5` |

- `attr` z prefiksem `variant.` filtruje po wariantach: produkt zostaje, jeśli **którykolwiek** wariant spełnia warunki; karta pokazuje wtedy pierwszy pasujący wariant (zdjęcie i cenę).
- Kolory filtra `kolor` z `colors.json` — próbka koloru + nazwa.
- Między wartościami jednego filtra: LUB. Między filtrami: I.
- Liczniki przy wartościach liczone z uwzględnieniem pozostałych aktywnych filtrów.
- Sortowanie `?sort=`: `polecane` (domyślne), `cena-rosnaco`, `cena-malejaco`, `nowosci` (plakietka `nowosc` najpierw), `najlzejsze` (tylko myszki).
- „Polecane” bez profilu: dostępne przed niedostępnymi, potem plakietka `bestseller`, potem suma `fit`, potem cena.

## 7. Opisy produktów (`data/descriptions.json`)

Model pisze opisy raz, do pliku `data/descriptions.json` (`{ "k-bazalt-75": "…" }`), a człowiek je zatwierdza.

- 60–120 słów, 2–3 akapity: dla kogo → co z tego wynika w użyciu → czego się spodziewać (np. „Trzask jest głośny — nie do open space”).
- **Tylko z atrybutów i `short`.** Żadnych nowych parametrów, materiałów, certyfikatów, czasów pracy, gwarancji, nagród.
- Liczba zamiast przymiotnika. Zakazane słowa: „najlepszy”, „rewolucyjny”, „profesjonalny”, „premium”, „idealny”, „niesamowity”, „ultra-”.
- Porównania tylko do innych produktów Taktyl („o 3,3 cm węższa od Granit TKL”), nigdy do innych marek.

## 8. Opinie demonstracyjne (`data/reviews.json`, P1)

```json
{ "k-bazalt-75": [ { "author": "Ola K.", "date": "2026-09-14", "rating": 5, "variant": "Grafit · Próg",
                     "text": "…", "demo": true } ] }
```

- 3–6 opinii na produkt, oceny 3–5, różne długości (1–4 zdania), każda odnosi się do konkretnego atrybutu.
- Autor: imię + inicjał. Daty z ostatnich 6 miesięcy.
- Sekcja opinii zawsze z etykietą „Opinie przykładowe — sklep demonstracyjny”. Średnia zawsze z liczbą opinii („4,6 · 5 opinii”).
- Opinii **nie** oznacza się w danych strukturalnych (`docs/11`).

## 9. Wyszukiwanie

Indeks budowany przy kompilacji z: nazwy, kategorii, `short`, etykiet atrybutów, nazw przełączników i kolorów, synonimów (F-006).

Normalizacja zapytania i indeksu:

```js
const norm = s => s.toLowerCase()
  .normalize('NFD').replace(/[̀-ͯ]/g, '')   // ą→a, ę→e, ó→o, ś→s, ź/ż→z, ć→c, ń→n
  .replace(/ł/g, 'l');                                 // ł NIE rozkłada się w NFD — osobno
```

Bez tej ostatniej linii „lupek” nie znajdzie „Łupek”.
