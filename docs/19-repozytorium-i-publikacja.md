# 19 · Repozytorium i publikacja

Repo jest publiczne i służy jako wizytówka. Podstawa: `docs/adr/0008-publiczne-repo-higiena.md`, `docs/adr/0004-szablon-crafto-i-licencja.md`. Historia git jest publiczna na zawsze, więc wszystkie kontrole działają **przed** commitem i pushem.

## 1. Co jest, a czego nie ma w repozytorium

| Jest w repo | Nie ma w repo | Mechanizm |
|---|---|---|
| Kod własny (MIT), dokumentacja, ADR | Pliki szablonu Crafto: `html/`, `vendor/`, paczki `.zip` | `.gitignore`, `kontrola-sciezek` |
| `data/` (dane fikcyjne), `_generator.py` | Sekrety: `.env`, hasła, klucze, tokeny, `REVALIDATE_SECRET` | `.gitignore`, `gitleaks` |
| `.env.example` z placeholderami `CHANGE_ME` | Dane osobowe: prawdziwe e-maile, telefony, adresy, NIP-y | reguła 5 `CLAUDE.md`, skan wzorców |
| Tokeny, font Archivo z `OFL.txt`, manifest zdjęć | Pliki IDE i lokalne: `.idea/`, `.vscode/` (poza współdzielonymi), `.claude/settings.local.json` | `.gitignore` |
| Definicje agentów i skilli (`.claude/agents`, `.claude/skills`) | Zrzuty bazy: `*.sql`, `*.dump` (poza `seed/`) | `.gitignore` |
| Konfiguracja Docker i CI | `docker-compose.crafto.yml` (lokalny overlay z szablonem) | `.gitignore` |
| Zdjęcia dostarczone przez człowieka, po przeglądzie | Cudze marki, zdjęcia z dema szablonu, wygenerowane ikony | skill `taktyl-audyt-tresci` |

## 2. Lista kontrolna przed pierwszym pushem

1. `git status` i `git ls-files`: brak `html/`, `vendor/`, `.env*` (poza `.env.example`), `.idea/`, `*.zip`, `*.sql`, `*.dump`.
2. Skan sekretów: `gitleaks detect` na całej historii lokalnej (w kontenerze); wynik zero.
3. Skan danych osobowych: brak prawdziwych adresów e-mail (poza `@taktyl.example` i adresem `noreply` GitHuba), telefonów, NIP-ów w plikach i w `git log`.
4. `git config user.email` ustawiony na adres `…@users.noreply.github.com`; `git log --format='%ae'` nie zawiera innego adresu.
5. `.env.example` ma wyłącznie placeholdery; żadna wartość nie jest działającym sekretem.
6. `LICENSE` (MIT), `SECURITY.md`, `CONTRIBUTING.md`, `CODE_OF_CONDUCT.md`, `README.md` obecne; README mówi, że sklep jest fikcyjny i że szablon nie jest dołączony.
7. Audyt treści: brak prawdziwych marek, logotypów płatności i przewoźników, lorem ipsum, treści dema szablonu.
8. Audyt tokenów: zero trafień `#[0-9a-fA-F]{3,8}` i `rgb(` poza plikiem tokenów (wyjątek: `colors.json → swatch`).
9. Pierwszy commit zawiera tylko to, co świadomie dodano; przejrzany `git diff --cached --stat`.
10. Dopiero potem `git push`; repo tworzone jako publiczne po przejściu punktów 1–9.

## 3. Lista kontrolna przed każdym wydaniem

- CI zielone na `main` (wszystkie joby z §5).
- `docker compose up --build` na czystym klonie działa (README bez zmian w krokach).
- Testy odbioru S1–S25 (`docs/12`) przechodzą w kontenerze `test`.
- Budżet wydajności i audyt designu zmierzone na stosie produkcyjnym z Compose.
- `CHANGELOG` zaktualizowany; wersja zgodna z §7.
- Zależności: `audit-deps` bez poziomu high/critical; obrazy bazowe przypięte.
- Przegląd `docs/decyzje.md`: brak pytań blokujących wydanie.
- Skill `taktyl-straznik-repo` uruchomiony i bez uwag.

## 4. Ochrona gałęzi `main`

- Zmiany tylko przez pull request; co najmniej jedna akceptacja (CODEOWNERS).
- Wymagane statusy: wszystkie joby z §5.
- Gałąź aktualna względem `main` przed scaleniem; historia liniowa (squash lub rebase).
- Zakaz force-push i usuwania gałęzi.
- Włączone: skanowanie sekretów z push protection, Dependabot alerts i updates, prywatne zgłaszanie podatności.
- Podpisywanie commitów zalecane.

## 5. CI (nazwy jobów)

