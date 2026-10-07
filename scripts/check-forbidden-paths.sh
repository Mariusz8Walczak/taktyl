#!/bin/sh
# I-007 (ADR-0004, ADR-0008, docs/19 par. 2 i 5, TAKTYL-8): kontrola sciezek zakazanych w repozytorium.
# Konczy sie kodem 1, gdy `git ls-files` zawiera:
#   - html/ lub vendor/ (szablon Crafto, ADR-0004),
#   - archiwa *.zip, *.rar, *.7z,
#   - pliki .env* poza .env.example,
#   - *.sql i *.dump poza apps/api/prisma/migrations/ i katalogami seed/,
#   - prywatny adres e-mail (gmail.com, mwproject) w sledzonych plikach tekstowych lub w autorach commitow.
# Uzycie:  scripts/check-forbidden-paths.sh            kontrola biezacego repozytorium
#          scripts/check-forbidden-paths.sh --self-test  test negatywny na tymczasowym repozytorium
set -u

# Wzorzec prywatnego adresu autora (nie pisz tu pelnego adresu, zeby skrypt sam nie byl trafieniem).
PRIVATE_MAIL_RE='gmail\.com|mwproject'

# Wypisuje naruszenia (po jednym w linii) dla repozytorium w katalogu $1.
scan_repo() {
  repo="$1"
  files="$(git -C "$repo" ls-files -z | tr '\0' '\n')"

  printf '%s\n' "$files" | grep -E '^(html|vendor)/' | sed 's/^/[szablon] sledzona sciezka zakazana: /'
  printf '%s\n' "$files" | grep -Ei '\.(zip|rar|7z)$' | sed 's/^/[archiwum] sledzone archiwum: /'
  printf '%s\n' "$files" | grep -E '(^|/)\.env' | grep -Ev '(^|/)\.env\.example$' | sed 's/^/[env] sledzony plik srodowiska: /'
  printf '%s\n' "$files" | grep -Ei '\.(sql|dump)$' \
    | grep -Ev '^apps/api/prisma/migrations/' | grep -Ev '(^|/)seed/' | sed 's/^/[zrzut] sledzony zrzut bazy: /'

  # Prywatny e-mail w tresci sledzonych plikow tekstowych (bez tego skryptu i konfiguracji skanera).
  git -C "$repo" grep -nIiE "$PRIVATE_MAIL_RE" -- . \
    ':(exclude)scripts/check-forbidden-paths.sh' ':(exclude).gitleaks.toml' ':(exclude)pnpm-lock.yaml' 2>/dev/null \
    | sed 's/^/[e-mail] prywatny adres w pliku: /'

  # Prywatny e-mail w autorach i committerach (docs/19 par. 2 pkt 4). Pomijane w plytkim klonie bez historii.
  if [ "$(git -C "$repo" rev-parse --is-shallow-repository 2>/dev/null)" != "true" ]; then
    git -C "$repo" log --format='%H %ae %ce' 2>/dev/null | grep -Ei "$PRIVATE_MAIL_RE" \
      | sed 's/^/[e-mail] prywatny adres w autorze commita: /'
  fi
}

run_check() {
  out="$(scan_repo "$1")"
  if [ -n "$out" ]; then
    printf '%s\n' "$out" >&2
    echo "kontrola-sciezek: BLAD, znaleziono naruszenia (ADR-0004, ADR-0008)." >&2
    return 1
  fi
  echo "kontrola-sciezek: OK, brak sciezek zakazanych."
  return 0
}

# Test negatywny: kazdy przypadek zakazany musi dac blad, przypadki dozwolone nie moga.
self_test() {
  tmp="$(mktemp -d)"
  trap 'rm -rf "$tmp"' EXIT
  git -C "$tmp" init -q
  git -C "$tmp" config user.email "ci@users.noreply.github.com"
  git -C "$tmp" config user.name "ci"
  fail=0

  expect() { # $1 = oczekiwany kod (0 lub 1), $2 = opis
    run_check "$tmp" >/dev/null 2>&1
    code=$?
    if [ "$code" -ne "$1" ]; then
      echo "self-test: NIEPOWODZENIE: $2 (kod $code, oczekiwano $1)" >&2
      fail=1
    else
      echo "self-test: ok: $2"
    fi
  }
  add() { # $1 = sciezka, $2 = zawartosc
    mkdir -p "$tmp/$(dirname "$1")"
    printf '%s\n' "${2:-x}" >"$tmp/$1"
    git -C "$tmp" add -f -- "$1"
  }
  drop() { git -C "$tmp" rm -q -f --cached -- "$1"; }

  add README.md "readme"
  add .env.example "SECRET=CHANGE_ME"
  add apps/api/prisma/migrations/1_init/migration.sql "select 1;"
  add apps/api/prisma/seed/dane.sql "select 1;"
  git -C "$tmp" commit -q -m init
  expect 0 "czyste repo z dozwolonymi plikami (.env.example, migracje, seed)"

  for bad in html/index.html vendor/crafto/a.js paczka.zip .env .env.local db/zrzut.sql kopia.dump; do
    add "$bad" "x"
    expect 1 "sledzony $bad jest blokowany"
    drop "$bad"
  done

  add notatki.txt "kontakt: ktos@gmail.com"
  expect 1 "prywatny adres gmail.com w tresci pliku jest blokowany"
  drop notatki.txt

  expect 0 "po usunieciu naruszen repo znow jest czyste"
  [ "$fail" -eq 0 ] && echo "self-test: wszystko w porzadku" || { echo "self-test: BLAD" >&2; return 1; }
}

case "${1:-}" in
  --self-test) self_test ;;
  "") run_check "$(git rev-parse --show-toplevel)" ;;
  *) echo "uzycie: $0 [--self-test]" >&2; exit 2 ;;
esac
