#!/bin/sh
# I-009 (B-014, S32, TAKTYL-65): test dymny trybu demo na dzialajacym stosie z profilem demo.
# Wymaga stosu uruchomionego z DEMO_MODE=true:  docker compose --profile demo up -d --build --wait
# Sprawdza: (1) reset z backpanelu (scripts/smoke-demo.mjs w kontenerze api), (2) reset z CLI (`seed --reset`, jak make reset
# i usluga reset-demo), (3) znaczniki rewalidacji po resecie (outbox: sent), (4) odmowa startu reset-demo bez DEMO_MODE=true,
# (5) opcjonalnie petla reset-demo: `--cycle` (wymaga DEMO_RESET_INTERVAL_SECONDS w .env, np. 60) - zmiana ceny przez SQL
# i oczekiwanie na samoczynny reset.
set -eu
cd "$(dirname "$0")/.."
COMPOSE="${COMPOSE:-docker compose}"
fail=0
ok() { echo "ok:   $1"; }
bad() { echo "BLAD: $1" >&2; fail=1; }

sql() { $COMPOSE exec -T db sh -c "psql -U \"\$POSTGRES_USER\" -d \"\$POSTGRES_DB\" -tAc \"$1\"" | tr -d '[:space:]'; }
price() { sql "select price_gr from variants where sku='M-WRB-GRF'"; }

[ "$($COMPOSE exec -T api printenv DEMO_MODE | tr -d '[:space:]')" = "true" ] || { echo "BLAD: stos nie dziala z DEMO_MODE=true" >&2; exit 1; }

echo "== 1. reset z backpanelu (POST /v1/admin/demo/reset)"
$COMPOSE exec -T api node --input-type=module - < scripts/smoke-demo.mjs || fail=1

echo "== 2. reset z CLI (seed --reset)"
seed_price="$(price)"
sql "update variants set price_gr = price_gr + 500, stock = 0 where sku='M-WRB-GRF'" >/dev/null
if [ "$(price)" != "$seed_price" ]; then ok "cena zmieniona w bazie"; else bad "nie udalo sie zmienic ceny w bazie"; fi
$COMPOSE run --rm --no-deps seed node dist/seed.js --reset >/dev/null
if [ "$(price)" = "$seed_price" ]; then ok "S32: CLI przywrocilo cene z seeda ($seed_price gr)"; else bad "CLI nie przywrocilo ceny"; fi
if [ "$(sql 'select count(*) from products')" = "18" ]; then ok "18 produktow po resecie"; else bad "liczba produktow po resecie != 18"; fi
if [ "$(sql "select stock from variants where sku='M-WRB-GRF'")" != "0" ]; then ok "stan wariantu przywrocony"; else bad "stan wariantu nie wrocil"; fi

echo "== 3. znaczniki rewalidacji po resecie dochodza do sklepu (outbox: sent)"
n=0
sent=0
while [ "$n" -le 30 ]; do
  if [ "$(sql "select count(*) from outbox o join audit_log a on a.id=o.audit_id where a.action='demo.reset' and o.status<>'sent'")" = "0" ]; then sent=1; break; fi
  n=$((n + 1))
  sleep 2
done
if [ "$sent" = "1" ]; then ok "wiersze outbox po resecie maja status sent"; else bad "outbox po resecie nie zostal wyslany w 60 s"; fi

echo "== 4. reset-demo odmawia startu bez DEMO_MODE=true"
if $COMPOSE --profile demo run --rm --no-deps -e DEMO_MODE=false reset-demo >/dev/null 2>&1; then
  bad "reset-demo wystartowal bez DEMO_MODE=true"
else
  ok "reset-demo konczy sie bledem bez DEMO_MODE=true"
fi

if [ "${1:-}" = "--cycle" ]; then
  echo "== 5. petla reset-demo (samoczynny reset)"
  secs="$($COMPOSE exec -T reset-demo printenv DEMO_RESET_INTERVAL_SECONDS 2>/dev/null | tr -d '[:space:]' || true)"
  secs="${secs:-60}"
  limit=$((secs * 2 + 60))
  sql "update variants set price_gr = price_gr + 900 where sku='M-WRB-GRF'" >/dev/null
  if [ "$(price)" != "$seed_price" ]; then ok "cena zmieniona, czekam do $limit s na reset"; else bad "nie udalo sie zmienic ceny"; fi
  waited=0
  while [ "$(price)" != "$seed_price" ] && [ "$waited" -lt "$limit" ]; do
    sleep 5
    waited=$((waited + 5))
  done
  if [ "$(price)" = "$seed_price" ]; then ok "petla reset-demo przywrocila seed po ${waited} s"; else bad "petla reset-demo nie zresetowala danych"; fi
fi

if [ "$fail" -eq 0 ]; then echo "smoke-demo: wszystko w porzadku"; else echo "smoke-demo: BLAD" >&2; exit 1; fi
