# 20 · Zespół agentów i skille

Projekt budują specjaliści (subagenci Claude Code) i skille zapisane w repo: `.claude/agents/` i `.claude/skills/`. Ten dokument mówi, kto za co odpowiada, kiedy kogo wołać i jak pracować z task-managerem. Reguły nadrzędne: `CLAUDE.md`. Decyzje: `docs/adr/`, `docs/decyzje.md`.

## 1. Agenci

| Agent | Zakres | Kiedy wołać | Wejścia | Wyjścia |
|---|---|---|---|---|
| `taktyl-architekt` | granice systemu, ADR-y, kontrakty między aplikacjami, przegląd zgodności z ADR 0001-0009 | nowa decyzja strukturalna, spór o to, gdzie ma żyć logika, zmiana kontraktu | PRD, `docs/14`, ADR-y, propozycja zmiany | ADR (status "propozycja"), wpis w `docs/decyzje.md`, przegląd z listą konsekwencji |
| `taktyl-api` | NestJS, Prisma, migracje, seed, wycena, zamówienia, symulacja płatności, historia cen, `audit_log`, `outbox`, uwierzytelnianie | wszystko po stronie serwera | `docs/16`, `docs/17`, ADR 0003/0005/0006/0007, `data/*.json` | moduły API, migracje, seed, OpenAPI, testy serwera |
| `taktyl-sklep` | `apps/web`: strony, wyspy kliencie, kreator, koszyk, kasa, filtry w URL, pomiar, rewalidacja | każda strona i komponent sklepu | `docs/02`, `03`, `05`, `10`, `docs/14`, kontrakty | strony i komponenty, testy e2e powiązanych S-xx |
| `taktyl-backpanel` | `apps/admin`: ekrany panelu, role, dziennik zmian, wgrywanie zdjęć | każdy ekran backpanelu | `docs/15`, `docs/16`, ADR 0005/0006 | ekrany, formularze ze schematów Zod, testy panelu |
| `taktyl-design-system` | tokeny, mapowanie wzorców Crafto, stany, ruch A-01...A-18, kontrasty | nowy komponent, zmiana wyglądu, audyt wizualny | `docs/06`, `07`, `08`, `tokens.css` | komponenty zgodne z tokenami, raport audytu designu |
| `taktyl-domena` | `packages/domain`: grosze, rabat setu, reguły dopasowania, termin wysyłki, NIP, liczebniki, normalizacja | każda liczba, reguła lub data pokazywana lub liczona | `docs/03`, `04`, `docs/12` §2, `rules.json`, `shop.json` | czyste funkcje i testy Vitest |
| `taktyl-tresci` | opisy, opinie demo, poradniki, strony prawne (wzory), FAQ, mikrocopy | każdy tekst widoczny dla użytkownika | `docs/01` §4, `docs/04` §7-8, `docs/11` | pliki treści "do zatwierdzenia" |
| `taktyl-qa` | scenariusze S1-S36, Playwright, axe, Lighthouse, audyt designu i treści, w Dockerze | przed REVIEW i przed oddaniem etapu | `docs/12`, działający stos `compose` | raport odbioru, zadania BUG |
| `taktyl-straznik-repo` | sekrety, pliki Crafto, dane osobowe, autor commitów, marki, licencje | przed każdym pushem i publikacją | diff, `git ls-files`, ADR-0004/0008 | PRZEPUŚĆ lub ZABLOKUJ z listą naruszeń |
| `taktyl-devops` | Docker Compose, obrazy, proxy z `noindex`, CI, Dependabot, `.env.example`, Makefile | infrastruktura i pipeline | ADR-0009, `docs/14`, `docs/19` | pliki Compose i CI, instrukcja uruchomienia |

## 2. Skille

