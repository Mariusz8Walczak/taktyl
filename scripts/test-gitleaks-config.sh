#!/bin/sh
# I-007 (ADR-0008, docs/19 par. 5, TAKTYL-8): test negatywny konfiguracji .gitleaks.toml.
# Allowlista kluczy magazynu przegladarki ("taktyl.<nazwa>.v<N>") ma byc WASKA. Skrypt tworzy tymczasowe drzewo
# plikow i skanuje je gitleaksem (ten sam obraz co w CI, GITLEAKS_IMAGE z .github/workflows/ci.yml) z biezaca konfiguracja.
# Uwaga: "taktyl.foo.v1" ma entropie ponizej progu regul domyslnych (nie jest wykrywany nawet bez allowlisty), dlatego do
# testu sluzy "taktyl.scena.v1" (realny przypadek SCENE_SESSION_KEY, wykrywany przez generic-api-key).
# Konczy sie kodem 1, gdy:
#   (a) losowy 40-znakowy ciag w API_KEY (nawet w dozwolonej sciezce apps/web/src/) przestaje byc wykrywany,
#   (b) "taktyl.scena.v1" w SCENE_SESSION_KEY poza dozwolonymi sciezkami (scripts/) przestaje byc wykrywany,
#   (c) kontrola dodatnia: "taktyl.scena.v1" w SCENE_SESSION_KEY w apps/web/src/ jest zglaszany (allowlista przestala dzialac).
# Uzycie: sh scripts/test-gitleaks-config.sh   (z korzenia repozytorium; wymaga Dockera)
set -eu

ROOT=$(cd "$(dirname "$0")/.." && pwd)
IMAGE=${GITLEAKS_IMAGE:-$(sed -n 's/^ *GITLEAKS_IMAGE: *//p' "$ROOT/.github/workflows/ci.yml" | head -n 1)}
[ -n "$IMAGE" ] || { echo "Brak GITLEAKS_IMAGE (ci.yml)" >&2; exit 2; }

WORK=$(mktemp -d)
trap 'rm -rf "$WORK"' EXIT
mkdir -p "$WORK/apps/web/src" "$WORK/scripts"
cp "$ROOT/.gitleaks.toml" "$WORK/.gitleaks.toml"

# Wartosci skladane w locie, zeby sam skrypt nie zawieral trafien (skan historii repozytorium).
RAND=$(head -c 300 /dev/urandom | base64 | tr -dc 'A-Za-z0-9' | head -c 40)
STORAGE="taktyl.scena"".v1"

# Kazdy przypadek w osobnym pliku i osobnym skanie: wynik jednego nie maskuje drugiego.
printf 'export const API_KEY = "%s";\n' "$RAND" > "$WORK/apps/web/src/a.ts"
printf 'export const SCENE_SESSION_KEY = "%s";\n' "$STORAGE" > "$WORK/scripts/b.ts"
printf 'export const SCENE_SESSION_KEY = "%s";\n' "$STORAGE" > "$WORK/apps/web/src/c.ts"

MOUNT=$WORK
if command -v cygpath >/dev/null 2>&1; then MOUNT=$(cygpath -m "$WORK"); fi

# $1 = plik wzgledem korzenia; wypisuje kod wyjscia gitleaksa (1 = trafienie, 0 = czysto, inne = blad narzedzia)
scan() {
  rc=0
  MSYS_NO_PATHCONV=1 docker run --rm -v "$MOUNT:/scan" -w /scan "$IMAGE" \
    dir "$1" --config /scan/.gitleaks.toml --no-banner --exit-code 1 >/dev/null 2>&1 || rc=$?
  echo "$rc"
}

fail=0
# $1 opis, $2 plik, $3 oczekiwany kod (1 = wykryty, 0 = przepuszczony)
check() {
  rc=$(scan "$2")
  if [ "$rc" = "$3" ]; then
    echo "OK    $1"
  else
    echo "BLAD  $1 (kod gitleaks $rc, oczekiwano $3)" >&2
    fail=1
  fi
}

check "(a) losowy klucz w API_KEY w apps/web/src/ jest wykryty" apps/web/src/a.ts 1
check "(b) taktyl.scena.v1 w SCENE_SESSION_KEY w scripts/ jest wykryty" scripts/b.ts 1
check "(c) taktyl.scena.v1 w SCENE_SESSION_KEY w apps/web/src/ jest przepuszczony" apps/web/src/c.ts 0

if [ "$fail" = 0 ]; then
  echo "Konfiguracja gitleaks: allowlista waska, test negatywny przechodzi."
else
  exit 1
fi
