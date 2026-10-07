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

## Testy

`pnpm --filter @taktyl/ui test` (Vitest, jsdom, Testing Library, user-event, `vitest-axe`). Całość weryfikujemy w Dockerze (`node:22-alpine`).
