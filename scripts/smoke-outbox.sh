#!/bin/sh
# I-011 (S30, ADR-0003, TAKTYL-71): wylacz sklep, zmien cene, wlacz sklep. Zdarzenie z tabeli `outbox` ma zostac dostarczone
# (ponowienie z narastajacym odstepem) i cena ma byc widoczna w sklepie bez recznej interwencji. Czesc "bledny podpis HMAC: 401"
# pokrywa Playwright (e2e/tests/backpanel/s30-s34-s35-webhook-i-api.spec.ts). Skrypt steruje Dockerem, wiec dziala na hoscie,
# nie w kontenerze e2e. Wymaga dzialajacego stosu (docker compose up -d --wait). Na koniec przywraca dane (seed --reset).
# Uzycie: scripts/smoke-outbox.sh   (COMPOSE="docker compose -p tk71" i PROXY_HTTP_PORT jak w smoke-stack.sh)
set -eu
cd "$(dirname "$0")/.."
COMPOSE="${COMPOSE:-docker compose}"
PORT="${PROXY_HTTP_PORT:-$(sed -n 's/^PROXY_HTTP_PORT=//p' .env 2>/dev/null | head -n 1)}"
PORT="${PORT:-80}"
BASE="http://localhost:${PORT}"
MAX_WAIT="${SMOKE_OUTBOX_MAX_WAIT:-420}"
fail=0
ok() { echo "ok:   $1"; }
bad() { echo "BLAD: $1" >&2; fail=1; }
sql() { $COMPOSE exec -T db sh -c "psql -U \"\$POSTGRES_USER\" -d \"\$POSTGRES_DB\" -tAc \"$1\"" | tr -d '[:space:]'; }
shop() { curl -s -H 'Host: taktyl.localhost' "$BASE/myszki/wrobel"; }
restore() { $COMPOSE start web >/dev/null 2>&1 || true; }
trap restore EXIT

before="$(sql "select coalesce(max(id),0) from outbox")"
echo "== 1. wylaczam sklep (web) i zmieniam cene przez API admina"
$COMPOSE stop web >/dev/null
out="$($COMPOSE exec -T api node --input-type=module - < scripts/smoke-outbox.mjs)" || { bad "zmiana ceny nie powiodla sie: $out"; exit 1; }
gr="$(echo "$out" | sed -n 's/^PRICE_GR=//p')"
zl="$(( gr / 100 )),$(printf '%02d' $(( gr % 100 )))"
ok "cena zmieniona na $zl zl przy wylaczonym sklepie"

echo "== 2. zdarzenie czeka w outbox (nie jest sent) przy wylaczonym sklepie"
sleep 15
pending="$(sql "select count(*) from outbox where id > $before and status <> 'sent'")"
attempts="$(sql "select coalesce(max(attempts),0) from outbox where id > $before and status <> 'sent'")"
if [ "$pending" -ge 1 ]; then ok "outbox: $pending zdarzen niedostarczonych, prob: $attempts"; else bad "outbox nie zawiera niedostarczonego zdarzenia"; fi
if [ "$attempts" -ge 1 ]; then ok "worker probowal dostarczyc (ponowienie)"; else bad "brak prob dostarczenia"; fi

echo "== 3. wlaczam sklep; zdarzenie ma zostac dostarczone samo"
$COMPOSE start web >/dev/null
waited=0
left=1
while [ "$waited" -lt "$MAX_WAIT" ]; do
  left="$(sql "select count(*) from outbox where id > $before and status <> 'sent'")"
  [ "$left" = "0" ] && break
  sleep 5
  waited=$((waited + 5))
done
if [ "$left" = "0" ]; then ok "S30: outbox dostarczony po powrocie sklepu w ${waited} s"; else bad "outbox nie dostarczony w ${MAX_WAIT} s (statusy: $(sql "select string_agg(distinct status, ',') from outbox where id > $before"))"; fi

echo "== 4. sklep pokazuje nowa cene bez recznej interwencji"
n=0
seen=0
while [ "$n" -lt 12 ]; do
  if shop | sed 's/\xc2\xa0/ /g' | grep -q "$zl zł"; then seen=1; break; fi
  n=$((n + 1))
  sleep 2
done
if [ "$seen" = "1" ]; then ok "S30: /myszki/wrobel pokazuje $zl zl"; else bad "sklep nie pokazuje $zl zl"; fi

echo "== 5. przywracam dane demo"
if $COMPOSE run --rm --no-deps -e DEMO_MODE=true seed node dist/seed.js --reset >/dev/null; then ok "seed --reset"; else bad "reset nieudany"; fi

if [ "$fail" -eq 0 ]; then echo "smoke-outbox: wszystko w porzadku"; else echo "smoke-outbox: BLAD" >&2; exit 1; fi