| Job | Co sprawdza | Blokuje scalenie |
|---|---|---|
| `lint` | ESLint, Prettier | tak |
| `typecheck` | TypeScript strict we wszystkich pakietach | tak |
| `unit` | Vitest: `domain`, `contracts`, API (`docs/12` §2) | tak |
| `e2e-docker` | pełny stos z Compose, start od `db:reset-demo`, Playwright S1–S25 | tak |
| `a11y` | axe-core na stronach P0, WCAG 2.1 AA | tak |
| `perf-budget` | budżet z `docs/12` §4 (Lighthouse CI na buildzie produkcyjnym) | tak |
| `gitleaks` | sekrety w kodzie i historii | tak |
| `audyt-tokenow` | wzorce kolorów, rozmiary fontów, `z-index`, `!important` poza tokenami | tak |
| `kontrola-sciezek` | żadna ścieżka zakazana (`html/`, `vendor/`, `*.zip`, `.env*` poza przykładem) nie jest śledzona | tak |
| `audit-deps` | `pnpm audit`, przegląd licencji zależności | tak (high/critical) |

## 6. Konwencja commitów

Format: `typ(zakres): opis [ID]`, po polsku lub angielsku konsekwentnie, w trybie rozkazującym. Typy: `feat`, `fix`, `docs`, `refactor`, `test`, `chore`, `ci`, `build`.

- ID funkcji w nawiasie kwadratowym: `F-xxx`, `A-xx`, `B-xxx`, `I-xxx` (reguła 8 `CLAUDE.md`). Przykład: `feat(web): dodaj filtr ceny [F-021]`.
- Dla pracy z task-managerem: klucz zadania w treści (`TAKTYL-12`).
- Commity tworzone z udziałem Claude kończą się trailerem:

```
Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>
```

- Autor: nazwa użytkownika GitHub i adres `noreply`. Bez adresów prywatnych.
- Zakaz commitów z sekretami, nawet „tymczasowo”.

## 7. Wersjonowanie

SemVer: `0.x` do czasu spełnienia wszystkich punktów P0 z `docs/12`, `1.0.0` po ich spełnieniu. Tagi `vMAJOR.MINOR.PATCH`, wydania z notkami na GitHubie generowanymi z commitów i `CHANGELOG.md` (Keep a Changelog). Zmiana kontraktu API w `packages/contracts` = zmiana MINOR do `1.0.0`, potem MAJOR.

## 8. CODEOWNERS

Plik `.github/CODEOWNERS` (do dodania razem z pierwszym kodem):

```
*                       @Mariusz8Walczak
/docs/adr/              @Mariusz8Walczak
/.github/               @Mariusz8Walczak
/data/                  @Mariusz8Walczak
/assets/tokens.css      @Mariusz8Walczak
```

Zmiany w `docs/adr/`, `data/`, tokenach i konfiguracji CI wymagają akceptacji właściciela.

## 9. Szablony zgłoszeń i PR

- `.github/pull_request_template.md`: ID funkcji, opis, kryteria z `docs/12`, Definicja ukończenia, lista „nie zawiera sekretów ani plików szablonu”.
- `.github/ISSUE_TEMPLATE/zadanie.md`: ID, cel, kryteria odbioru, priorytet, zależności.
- `.github/ISSUE_TEMPLATE/blad.md`: kroki, oczekiwane i faktyczne, środowisko (Docker), ID funkcji.
- Pytania do dokumentacji: pytanie w `docs/decyzje.md` (reguła 11), nie zgadywanie.

## 10. Zgłoszenia bezpieczeństwa

- Kanał: GitHub Security Advisories (prywatne zgłoszenie) — opis w `SECURITY.md`. Nie ma adresu e-mail do zgłoszeń.
- Potwierdzenie w ciągu 7 dni, ocena i plan w ciągu 14 dni, poprawka i advisory po naprawie.
- Zakres: kod z repo i konfiguracja Docker. Poza zakresem: sklep jest fikcyjny, nie ma prawdziwych płatności ani danych klientów.
- Zgłoszenia nie trafiają do publicznych issue.

## 11. Gdy sekret wycieknie

Samo usunięcie pliku z repozytorium **nie wystarcza**: sekret zostaje w historii, forkach i cache.

1. **Zrotuj sekret natychmiast** u źródła (nowe hasło, nowy `SESSION_SECRET`, nowy `REVALIDATE_SECRET`, nowy token). Uznaj stary za skompromitowany.
2. Sprawdź logi i `audit_log` pod kątem użycia starego sekretu.
3. Usuń sekret z historii (`git filter-repo`) i wymuś push wyłącznie w uzgodnieniu z właścicielem; poinformuj o konieczności ponownego sklonowania.
4. Poproś GitHub o usunięcie zbuforowanych widoków i unieważnij ewentualne forki, jeśli to możliwe.
5. Dopisz przyczynę i poprawkę procesu do `docs/decyzje.md`; dodaj regułę do `gitleaks`, jeśli skaner nie wykrył wycieku.
6. Jeśli wyciekły dane osobowe, oceń obowiązek zgłoszenia; w demo nie powinno ich być (ADR-0007).
