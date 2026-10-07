---
name: taktyl-audyt-tokenow
description: Audyt zgodności wyglądu z tokenami Taktyla - szukanie kolorów wpisanych wprost, rozmiarów, z-index, !important, wartości spoza skali, plus audyt designu z docs/12 §3 w przeglądarce. Użyj przed REVIEW każdego zadania dotykającego CSS/TSX i w CI.
---

# taktyl-audyt-tokenow

Cel: reguła 2 z `CLAUDE.md`. Kolor, odstęp, promień, cień, rozmiar czcionki, czas i krzywa istnieją wyłącznie jako zmienne w `:root` (`packages/tokens`, kopia `assets/tokens.css`).

## A. Skan statyczny (uruchamiaj w kontenerze lub w repo)
Poza plikiem tokenów wynik ma być pusty. Wyjątek: kolory próbek z `data/colors.json -> swatch` (dane, nie style).

```
# kolory wprost
rg -n --glob '!**/tokens.css' --glob '!node_modules' --glob '!.next' --glob '!data/**' -e '#[0-9a-fA-F]{3,8}\b' -e 'rgba?\(' -e 'hsla?\(' apps packages
# z-index spoza tokenów
rg -n 'z-index\s*:\s*(?!var\(--z-)' --pcre2 apps packages --glob '*.{css,scss,tsx,ts}'
# !important (dozwolone tylko [hidden])
rg -n '!important' apps packages --glob '*.{css,scss,tsx,ts}'
# rozmiary i odstępy w px/rem/em poza tokenami
rg -n '(font-size|margin|padding|gap|border-radius|box-shadow)\s*:\s*[^;]*\b\d+(\.\d+)?(px|rem|em)\b' apps packages --glob '*.{css,scss}' --glob '!**/tokens.css'
# czasy i krzywe animacji wprost
rg -n '(transition|animation)[^;]*\b\d+(ms|s)\b' apps packages --glob '*.{css,scss}' --glob '!**/tokens.css'
rg -n 'cubic-bezier\(' apps packages --glob '!**/tokens.css'
# animowane wymiary
rg -n '(transition|animation)[^;]*(width|height|top|left|margin|padding|font-size)' apps packages --glob '*.{css,scss}'
# biblioteki animacji i CDN
rg -n -i 'gsap|scrolltrigger|wow\.js|aos|anime(\.js)?|atropos|framer-motion|https?://(cdn|fonts)\.' apps packages package.json
```
Zwykłe wyjątki do uzasadnienia: 1 px obrysu (`--linia`), `0`, `100%`, `auto`, `44px` jako min. cel dotykowy (jeśli nie ma tokenu - zgłoś).

## B. Audyt w przeglądarce
Na każdej stronie P0 (stos z `docker compose`, build produkcyjny) uruchom skrypt z `docs/12` §3 w konsoli albo w Playwright (`page.evaluate`). Oczekiwane:
- `rozmiarow` <= 7, `rodzin` = 1, `wariantow_przycisku_glownego` = 1,
- `promieni`: tylko `10px`, `999px` (oraz `0px` dla przycisków bez tła),
- `male_cele` = [] (wyjątek: odnośniki w ciągłym tekście), `zdublowane_id` = [].

## C. Raport
Tabela: plik:linia | wzorzec | proponowany token. Brakujący token = decyzja człowieka (`Q-xx`), nie wartość "na chwilę". Kolor nie może być jedynym nośnikiem informacji; sprawdź pary kontrastów z `docs/06` §2 przy zmianie komponentu.
