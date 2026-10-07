---
name: taktyl-docker
description: Praca z Docker Compose w Taktylu (ADR-0009) - uruchamianie stosu, tryb dev z hot reload, testy w kontenerze, reset danych demo, migracje, seed, diagnostyka usług i proxy. Użyj, gdy cokolwiek trzeba uruchomić, zbudować, zresetować lub zdiagnozować.
---

# taktyl-docker

Wszystko działa w kontenerach; nie zakładaj lokalnego Node, pnpm ani Postgresa. Na maszynie wystarczy Docker z Compose v2 i git.

## Polecenia
```
cp .env.example .env                                   # pierwszy raz; sekrety lokalne, poza repo
docker compose up --build                              # pełny stos: db -> migrate -> seed -> api, web, admin -> proxy
docker compose --profile dev up                        # hot reload (kod montowany)
docker compose --profile test run --rm test            # reset-demo, Vitest, Playwright, axe, Lighthouse
docker compose run --rm seed                           # ponowny seed (idempotentny)
docker compose --profile demo up reset-demo            # cykliczny reset danych demo (DEMO_MODE=true)
docker compose ps                                      # stan i healthchecki
docker compose logs -f --tail=100 api                  # logi usługi
docker compose exec api sh                             # powłoka w kontenerze api
docker compose down                                    # zatrzymanie; -v kasuje wolumeny (dane!)
```
Skróty: `make up`, `make dev`, `make test`, `make reset`, `make logs`, `make down`.

## Adresy lokalne (przez proxy)
`http://taktyl.localhost` (sklep) · `http://admin.taktyl.localhost` (backpanel) · `http://api.taktyl.localhost` (API, `/health`, OpenAPI). Wszystkie z `X-Robots-Tag: noindex, nofollow`.

## Diagnostyka
| Objaw | Sprawdź |
|---|---|
| Usługa restartuje się | `docker compose logs <usługa>`; czy `db` jest `healthy`; czy `migrate` zakończył się kodem 0 |
| Sklep pokazuje stary stan po edycji w backpanelu | `outbox` w bazie (zaległe zdarzenia), log webhooka `api`, zgodność `REVALIDATE_SECRET` w `api` i `web` |
| Brak danych | czy `seed` się wykonał; `docker compose run --rm seed`; w razie potrzeby `make reset` |
| `taktyl.localhost` nie odpowiada | `docker compose ps proxy`, log proxy, port 80 zajęty na hoście |
| Testy zielone lokalnie, czerwone w CI | wersje obrazów (przypięte), zegar/strefa, stan bazy (reset) |

## Zasady
- Obrazy wielostopniowe, użytkownik nie-root, bez sekretów w warstwach; `latest` jako tag bazowy zakazany.
- `.env` nigdy w repo; wyjątek `.env.example` z placeholderami.
- Overlay `docker-compose.crafto.yml` (montaż `vendor/crafto/`) jest lokalny i w `.gitignore` (ADR-0004).
- `down -v` i reset kasują dane - rób świadomie; w trybie demo dane i tak wracają z `data/*.json`.
- Zmianę topologii lub usług opisz w `docs/14`, a odstępstwa od ADR-0009 zgłoś człowiekowi.
