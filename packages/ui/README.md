# @taktyl/ui

Biblioteka komponentów React 19 sklepu (`apps/web`) i backpanelu (`apps/admin`), decyzja D-007. Styl pochodzi wyłącznie z tokenów (`@taktyl/tokens`); w kodzie nie ma kolorów, odstępów ani czasów wpisanych wprost (`pnpm audit:tokens`). Ikony i zdjęcia dostarcza człowiek (reguła 1), biblioteka niczego nie rysuje.

## Użycie

Kolejność arkuszy: `@taktyl/tokens/tokens.css`, `@taktyl/tokens/taktyl.css`, `@taktyl/ui/ui.css`. Peer: `react`, `react-dom` 19.

```tsx
import { Button, Field } from "@taktyl/ui";
```

Ikony: `<Icon name="search" />` renderuje `span.tk-icon.tk-icon--search` z `aria-hidden`. Glify pochodzą z lokalnego overlaya z fontem ikon szablonu (ADR-0004), którego nie ma w repo; bez niego ikony są niewidoczne.

## Komponenty podstawowe (TAKTYL-24)

Stany obowiązkowe (`docs/06` §5): spoczynek, najechanie, fokus (`:focus-visible` 3 px `--fokus`), wciśnięcie, nieaktywny, ładowanie, błąd. Tam, gdzie stan nie dotyczy komponentu, pole jest puste.

| Komponent                         | Stany i uwagi                                                                                                                                                   | Ruch       |
| --------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- |
| `Button` (`primary`, `secondary`) | spoczynek, hover, fokus, wciśnięcie (`:active` i klasa `is-wcisniety` po Enter/Spacji), `disabled`, `loading` (`aria-busy`, etykieta zostaje, klik zablokowany) | A-01, A-18 |
| `Link`, `TextButton`              | hover (grubsze podkreślenie), fokus, `disabled` (tylko `TextButton`)                                                                                            |            |
| `IconButton`                      | 44 x 44, `aria-label` wymagany w typie, `pressed` daje `aria-pressed`, `disabled`                                                                               | A-01       |
| `Swatch`                          | radio; wybrana (pierścień `--akcent` + pogrubiona nazwa), `unavailable` (przekreślenie + „Brak”), fokus; kolor z `data/colors.json` jako prop `swatch`          | A-05       |
| `ChoiceTile`                      | radio-kafel; wybrany (obrys, tło `--akcent-slaby`, znacznik), `unavailable` („Brak”), fokus                                                                     | A-05       |
| `FilterChip`                      | 44 px; aktywny (`aria-pressed`, ikona „×”), `disabled`                                                                                                          | A-01       |
| `Badge`                           | `nowosc`, `bestseller`, `promocja`, `ostatnie-sztuki`, `brak`                                                                                                   |            |
| `Field`                           | etykieta nad polem; podpowiedź; błąd (`aria-invalid`, `aria-describedby`, ikona + tekst); `disabled`; `as` = `input` / `textarea` / `select`                    |            |
| `Alert` (`InlineMessage`)         | `sukces`, `uwaga`, `blad`, `info`; ikona + tekst + ukryty prefiks dla czytnika                                                                                  |            |
| `SpecTable`                       | `<table>` z `<th scope="row">` i podpisem                                                                                                                       |            |
| `Quantity`                        | − / liczba / +, każdy 44 x 44; na granicy zakresu przycisk nieaktywny                                                                                           | A-01       |
| `Kbd`                             | `<kbd>`; `pressed` dla użytego skrótu                                                                                                                           | A-17       |
| `VisuallyHidden`                  | tekst tylko dla czytnika                                                                                                                                        |            |

## Moduł nakładek (TAKTYL-25)

