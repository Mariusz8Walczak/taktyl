---
name: taktyl-straznik-repo
description: Lista kontrolna przed commitem, pushem lub publikacją publicznego repozytorium Taktyl - sekrety, pliki szablonu Crafto, dane osobowe, adres autora, prawdziwe marki, pliki IDE, licencje (ADR-0008, ADR-0004). Użyj przed każdym pushem i przed pierwszą publikacją.
---

# taktyl-straznik-repo

Repo jest publiczne i jest wizytówką. Historia git jest nieusuwalna po opublikowaniu, więc sprawdzasz **przed** commitem.

## Lista kontrolna
1. **Co zostanie dodane**: `git status --short` i `git diff --cached --stat`; nic nieznanego, nic dużego i binarnego bez powodu.
2. **Pliki zakazane nie są śledzone**:
   ```
   git ls-files | rg -n '^(html|vendor)/|\.zip$|(^|/)\.env($|\.)|\.idea/|\.pem$|\.key$|\.sql$|\.dump$|node_modules/|(^|/)\.next/'
   ```
   Wynik ma zawierać wyłącznie `.env.example` (i `seed/*.sql`, jeśli istnieją świadomie). Pusty wynik poza tym = OK.
3. **`.gitignore`** zawiera: `html/`, `vendor/`, `.env*` (z wyjątkiem `!.env.example`), `.idea/`, `.vscode/`, `node_modules/`, `.next/`, `dist/`, `*.sql`, `*.dump`, `*.pem`, `*.key`, `docker-compose.crafto.yml`, `.claude/settings.local.json`, `.claude/marki-zakazane.local.txt`.
4. **Sekrety**: `gitleaks detect --no-banner` (jeśli dostępny, najlepiej w kontenerze CI) albo
   ```
   git grep -n -I -E '(password|passwd|secret|token|api[_-]?key|private[_-]?key)\s*[:=]\s*["'"'"'][^"'"'"']{6,}' -- . ':!docs' ':!*.md'
   ```
   W `.env.example` tylko placeholdery (`change-me`). Znalezionych wartości nie wklejaj do raportu.
5. **Dane osobowe**: 
   ```
   git grep -n -I -E '[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[a-z]{2,}' | rg -v 'taktyl\.example|users\.noreply\.github\.com'
   git grep -n -I -E 'C:\\Users|/Users/[a-z]+/|\b[0-9]{3}[- ]?[0-9]{3}[- ]?[0-9]{3}\b'
   ```
   Telefon fikcyjny wg `docs/11` (+48 22 000 00 00) jest dozwolony. Zero NIP, REGON, KRS, BDO.
6. **Autor**: `git config user.email` kończy się na `@users.noreply.github.com`; `git log --format='%an <%ae>' | sort -u` bez prywatnej skrzynki.
7. **Marki i grafika** (reguły 1 i 5): przeskanuj diff skillem `taktyl-audyt-tresci`; brak logotypów płatności i przewoźników, brak zdjęć spoza manifestu, brak plików SVG rysowanych przez model.
8. **Licencje**: istnieje `LICENSE` (MIT, kod własny), `assets/fonts/OFL.txt`, README zawiera zdanie "Szablon Crafto nie jest częścią repozytorium. Wymaga osobnej licencji." i informację, że sklep jest fikcyjny, a płatności symulowane.
9. **Reguła 10**: w kodzie sklepu brak pól haseł, kart i BLIK; `noindex` jest w meta i w konfiguracji proxy.
10. **CI**: lokalnie te same kontrole, co w CI (gitleaks, ścieżki zakazane, audyt tokenów).

## Wynik
PRZEPUŚĆ albo ZABLOKUJ + lista (plik:linia, kategoria, naprawa).

## Gdy coś wyciekło
- Przed pierwszym pushem: popraw lokalną historię (np. `git rebase`/nowy commit początkowy) i dopiero publikuj.
- Po publikacji: traktuj sekret jako skompromitowany, zgłoś człowiekowi rotację; nie ufaj samemu usunięciu pliku w kolejnym commicie.

Push, force-push i zmiany ustawień repozytorium wykonuje człowiek lub `taktyl-devops` po zgodzie człowieka.
