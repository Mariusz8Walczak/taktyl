---
name: taktyl-pieniadze-i-polszczyzna
description: Zasady kwot w groszach i polszczyzny przez API przeglądarki w Taktylu - Intl.NumberFormat, Intl.PluralRules, twarde spacje, normalizacja ł, strefa Europe/Warsaw, rabat setu bez reszty groszowej. Użyj przy każdym kodzie pokazującym kwotę, liczbę, datę, odmianę lub wyszukiwanie.
---

# taktyl-pieniadze-i-polszczyzna

Reguła 7 z `CLAUDE.md`, pułapki 5-9, 20-22, 25 z `docs/11`. Logika żyje w `packages/domain`; nie pisz własnych kopii.

## Pieniądze
- Liczysz w **groszach** (liczby całkowite). Z JSON-a: `Math.round(zł * 100)` raz, przy wejściu. Baza trzyma `Int`.
- Nigdy `0.1 + 0.2` na złotych. Nigdy `parseFloat` do sumowania.
- Rabat setu: `rabat = Math.round(suma * 10 / 100)`; rozbicie `rabat_i = Math.floor(cena_i * rabat / suma)`, reszta groszy do ostatniej pozycji; test: suma rozbicia = rabat.
- Rabat liczony od ceny **aktualnej**, nie `regular_price`. Przekreślona w promocji jest `lowest_30d` (Omnibus), nie `regular_price`.
- Cena nie jest zapisywana w koszyku; liczona przy wyświetleniu (`POST /cart/quote`).
- Kontrole: Programista 1337,00 -> 1203,30; FPS 887,00 -> 798,30; Cichy open space 1007,00 -> 906,30; Kobalt 857,00 -> 771,30.

## Formatowanie (zawsze przez Intl)
```js
new Intl.NumberFormat('pl-PL', { style: 'currency', currency: 'PLN' }).format(gr / 100)
new Intl.PluralRules('pl').select(n)        // one / few / many / other
n.toLocaleString('pl-PL')                    // 26 000 DPI
(mm / 10).toLocaleString('pl-PL', { maximumFractionDigits: 1 })
new Intl.DateTimeFormat('pl-PL', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'Europe/Warsaw' })
```
Nie poprawiasz wyniku `Intl` ręcznie ("1203,30 zł", "12 999,00 zł"). Zakazane: `"1299.00 PLN"`, `"1,299.00 zł"`, `toFixed` do wyświetlania.

## Liczebniki
Zawsze `Intl.PluralRules('pl')`: 0 produktów, 1 produkt, 2 produkty, 5 produktów, 12 produktów, 22 produkty, 112 produktów. Nigdy "2 produktów", "5 produkty".

## Typografia
- Twarda spacja (U+00A0) między liczbą a jednostką ("49 g", "90 cm", "299 zł") i po jednoliterowych spójnikach/przyimkach w nagłówkach (w, z, i, a, o, u).
- Cudzysłowy polskie „…", półpauza w zakresach słownych, łącznik bez spacji w zakresach liczbowych z jednostką ("60-80 g" w danych, wg `docs/01` §4 w treści).
- Cyfry tabelaryczne (`tnum`), `font-variant-numeric: tabular-nums` przy cenach.

## Wyszukiwanie
```js
const norm = s => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/ł/g, 'l');
```
`ł` nie rozkłada się w NFD - osobna linia jest obowiązkowa ("lupek" znajduje "Łupek").

## Czas
Strefa `Europe/Warsaw` podawana jawnie; zegar wstrzykiwany do funkcji. Dzień roboczy przed 14:00 -> "Wysyłka dziś", po 14:00 -> następny dzień roboczy, weekend -> poniedziałek; dostawa = wysyłka + `eta_business_days`. Przypadki: środa 7.10.2026 13:00, 15:00; sobota 10.10.

## Kontrola przed REVIEW
```
rg -n 'toFixed\(|parseFloat\(|\bPLN\b|\+ *" zł"|\$\{[^}]*\} zł' apps packages --glob '*.{ts,tsx}'
rg -n '[0-9] (g|cm|mm|zł|Hz|DPI)\b' apps packages docs data --glob '!**/node_modules/**'   # zwykła spacja przed jednostką = do poprawy
```
Testy z `docs/12` §2 (ceny, liczebniki, formatowanie, termin wysyłki, wyszukiwanie) muszą być zielone.
