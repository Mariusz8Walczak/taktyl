# 03 · Kreator setu („Zbuduj set”)

Najważniejsza część sklepu i jedyna, której szablon nie ma gotowej. Wszystko inne w sklepie jest znane — to jest powód, dla którego ktoś zapamięta Taktyl.

**Cel:** klient składa klawiaturę, myszkę i podkładkę, widzi je w skali na biurku, dostaje wynik sprawdzenia wymiarów i dodaje komplet do koszyka z rabatem 10%.

**Zasada nadrzędna:** kreator doradza, nigdy nie blokuje. Każde ostrzeżenie ma propozycję zmiany jednym kliknięciem i każdy set da się dodać do koszyka.

---

## 1. Wejścia

| Skąd | Adres | Stan początkowy | `entry_point` w zdarzeniu |
|---|---|---|---|
| Pierwszy ekran, nagłówek | `/zbuduj-set` | pusty lub zapisany w `taktyl.set.v1` | `hero` / `nav` |
| Karta produktu, „Dodaj do setu” | `/zbuduj-set?k=SKU` (lub `m=`, `p=`) | wybrany ten wariant, kreator na następnym pustym kroku | `pdp` |
| Blok „Dokończ set” | `/zbuduj-set?k=…&m=…&p=…&krok=podsumowanie` | trzy wybrane | `pdp_complete` |
| Gotowy set | `/zbuduj-set?preset=fps` | SKU i profil z `presets.json` | `preset` |
| Link od kogoś | `/zbuduj-set?profil=…&k=…&m=…&p=…` | odtworzony set | `share_link` |
| Poradnik | `/zbuduj-set?profil=cisza` | ustawiony profil | `guide` |

Jeśli w `taktyl.set.v1` jest niedokończony set, a adres przynosi inny — wygrywa adres. Stary set nie znika bez śladu: nad krokami pojawia się „Masz niedokończony set z [data]. Wczytaj go” (zwykły przycisk w treści, nie okno przeglądarki).

## 2. Kroki

```
[0] Do czego?   →   [1] Klawiatura   →   [2] Myszka   →   [3] Podkładka   →   [4] Podsumowanie
 opcjonalny          wymagany            wymagany         wymagany           zawsze dostępne
```

Pasek kroków to lista `<ol>` z odnośnikami; każdy krok klikalny w dowolnej chwili, bieżący z `aria-current="step"`, ukończony z widocznym znacznikiem i tekstem „wybrano: Bazalt 75”.

### Krok 0 — Do czego?

- Profil: 5 kafli z `rules.json → profiles` (etykieta + jedno zdanie, co zmienia: „Zostawimy 40 cm na ruch myszki i zaproponujemy przełącznik liniowy”).
- Długość dłoni: pole liczbowe w cm (krok 0,5; zakres 12–25) z instrukcją „Od nadgarstka do czubka środkowego palca”. Opcjonalne.
- „Pomiń” przechodzi do kroku 1 z `no_profile`.

### Krok 1 — Klawiatura

- Żetony szybkiego filtra: rozmiar (60/65/75/1800/TKL/100), „Bezprzewodowe”, „Ciche”.
- Kafle produktów (radio): zdjęcie, nazwa, szerokość w cm, łączność, cena od. Sortowanie: `fit[profil]` malejąco, potem cena rosnąco. Bez profilu: Polecane z listingu.
- Po wyborze kafla rozwija się wybór wariantu: kolor (próbki z nazwą), przełącznik (4 kafle z `switches.json`, domyślny z `profiles[profil].default_switch`).
- Przycisk „Dalej: myszka”.

### Krok 2 — Myszka

- Żetony: waga („do 60 g”), kształt, „Pasuje do mojej dłoni” (aktywny, gdy podano dłoń).
- Kafel pokazuje zakres dłoni „dla dłoni 18–20,5 cm” i — jeśli podano dłoń — znacznik „pasuje” albo „poza zakresem”.
- Wariant: kolor.

