#!/bin/sh
# I-006 (ADR-0009, docs/11 par. 1.1, TAKTYL-7): test dymny dzialajacego stosu compose.
# Sprawdza: health API przez proxy, X-Robots-Tag: noindex, nofollow na kazdym hoscie i w bledach (404),
# komplet danych seeda (18 produktow) oraz brak publikacji portu bazy na hoscie.
# Uzycie: scripts/smoke-stack.sh   (port proxy z PROXY_HTTP_PORT, domyslnie 80)
set -eu
cd "$(dirname "$0")/.."
PORT="${PROXY_HTTP_PORT:-$(sed -n 's/^PROXY_HTTP_PORT=//p' .env 2>/dev/null | head -n 1)}"
PORT="${PORT:-80}"
BASE="http://localhost:${PORT}"
fail=0

check() { # $1 opis, $2 komenda (zwraca 0 gdy OK)
  if sh -c "$2" >/dev/null 2>&1; then echo "ok:   $1"; else echo "BLAD: $1" >&2; fail=1; fi
}

for host in taktyl.localhost admin.taktyl.localhost api.taktyl.localhost; do
  check "$host: X-Robots-Tag noindex, nofollow na stronie glownej" \
    "curl -sI -H 'Host: $host' '$BASE/' | grep -qi '^x-robots-tag: noindex, nofollow'"
  check "$host: X-Robots-Tag noindex, nofollow w odpowiedzi 404" \
    "curl -sI -H 'Host: $host' '$BASE/nie-ma-takiej-strony' | grep -qi '^x-robots-tag: noindex, nofollow'"
done
check "nieznany host: X-Robots-Tag noindex, nofollow" \
  "curl -sI -H 'Host: obcy.example' '$BASE/' | grep -qi '^x-robots-tag: noindex, nofollow'"
check "API /health przez proxy zwraca ok" \
  "curl -sf -H 'Host: api.taktyl.localhost' '$BASE/health' | grep -q '\"status\":\"ok\"'"
check "sklep odpowiada 200" "curl -sf -o /dev/null -H 'Host: taktyl.localhost' '$BASE/'"
check "backpanel odpowiada 200" "curl -sf -o /dev/null -H 'Host: admin.taktyl.localhost' '$BASE/'"
check "w bazie jest 18 produktow" \
  "test \"\$(docker compose exec -T db sh -c 'psql -U \"\$POSTGRES_USER\" -d \"\$POSTGRES_DB\" -tAc \"select count(*) from products\"' | tr -d '[:space:]')\" = 18"
check "port bazy nie jest opublikowany na hoscie" \
  "test -z \"\$(docker compose ps db --format '{{.Publishers}}' | grep -o '0.0.0.0:[0-9]*')\""

[ "$fail" -eq 0 ] && echo "smoke: wszystko w porzadku" || { echo "smoke: BLAD" >&2; exit 1; }
