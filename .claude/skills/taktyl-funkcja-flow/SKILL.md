---
name: taktyl-funkcja-flow
description: Procedura realizacji jednego zadania Taktyla po ID funkcji (F-xxx, A-xx, B-xxx, I-xxx) od Definition of Ready, przez statusy w task-managerze, commit z ID i trailerem, po definicję ukończenia. Użyj przy każdym zadaniu implementacyjnym.
---

# taktyl-funkcja-flow

## 1. Definition of Ready (przed IN_PROGRESS)
- [ ] Tytuł: czasownik + obiekt, z ID, np. "Zaimplementować DeskStage (F-106, A-02, A-06)".
- [ ] Kryteria odbioru w opisie (z `docs/02` lub `docs/15`), priorytet i tagi ustawione (obszar + `P0/P1/P2`).
- [ ] Zależności jako `link_issues`, nie tekst; `list_issues(projectSlug="taktyl", status="BACKLOG", onlyUnblocked=true)` pokazuje zadanie.
- [ ] Brak otwartych pytań. Jeśli jest: dopisz `Q-xx` do `docs/decyzje.md` i zapytaj człowieka.

## 2. Realizacja
1. `move_issue_status(humanId, IN_PROGRESS)`.
2. Przeczytaj dokument funkcji i właściwe ADR (skill `taktyl-start`).
3. Zbuduj funkcję. W komentarzu nad kodem podaj ID oraz (dla komponentów) nazwę wzorca z `docs/08`.
4. Drobne decyzje zgodne z tokenami: wpis w `docs/decyzje.md` (data, ID, decyzja, powód).
5. W trakcie `add_comment` z postępem lub blokadą.
6. Kontrole przed REVIEW: `taktyl-audyt-tokenow`, `taktyl-audyt-tresci`, `taktyl-pieniadze-i-polszczyzna` (jeśli dotyczy), testy w kontenerze `test`, `taktyl-straznik-repo`.

## 3. Commit
- Opis zawiera ID i krótki powód, np. `F-106 A-02: DeskStage z placeholderami w skali 1 px = 1 mm`.
- Trailer na końcu: `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`.
- Autor: nazwa GitHub + adres `noreply` (ADR-0008). Nie commituj sekretów, `html/`, `vendor/`, `.env`.
- Commituj tylko na prośbę człowieka lub gdy plan pracy tego wymaga; domyślnie na gałęzi roboczej, nie na `main`.

## 4. Zamknięcie
`move_issue_status`: REVIEW -> (po przejściu przeglądu) DEPLOY -> DONE, potem `update_issue_stats(humanId, commitHash, linesAdded, linesRemoved)`. Porzucenie: `add_comment` z powodem, dopiero potem CLOSED.

## 5. Definicja ukończenia (z CLAUDE.md)
Zadanie jest skończone, gdy: spełnia właściwe punkty `docs/12`, działa z klawiatury i na 360 px, nie dodało wartości spoza tokenów, nie zostawiło treści z dema szablonu. Dodatkowo: działa w Dockerze, ma testy, ID w kodzie i commicie.

Zwykłe myślniki w tytułach i opisach task-managera (bez em-dash).