### Krok 3 — Podkładka

- Przełącznik u góry: „Na całe biurko (XL, XXL)” / „Pod samą myszkę (M, L)”. Domyślnie „Na całe biurko”.
- Kafel pokazuje wynik reguły szerokości dla bieżącej klawiatury i profilu, zanim klient go wybierze („mieści się, zapas 10,3 cm” albo „za wąska o 1 cm”).
- Wariant: rozmiar (kafle z wymiarami w cm i ceną), kolor.

### Krok 4 — Podsumowanie

- Trzy pozycje: zdjęcie, nazwa, wariant („Grafit · Próg”), cena, „Zmień” (wraca do kroku).
- Wyniki reguł (sekcja 4).
- Cena (sekcja 6).
- Przycisk główny „Dodaj set do koszyka”; poboczne „Zapisz set” (P1), „Kopiuj link do setu”.

## 3. Układ

### Komputer (≥ 992 px)

```
┌──────────────────────────────────────────────────────────────────────────┐
│ H1 Zbuduj set                     [0]──[1]──[2]──[3]──[4]   pasek kroków  │
├───────────────────────────────────────────┬──────────────────────────────┤
│ KROK (60%)                                │ PODSUMOWANIE (40%, przyklej.) │
│ żetony filtra                             │ ┌──────────────────────────┐ │
│ ┌─────┐ ┌─────┐ ┌─────┐                   │ │ PODGLĄD BIURKA (skala)   │ │
│ │kafel│ │kafel│ │kafel│                   │ └──────────────────────────┘ │
│ └─────┘ └─────┘ └─────┘                   │ wyniki dopasowania           │
│ wybór wariantu (po wyborze kafla)         │ 3 pozycje + ceny             │
│                          [Dalej: myszka]  │ suma / rabat / razem         │
│                                           │ [Dodaj set do koszyka]       │
└───────────────────────────────────────────┴──────────────────────────────┘
```

### Telefon (< 992 px)

```
┌──────────────────────────┐
│ Zbuduj set   krok 2 z 4  │
│ PODGLĄD BIURKA (kompakt) │  wysokość ≤ 30% ekranu
│ wyniki: 1 uwaga ▸        │  rozwija listę
├──────────────────────────┤
│ kafle kroku (1 kolumna)  │
│ ...                      │
├──────────────────────────┤
│ 1203,30 zł  [Dalej ▸]   │  pasek przyklejony na dole; na kroku 4: [Dodaj set do koszyka]
└──────────────────────────┘
```

Pasek dolny ma stałą wysokość zarezerwowaną w układzie (`padding-bottom` treści), żeby nie zasłaniał ostatniego kafla ani fokusu.

## 4. Reguły dopasowania

Źródło: `data/rules.json`. Jednostki: mm. Wynik każdej reguły: `ok`, `uwaga` albo `info`. Reguła nie ma zastosowania, gdy brakuje któregoś elementu z `applies` — wtedy nie wyświetla się.

### 4.1. Wejścia

```
zone   = profiles[profil].mouse_zone_mm  albo  no_profile.mouse_zone_mm (260)
gap    = gap_keyboard_mouse_mm (30)
margin = edge_margin_mm (20)
kb     = keyboard.attributes.dims_mm         { w, d }
pad    = pad.attributes.sizes[variant.size]  { w, d, type }
mouse  = mouse.attributes                    { dims_mm, hand_cm: [min, max] }
```

### 4.2. Reguły

| ID | Kiedy | Warunek „ok” | Przy niespełnieniu |
|---|---|---|---|
| `pad-width-desk` | mata na biurko + klawiatura + myszka | `pad.w ≥ 2·margin + kb.w + gap + zone` | `uwaga` + propozycja |
| `pad-depth-desk` | mata na biurko + klawiatura | `pad.d ≥ kb.d + 2·margin` | `uwaga` (w obecnym katalogu nie występuje, reguła zostaje na przyszłość) |
| `pad-width-mouse` | podkładka pod myszkę + myszka | `pad.w ≥ zone` | `uwaga` + propozycja |
| `hand-size` | myszka + podana dłoń | `min ≤ dłoń ≤ max` | `uwaga` + propozycja |
| `two-receivers` | klawiatura i myszka mają `2.4ghz` | — | zawsze `info` |
| `color-harmony` | trzy elementy | wszystkie kolory mają ten sam `harmony` z `colors.json` albo `neutralny` | brak komunikatu |