| Skill | Do czego | Używa go |
|---|---|---|
| `taktyl-start` | kolejność czytania dokumentów, reguły w skrócie | wszyscy, początek sesji |
| `taktyl-funkcja-flow` | cykl zadania: Definition of Ready, statusy, commit z ID i trailerem, definicja ukończenia | wszyscy implementujący |
| `taktyl-audyt-tokenow` | skan kolorów, z-index, `!important`, rozmiarów, czasów; audyt `docs/12` §3 | design-system, sklep, backpanel, qa |
| `taktyl-pieniadze-i-polszczyzna` | grosze, `Intl`, liczebniki, twarde spacje, normalizacja `ł`, strefa Warszawy | domena, api, sklep, backpanel, tresci |
| `taktyl-straznik-repo` | lista kontrolna przed commitem i pushem do publicznego repo | straznik-repo, devops, wszyscy przed commitem |
| `taktyl-audyt-tresci` | zakazane słowa, marki, resztki dema, adresy, logotypy | tresci, qa, straznik-repo |
| `taktyl-admin-sklep-sync` | pole lub encja end-to-end: Prisma, kontrakt, API, panel, sklep, znacznik, test | api, backpanel, sklep |
| `taktyl-port-crafto` | komponent według wzorca Crafto bez kopiowania plików | sklep, design-system |
| `taktyl-odbior` | uruchomienie i raport `docs/12` w Dockerze | qa, architekt |
| `taktyl-docker` | polecenia i diagnostyka Compose | wszyscy, devops |

## 3. Macierz RACI per kamień milowy

R - wykonuje, A - odpowiada (zatwierdza wynik), C - konsultowany, I - informowany. "Człowiek" to właściciel projektu. Plan kamieni milowych: `docs/21`.

| Kamień milowy | architekt | api | sklep | backpanel | design | domena | treści | qa | straznik | devops | Człowiek |
|---|---|---|---|---|---|---|---|---|---|---|---|
| M0 Fundament: monorepo, Docker, CI, tokeny, publikacja repo | R | C | C | C | R | I | I | C | R | R | A |
| M1 Domena i dane: `packages/domain`, schemat, migracje, seed | C | R | I | I | I | R | I | R | I | C | A |
| M2 API sklepu: katalog, wycena, zamówienia, symulacja płatności | A | R | C | I | I | C | I | R | I | C | I |
| M3 Sklep P0: listing, karta, kreator, koszyk, kasa, pomiar | C | C | R | I | R | C | R | R | C | C | A |
| M4 Backpanel P0: logowanie, katalog, ceny i stany, zamówienia, ustawienia, propagacja | A | R | C | R | R | C | I | R | C | C | A |
| M5 Treści i P1: opisy, opinie, poradniki, strony prawne, porównywarka, konto demo | C | C | R | R | C | I | R | R | C | I | A |
| M6 Odbiór i publikacja: pełny `docs/12`, budżet, a11y, higiena repo | A | C | C | C | C | C | C | R | R | R | A |

Zasada: dokładnie jeden A na wiersz zbiorczy po stronie człowieka tam, gdzie decyduje o zakresie lub publikacji; architekt jest A dla spójności technicznej M2 i M4.

## 4. Konwencje task-managera (projekt `taktyl`)

