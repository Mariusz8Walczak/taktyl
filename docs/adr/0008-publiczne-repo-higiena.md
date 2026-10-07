# ADR-0008 · Publiczne repozytorium: higiena i bezpieczeństwo

- **Status:** przyjęta

Repo jest wizytówką właściciela. Każdy commit jest publiczny na zawsze (historia git), więc zasady działają **przed** commitem, nie po.

## Czego nigdy nie ma w repozytorium

| Kategoria | Przykłady | Mechanizm |
|---|---|---|
| Sekrety | `.env`, hasła, klucze, tokeny, `REVALIDATE_SECRET` | `.gitignore`, gitleaks (pre-commit i CI), tylko `.env.example` |
| Płatne zasoby | `html/`, `vendor/`, paczki `.zip` szablonu | `.gitignore`, kontrola ścieżek w CI (ADR-0004) |
| Dane osobowe | prawdziwe e-maile, telefony, adresy, NIP-y właściciela | reguła 5 `CLAUDE.md`; e-mail commitów: adres `noreply` GitHuba; skan wzorców w CI |
| Pliki IDE i lokalne | `.idea/`, `.vscode/` (poza współdzielonymi), `.claude/settings.local.json` | `.gitignore` |
| Cudze marki, zdjęcia, ikony | patrz `docs/09`, `docs/11` | `taktyl-audyt-tresci` |
| Zrzuty z bazy z prawdziwymi danymi | dumpy | `.gitignore` (`*.sql`, `*.dump` poza `seed/`) |

## Co jest w repozytorium

Kod własny (MIT), dokumentacja, `data/` (dane fikcyjne), tokeny, font Archivo z licencją OFL, manifest zdjęć, definicje agentów i skilli, konfiguracja Dockera i CI.

## Zasady procesu

1. Gałąź `main` chroniona: PR, zielone CI (lint, typy, testy, gitleaks, audyt tokenów, kontrola ścieżek), brak force-push.
2. Commity: opis zawiera ID funkcji (`F-xxx`, `A-xx`, `B-xxx`, `I-xxx`), reguła 8 `CLAUDE.md`.
3. Commit-autor: nazwa użytkownika GitHub + adres `…@users.noreply.github.com`.
4. Dependabot dla zależności, `pnpm audit` w CI, przypięte wersje obrazów Docker.
5. Każda publikacja zaczyna się skillem `taktyl-straznik-repo` (lista kontrolna przed pushem).
6. `SECURITY.md` z adresem zgłoszeń w domenie `taktyl.example` lub przez GitHub Security Advisories.
7. README mówi wprost: sklep jest fikcyjny, szablon nie jest dołączony, płatności to symulacja.