Komunikaty: szablony z `rules.json → checks[].ok/fail`. Wartości w cm z jednym miejscem po przecinku, przecinek dziesiętny: `(mm / 10).toLocaleString('pl-PL', {maximumFractionDigits: 1})`.

### 4.3. Propozycje

| Reguła | Kolejność szukania |
|---|---|
| `pad-width-desk`, `pad-width-mouse` | 1) większy rozmiar tego samego modelu i koloru, 2) najtańsza dostępna podkładka spełniająca regułę z `fit[profil] ≥ 2`, 3) najtańsza dostępna spełniająca regułę |
| `hand-size` | myszka o tym samym kształcie z zakresem obejmującym dłoń; jeśli brak — dowolna obejmująca dłoń; jeśli brak — najbliższy zakres i zdanie „Żadna myszka w katalogu nie jest projektowana na dłoń X cm. Najbliżej: …” |

Propozycja to przycisk w komunikacie: „Zmień na Filc XXL (+50,00 zł)”. Kliknięcie podmienia wariant, przelicza reguły, uruchamia A-06 i wysyła `set_suggestion_apply`.

### 4.4. Przykłady kontrolne (muszą wyjść dokładnie tak)

| Set | Profil | Wymagane | Mata | Wynik |
|---|---|---|---|---|
| Marmur 100 + Jerzyk + Filc XL | fps | 20+440+30+400+20 = 910 mm | 900 mm | uwaga, propozycja: Filc XXL |
| Marmur 100 + Jerzyk + Szron XL | fps | 910 mm | 900 mm | uwaga, propozycja: Tafla XXL (Szron nie ma XXL; Tafla ma `fit.fps = 2`) |
| Bazalt 75 + Pustułka + Szron XL | programowanie | 617 mm | 900 mm | ok, zapas 28,3 cm |
| Kwarc 60 + Jerzyk + Len M | fps | strefa 400 mm | 360 mm | uwaga, propozycja: Len L |
| Jerzyk, dłoń 17 cm | — | 18–20,5 cm | — | uwaga, propozycja: Mewa (16–18,5 cm, ten sam kształt) |
| Łupek 65 + Mewa + Tafla XL, wszystko Kobalt | gry | 688 mm | 900 mm | ok + „Spójna kolorystyka: Kobalt” |

### 4.5. Prezentacja wyników

- Jedna lista wyników pod podglądem, w kolejności: `uwaga`, `ok`, `info`. Ikona + tekst (kolor nie jest jedynym nośnikiem).
- Nagłówek listy: „Pasuje” albo „Pasuje z 1 uwagą” (odmiana przez `PluralRules`).
- Miejsce na listę jest zarezerwowane (min. wysokość dwóch wierszy), więc pojawienie się komunikatu nie przesuwa treści (A-08).
- Region `aria-live="polite"` ogłasza tylko zmianę nagłówka listy, nie każdą regułę.

## 5. Podgląd biurka (komponent `DeskStage`)

Podgląd rysuje się z danych w milimetrach. **Nic nie jest rysowane ręcznie** — elementy to zdjęcia z `assets/manifest.json` albo placeholdery w dokładnych wymiarach.

### 5.1. Geometria

Wewnętrzne płótno ma wymiary w pikselach równe milimetrom (1 px = 1 mm). Zewnętrzny kontener skaluje je do szerokości kolumny:

```
s = szerokość_kontenera_px / płótno.w
wewnętrzne płótno: width = płótno.w px, height = płótno.d px, transform: scale(s), transform-origin: 0 0
kontener: height = płótno.d · s px   (rezerwacja miejsca — zero przesunięć układu)
```

Pozycje (mm, lewy górny róg płótna):

| Sytuacja | Płótno | Podkładka | Klawiatura | Strefa myszki | Myszka |
|---|---|---|---|---|---|
| Brak podkładki | 900 × 400 | prostokąt przerywany „Tu będzie podkładka (XL: 90 × 40 cm)” | x = margin, y = (d − kb.d)/2 | x = margin + kb.w + gap, szer. = zone | środek strefy |
| Mata na biurko | w = max(pad.w, wymagane), d = max(pad.d, kb.d + 2·margin) | x = 0, y = 0 | jw. | jw.; część poza matą w kolorze `--uwaga` | środek strefy |
| Podkładka pod myszkę | w = margin + kb.w + gap + max(pad.w, zone) + margin, d = max(pad.d, kb.d + 2·margin) | x = margin + kb.w + gap | na „blacie” (`--tlo-alt`) | od lewej krawędzi podkładki, szer. = zone | środek podkładki |

Strefa myszki: prostokąt z obrysem przerywanym `--linia-pola`, wysokość = pad.d − 2·margin, podpis „Ruch myszki: 40 cm”. Przy `uwaga` obrys i podpis w `--uwaga`.

### 5.2. Obrazy

| Element | Plik | Rozmiar w płótnie |
|---|---|---|
| Klawiatura | `img/top/{id}_{kolor}_top@1x.webp` + `@2x` w `srcset` (`1x, 2x`) | `kb.w × kb.d` px |
| Myszka | `img/top/{id}_{kolor}_top@1x.webp` + `@2x` | `mouse.w × mouse.d` px |
| Podkładka | `img/tekstury/{id}_{kolor}_tekstura@1x.webp` jako `background-image`, `background-size: 200px 200px` | `pad.w × pad.d` px, `border-radius: 4px` |

Cień pod klawiaturą i myszką: `filter: var(--cien-obiektu)`. Bez cieni wpalonych w zdjęcia.

### 5.3. Placeholdery

Gdy plik ma w manifeście `status: "brak"` — placeholder o tych samych wymiarach: tło `--powierzchnia`, obrys 2 px przerywany `--linia-pola`, w środku nazwa i wymiary („Bazalt 75 · 32,7 × 14 cm”). Rozmiar podpisu kompensuje skalę: `font-size: calc(var(--t-xs) / var(--s))`, gdzie `--s` to zmienna z bieżącą skalą ustawiana na płótnie. Podpis pokazujesz tylko wtedy, gdy placeholder po przeskalowaniu ma co najmniej 80 px szerokości i wysokości — myszka zwykle się nie mieści i zostaje bez podpisu (jej nazwa jest w podsumowaniu i w `aria-label` płótna). Kreator działa w pełni bez ani jednego zdjęcia.

### 5.4. Dostępność

Płótno ma `role="img"` i `aria-label` składany z danych: „Podgląd: Bazalt 75 i Pustułka na macie Szron XL. Zapas 28,3 cm.” Zmienia się razem z wyborem.

## 6. Cena

- Wszystkie kwoty w groszach (liczby całkowite).
- `suma = Σ cena_wariantu` (cena aktualna, z promocją).
- Rabat setu tylko przy komplecie trzech kategorii z `shop.json → set_discount.requires_categories`: `rabat = Math.round(suma · 10 / 100)`.
- Rozbicie rabatu na pozycje (potrzebne do koszyka i pomiaru): `rabat_i = Math.floor(cena_i · rabat / suma)`, reszta groszy do ostatniej pozycji. Suma rozbicia = rabat, sprawdzone testem.
- Wyświetlanie: „Suma 1337,00 zł”, „Rabat za set −133,70 zł”, „Razem 1203,30 zł”, pod spodem „Oszczędzasz 133,70 zł”.
- Niepełny set: „Razem” bez rabatu + zdanie „Dodaj podkładkę, a rabat 10% obejmie cały set (−X zł)”, gdzie X liczony dla najtańszej podkładki spełniającej reguły.
- Licznik „Razem” przewija się przy zmianie (A-04); czytnik ekranu dostaje tylko wartość końcową.