- **Projekt:** slug `taktyl`. Hierarchia: anchor (surowy brief) -> epiki (kamienie milowe M0...M6) -> zadania.
- **Tytuł:** czasownik + obiekt, z ID funkcji, np. "Zaimplementować DeskStage (F-106, A-02)". Zwykłe myślniki, bez em-dash, czysty UTF-8.
- **Opis:** kryteria odbioru z `docs/02`/`docs/15`, odnośniki do dokumentów i ADR.
- **Typ:** `TASK`, `IMPROVEMENT`, `BUG`. **Priorytet:** zgodny z P0/P1/P2 (P0 -> HIGH, P1 -> MEDIUM, P2 -> LOW; CRITICAL tylko pilne i od razu IN_PROGRESS).
- **Tagi (spójne):** obszar `api`, `web`, `admin`, `domain`, `design`, `content`, `qa`, `repo`, `devops` oraz poziom `P0`, `P1`, `P2`.
- **Zależności:** wyłącznie `link_issues(blockerKey, blockedKey)`, nigdy tekst "zależy od". Następne zadanie: `list_issues(projectSlug="taktyl", status="BACKLOG", onlyUnblocked=true)`.
- **Statusy:** BACKLOG -> IN_PROGRESS -> REVIEW -> DEPLOY -> DONE. REVIEW to ocena przez przeglądającego; przy niepowodzeniu `add_comment` z powodem i powrót do IN_PROGRESS. Po zamknięciu `update_issue_stats(humanId, commitHash, linesAdded, linesRemoved)`.
- **CLOSED:** tylko z komentarzem wyjaśniającym powód wcześniej (`add_comment`). Nie usuwamy zadań w trakcie pracy.
- **Definition of Ready:** czytelny tytuł, kryteria, priorytet, brak otwartych pytań.
- **Przed utworzeniem:** sprawdź `list_issues`/`list_epics`, żeby nie duplikować.
- **Błędy z QA:** typ `BUG`, tag `qa` + tag obszaru, `link_issues` do funkcji, którą psują.

## 5. Zasady współpracy

- **ADR:** pisze `taktyl-architekt` (lub specjalista z prośbą do architekta). Status "propozycja" -> **zatwierdza człowiek** (status "przyjęta"). Zmiana ADR-0009 (Docker) lub ADR-0004 (licencja) zawsze przez człowieka.
- **Kiedy pytać człowieka:** brak odpowiedzi w dokumentach (reguła 11), zmiana wartości tokenu, wątpliwość prawna w treściach, wyjątek od listy strażnika repo, publikacja i push, każda decyzja kosztowa lub nieodwracalna, wszystko z listy `Q-xx` w `docs/decyzje.md`. Pytanie zapisz jako `Q-xx` z domyślną odpowiedzią.
- **Drobne decyzje** zgodne z tokenami i ADR specjalista podejmuje sam i wpisuje do `docs/decyzje.md` (data, ID, decyzja, powód).
- **Kolejność kontroli przed REVIEW:** `taktyl-audyt-tokenow`, `taktyl-audyt-tresci`, `taktyl-pieniadze-i-polszczyzna` (gdy dotyczy), testy w kontenerze `test`, `taktyl-straznik-repo`.
- **Granice:** logika liczb i reguł tylko w `packages/domain`; backend nie ufa kwotom klienta; panel i sklep współdzielą schematy z `packages/contracts` i tokeny z `packages/tokens`.
- **Publikacja:** push do publicznego repo dopiero po PRZEPUŚĆ od `taktyl-straznik-repo` i zgodzie człowieka.
- **Wspólne twarde zasady:** zero własnej grafiki, zero prawdziwych marek, zero sekretów w repo, całość w Dockerze, ID funkcji w komentarzu i commicie.

## 6. Jak wywołać specjalistę

- W Claude Code: poproś o agenta po nazwie ("użyj `taktyl-domena`, żeby zaimplementować pad-width-desk") albo niech sesja główna deleguje przez narzędzie Agent z `subagent_type` równym nazwie z `.claude/agents/`. Agenci projektu ładują się przy starcie sesji w katalogu projektu.
- Skill: napisz `/<nazwa-skilla>` (np. `/taktyl-start`) albo poproś o jego użycie przy zadaniu.
- Dobry prompt: ID funkcji, dokument źródłowy, oczekiwany wynik, kryterium ukończenia. Przykład: "taktyl-sklep: zrealizuj F-021 i F-022 wg `docs/04` §6 i `docs/05` §3, testy S1-S4, zadanie TAKTYL-12".
- Równoległość: niezależne zadania (np. domena i infrastruktura) uruchamiaj naraz; zadania zależne tylko po zwolnieniu blokera w task-managerze.
- Agent `taktyl-straznik-repo` nie ma narzędzi MCP: jego raport do task-managera przenosi wywołujący.