Wspólny kod (`src/overlay/`): `useOverlayBehavior` (Esc tylko dla górnej nakladki stosu, fokus na wejściu, powrót fokusu do wywołującego, utrzymanie fokusu w panelu, blokada przewijania przez klasę `tk-scroll-lock` na `<html>`), `trapTab`, `usePresence` (animacja wyjścia; bez animacji w CSS albo przy `prefers-reduced-motion` element znika od razu; `animationend` z potomków jest ignorowany).

| Komponent                                                    | Zachowanie                                                                                                                                                                                                                    | Ruch                                                                                                             |
| ------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| `Drawer` (`side` prawa/lewa), `Dialog` (oba przez `Overlay`) | portal w `<body>`, `role="dialog"`, `aria-modal`, nazwa z widocznego tytułu, przycisk „Zamknij”, zamykanie na tło (`closeOnBackdrop`), `100dvh`, `keepMounted` zostawia zamkniętą nakładkę z `hidden`, warstwa `--z-nakladka` | A-12: szuflada `translateX`, okno `opacity` + `scale(.98 -> 1)`, tło `opacity`; wejście `--d-m`, wyjście `--d-s` |
| `Menu`, `MenuLink`, `MenuButton`                             | wzorzec „disclosure”: `aria-expanded`, `aria-controls`, Esc oddaje fokus przyciskowi, klik poza menu i wyjście fokusu zamykają bez kradzieży fokusu, strzałki, Home, End                                                      | A-12: `opacity` + `translateY(-4px -> 0)`, `--d-s`                                                               |
| `ToastProvider`, `useToast`, `ToastRegion`                   | region `role="status"` istnieje przed treścią, maks. 3 toasty, 4 s, pauza na najechanie i fokus, opcjonalne „Cofnij”, brak `alert`/`confirm`/`prompt`; toast ma `.sekcja--mod`, `--cien-2`, warstwę `--z-toast`               | A-15: wejście `translateY(16px -> 0)` + `opacity` (`--d-m`), wyjście samo `opacity` (`--d-s`)                    |

## Obraz produktu (TAKTYL-26)

`ProductImage` (alias `Picture`) czyta wpis `ManifestEntry` zgodny z `assets/manifest.json` (`key`, `kind`: `packshot` / `topdown` / `texture`, `dims_mm`, `files`, `pixels`, `status`: `gotowe` / `brak`). Pomocnicze: `buildSrcSet`, `intrinsicSize`, `packshotAlt`, `topdownCaption`, `findManifestEntry`.

| Status   | Rodzaj     | Wynik                                                                                                                                                                                |
| -------- | ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `gotowe` | wszystkie  | `<img>` z `srcset` (packshot: szerokości `w`, pozostałe: gęstość `x`), `sizes`, `width`, `height`, `alt`; `priority` daje `loading="eager"` i `fetchpriority="high"`, inaczej `lazy` |
| `brak`   | `packshot` | kwadrat `--tlo-alt`: nazwa produktu, kolor, „zdjęcie w przygotowaniu”; `role="img"` z nazwą                                                                                          |
| `brak`   | `topdown`  | prostokąt `dims_mm` w płótnie 1 px = 1 mm, `--powierzchnia`, obrys 2 px przerywany `--linia-pola`, podpis „Bazalt 75 · 32,7 × 14 cm”                                                 |
| `brak`   | `texture`  | prostokąt wypełniony kolorem próbki z `colors.json -> swatch` (prop `swatch`), obrys 1 px `--linia-pola`                                                                             |

Zdjęcie i placeholder mają te same klasy rozmiaru i te same zmienne `--tk-w`, `--tk-d` oraz `aspect-ratio`, więc podmiana nie przesuwa układu (CLS = 0). Alt ujęcia produktowego: „{nazwa} w kolorze {kolor}, {opis ujęcia}” (`docs/09` §4.4); elementy podglądu biurka i miniatury mają `alt=""` (domyślnie dla `topdown` i `texture`).

## Testy

`pnpm --filter @taktyl/ui test` (Vitest, jsdom, Testing Library, user-event, `vitest-axe`). Całość weryfikujemy w Dockerze (`node:22-alpine`).