Kontrolnie (z `presets.json`): Programista 1337,00 → 1203,30; FPS 887,00 → 798,30; Cichy open space 1007,00 → 906,30; Kobalt 857,00 → 771,30.

## 7. Set w koszyku

```json
{ "type": "set", "id": "set-1696676400000", "qty": 1, "name": "Twój set", "preset_id": null, "profile": "programowanie",
  "items": [ { "sku": "K-BZL75-GRF-PRG" }, { "sku": "M-PST-GRF" }, { "sku": "P-SZR-XL-GRF" } ] }
{ "type": "item", "sku": "P-TFL-M-KOB", "qty": 2 }
```

- **Ceny nie są zapisywane w koszyku.** Liczone przy każdym wyświetleniu z `products.json` — nie da się pokazać nieaktualnej ceny.
- Ilość dotyczy całej grupy (1–5).
- „Edytuj set” otwiera kreator z tym setem; zapis zastępuje grupę w koszyku.
- Usunięcie jednego elementu: grupa rozpada się na zwykłe pozycje, rabat znika, komunikat „Set rozdzielony — rabat 10% usunięty. Cofnij” (5 s).
- Kod `TAKTYL10` nie obejmuje pozycji w setach. Gdy koszyk ma wyłącznie sety: „Kod nie obejmuje setów — rabat za set jest już naliczony.”
- Wariant bez stanu w secie: grupa oznaczona, przejście do zamówienia zablokowane z komunikatem i przyciskiem „Wybierz inny wariant” (otwiera kreator na tym kroku).

## 8. Stan i adres

```js
// taktyl.set.v1
{ profile: "fps" | null, hand_cm: 19.5 | null,
  k: "K-KWR60-GRF-SLZ" | null, m: "M-JRZ-GRF" | null, p: "P-LEN-XL-GRF" | null,
  switch_set_by_user: false, step: "klawiatura", updated_at: "2026-10-07T16:00:00+02:00" }
```

Adres: `/zbuduj-set?profil=fps&dlon=19.5&k=K-KWR60-GRF-SLZ&m=M-JRZ-GRF&p=P-LEN-XL-GRF&krok=podsumowanie`

- Zmiana wyboru aktualizuje adres przez `history.replaceState` (zmiana kroku — `pushState`, żeby Wstecz cofał krok).
- Nieznany SKU w adresie: pomijany, komunikat „Część setu jest już niedostępna: [kategoria]. Wybierz zamiennik.”
- SKU bez stanu: zostaje wybrany, oznaczony „Brak — wybierz inny wariant”, dodanie do koszyka nieaktywne z wyjaśnieniem.
- Zmiana profilu przelicza reguły; nie zmienia przełącznika, jeśli `switch_set_by_user = true`.

## 9. Dostępność

- Krok = `<fieldset>` z `<legend>`; kafle produktów i wariantów = `<input type="radio">` + `<label>` (strzałki działają natywnie).
- Fokus po „Dalej” przechodzi na nagłówek następnego kroku (`tabindex="-1"`).
- Wszystkie przyciski propozycji mają pełną treść („Zmień na Filc XXL, +50,00 zł”), nie „Zmień”.
- Pasek dolny na telefonie nie zasłania elementu z fokusem.
- Bez przeciągania: wszystko wybiera się kliknięciem lub klawiaturą.

## 10. Zdarzenia (szczegóły w `docs/10`)

`set_builder_start` → `set_profile_select` → `set_step_complete` (×3) → `set_fit_warning` / `set_suggestion_apply` → `set_complete` → `set_share` / `set_save` → `set_add_to_cart` (+ `add_to_cart` z trzema pozycjami).
