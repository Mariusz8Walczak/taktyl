# 26 · Wdrożenie demo (I-016)

Decyzja właściciela z 2026-11-25: publiczne demo pod `taktyl.donmario.pl` (rozstrzyga Q-05 z `docs/13`: backpanel online, w trybie demo).

## Adresy

| Usługa | Adres |
|---|---|
| Sklep | `https://taktyl.donmario.pl` |
| Backpanel | `https://admin.taktyl.donmario.pl` |
| API | `https://api.taktyl.donmario.pl` (`/health`) |

DNS: trzy rekordy A na serwer donMario (adres w panelu DNS domeny, nie w repo).

## Topologia

```
klient ──HTTPS──> nginx hosta (Let's Encrypt, X-Robots-Tag noindex)
                    └─HTTP──> 127.0.0.1:4100 ── proxy (Caddy, nazwy z SHOP_HOST/ADMIN_HOST/API_HOST)
                                                 ├─ web:3000   (+ /media z wolumenu)
                                                 ├─ admin:3001
                                                 └─ api:4000 ── db (Postgres 16)
```

Stos to ten sam `docker-compose.yml` co lokalnie plus `docker-compose.prod.yml` (tagi obrazów `:prod`). Na serwerze w `/opt/taktyl/`: oba pliki compose, `infra/caddy/Caddyfile`, `.env` (tylko na serwerze, nigdy w repo).

## Zmienne środowiska prod (różnice względem `.env.example`)

- `PROXY_HTTP_PORT=127.0.0.1:4100`, `SHOP_HOST` / `ADMIN_HOST` / `API_HOST` = nazwy z tabeli.
- `PUBLIC_SITE_URL`, `PUBLIC_API_URL`, `PUBLIC_ADMIN_URL`, `MEDIA_PUBLIC_URL`, `API_CORS_ORIGINS` z `https://`.
- `SESSION_COOKIE_DOMAIN=.taktyl.donmario.pl`, cookie `Secure` (domyślne w produkcji).
- `DEMO_MODE=true`, `COMPOSE_PROFILES=demo`, `DEMO_RESET_INTERVAL_MINUTES=1440` (reset raz na dobę).
- Wszystkie `CHANGE_ME` jako nowe losowe wartości (`openssl rand`), hasło konta owner tylko w `.env` serwera.

## Wdrożenie

1. Lokalnie: `docker compose -f docker-compose.yml -f docker-compose.prod.yml --env-file <env prod> build migrate api web admin`.
2. `docker save taktyl-{migrate,api,web,admin}:prod | gzip | ssh <serwer> 'gunzip | docker load'`.
3. Na serwerze: `docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --wait`.
4. Pierwszy raz: vhost nginx `taktyl` i certyfikat (`certbot certonly --webroot -w /var/www/html -d taktyl.donmario.pl -d admin.taktyl.donmario.pl -d api.taktyl.donmario.pl`).
5. Zdjęcia: wgranie renderów przez `POST /v1/admin/media/{key}` (B-502). Seed i reset biorą status zdjęć z plików w wolumenie, więc reset ich nie gasi (I-016).
6. Kontrola: sklep 200, backpanel 307 na `/logowanie`, `/health` 200, `X-Robots-Tag: noindex`, zdjęcia na listingu, scena 3D.

Wycofanie: obrazy poprzedniej wersji zostają na serwerze pod tagiem `:prod-prev` (krok 2 przetagowuje przed `docker load`).
