---
name: taktyl-odbior
description: Jak uruchomić i raportować odbiór Taktyla według docs/12 w Dockerze - scenariusze S1-S36, testy logiki, audyt designu, budżet wydajności, kontrola treści, a11y. Użyj przed oddaniem etapu, przed publikacją i przy zgłoszeniu "czy to jest gotowe".
---

# taktyl-odbior

Warunek oddania: wszystkie punkty P0 z `docs/12` zielone. Wartości oczekiwane wynikają z `data/`; rozbieżność to błąd kodu, nie testu. Wszystko na **stosie produkcyjnym z compose** (ADR-0009).

## Uruchomienie
```
cp .env.example .env                                  # jeśli brak; uzupełnij lokalne sekrety
docker compose up --build -d                          # db, migrate, seed, api, web, admin, proxy
docker compose --profile test run --rm test           # reset-demo -> Vitest -> Playwright -> axe -> Lighthouse
docker compose logs --tail=100 api web admin          # diagnostyka przy czerwonych testach
docker compose down                                   # sprzątanie (dodaj -v tylko gdy chcesz skasować dane)
```
Testy zaczynają od `db:reset-demo`, więc wynik nie zależy od wcześniejszych edycji w backpanelu.

## Zakres
| Obszar | Źródło | Czym |
|---|---|---|
| Scenariusze sklepu S1-S24 | `docs/12` §1 | Playwright |
| Backpanel i propagacja S25-S36 | `docs/12` §7 | Playwright (np. S25: zmiana ceny Wróbla widoczna na `/myszki/wrobel` w <= 5 s z przeliczoną "najniższą z 30 dni") |
| Logika | `docs/12` §2 | Vitest (`packages/domain`, API) |
| Design | `docs/12` §3 | skrypt w `page.evaluate` na stronach P0, skill `taktyl-audyt-tokenow` |
| Wydajność | `docs/12` §4 | Lighthouse CI (komórka), skrypt zasobów (obce domeny = 0) |
| Treść | `docs/12` §5 | skill `taktyl-audyt-tresci` |
| Dostępność | `docs/12` §6 | axe-core + ręcznie: klawiatura, 360 px, fokus, reduced-motion |
| Pomiar | `docs/10` §7 | ścieżka z `?pomiar=1`: jeden `purchase`, `payment_failed` przed nim |

## Raport (format)
```
Odbior RRRR-MM-DD · commit <hash> · stos: compose (build produkcyjny)
| # | Scenariusz | Wynik | Dowód (trace/screenshot) |
Budżet: JS ... KB / CSS ... KB / LCP ... / CLS ... / INP ... / obce domeny: [] 
Audyt designu: rozmiarow=… rodzin=… wariantow=… promieni=… male_cele=… zdublowane_id=…
Treść: zero trafień / lista
Niespełnione: lista z ID funkcji i zadaniem BUG w task-managerze
```
Niespełniony punkt raportujesz wprost, bez zaokrąglania; każdy błąd to zadanie typu BUG (tag `qa`, `link_issues` do funkcji). Artefaktów z danymi lokalnymi nie commitujesz.

## Zasady
- Nie osłabiaj asercji, by przeszły; nie pomijaj scenariusza bez komentarza w zadaniu.
- NIP-y w testach generowane z sumy kontrolnej, nigdy stałe (reguła 5).
- Zegar testów ustawiony (strefa `Europe/Warsaw`), nie zależy od dnia uruchomienia.
- Pomiar budżetu tylko na buildzie produkcyjnym, nie w trybie `dev`.
