# 24 · Serwery MCP (front office i backoffice, I-014)

Dwa serwery [Model Context Protocol](https://modelcontextprotocol.io), które pozwalają klientowi MCP (Claude Code, Claude Desktop, inny klient) używać sklepu Taktyl przez jego REST API (`docs/16`). Oba są **cienkimi nakładkami**: nie mają logiki biznesowej ani dostępu do bazy, a każda zmiana przechodzi przez to samo API co backpanel (dziennik zmian `audit_log`, `outbox`, rewalidacja sklepu ≤ 5 s, ADR-0003). Kod: `apps/mcp-front`, `apps/mcp-admin`, wspólny rdzeń `packages/mcp-core`.

|           | `mcp-front` (front office)              | `mcp-admin` (backoffice)              |
| --------- | --------------------------------------- | ------------------------------------- |
| API       | publiczne `/v1/*`                       | `/v1/admin/*`                         |
| Klasa     | **open**: bez uwierzytelniania i kluczy | uwierzytelniony jako konto backpanelu |
| Transport | stdio **i** Streamable HTTP             | tylko stdio                           |
| Zapis     | domyślnie żaden                         | pełny panel, rola konta decyduje      |
| Narzędzia | 19 (+4 za flagą)                        | 47                                    |

## 1. Klasa „open” (front office): gwarancje

Właściciel zdecydował, że front office ma być otwarty dla każdego klienta MCP. Klasę „open” rozumiemy tak, a to jest zakres gwarancji (testy w `apps/mcp-front/test` i `packages/mcp-core/test`):

1. **Zero uwierzytelniania i zero kluczy.** Dowolny klient łączy się bez logowania. Serwer nie zna żadnych poświadczeń, nie dostaje `env_file` z `.env` (compose podaje mu tylko adres API) i nie ma dostępu do `/v1/admin` (test sprawdza, że kod nie zawiera takiej ścieżki).
2. **Tylko odczyt.** Wszystkie narzędzia mają `readOnlyHint: true`. Także wycena koszyka (`quote_cart`, `POST /v1/cart/quote`) niczego nie zapisuje.
3. **Narzędzia zapisujące są wyłączone domyślnie.** Zakładanie zamówień i symulacja płatności (`create_order`, `simulate_payment`, a do pary `get_order` i `list_orders`) pojawiają się wyłącznie przy `TAKTYL_MCP_ALLOW_ORDERS=true`. Domyślnie jest `false`, a usługa HTTP w compose ma tę flagę na stałe `"false"` i nie czyta jej z `.env`. Powód: otwarty endpoint nie może pozwalać każdemu zakładać zamówień.
4. **Tylko publiczne API `/v1`.** Dane osobowe pojawiają się w odpowiedziach tylko wtedy, gdy podał je wywołujący (zamówienie po `order_token`). Sklep nie przyjmuje kart ani kodów BLIK, a e-maile i dane w demo są fikcyjne (`@taktyl.example`).
5. **Ochrona otwartego endpointu HTTP:** limit zapytań na IP (`TAKTYL_MCP_RATE_LIMIT`, domyślnie 120/min, odpowiedź 429 z `Retry-After`), limit rozmiaru ciała (`TAKTYL_MCP_MAX_BODY_BYTES`, domyślnie 256 kB, odpowiedź 413), limit równoległych zapytań (503), limity czasu zapytania i nagłówków, tryb bezstanowy (bez sesji i bez strumienia SSE, `GET /mcp` zwraca 405), CORS tylko `GET, POST, OPTIONS` z dowolnego origin **bez ciasteczek** (`Access-Control-Allow-Credentials` nie jest ustawiany), `Cache-Control: no-store`.
6. **Limity API zostają w mocy.** Zapytania MCP idą do API z adresu serwera MCP, więc limity API (`docs/14` §7, w trybie demo `DEMO_THROTTLE_*`) są wspólne dla wszystkich klientów HTTP. Limit na IP w serwerze MCP chroni przed wyczerpaniem ich przez jednego klienta. Za proxy ustaw `TAKTYL_MCP_TRUST_PROXY=true`, żeby limit liczył adres z `X-Forwarded-For`.
7. **Brak hostingu.** Repozytorium nie zakłada publicznego adresu. Usługa HTTP domyślnie nasłuchuje tylko na `127.0.0.1` (`TAKTYL_MCP_HTTP_BIND`). Adres do udostępnienia publicznie wskaże właściciel. Wystawiaj go za reverse proxy z TLS (np. Caddy) i `TAKTYL_MCP_TRUST_PROXY=true`.

Czego klasa „open” **nie** gwarantuje: dostępności (to demo), ochrony przed zalewem wolumetrycznym (to rola proxy lub CDN) i poufności zapytań (w samym serwerze nie ma TLS).

## 2. Narzędzia front office

Odpowiedzi są walidowane schematami z `@taktyl/contracts`, a niezgodność z kontraktem to błąd narzędzia, nie surowe dane. Identyfikatory trafiające do ścieżek (slug, SKU, numer zamówienia) przechodzą wąski wzorzec, więc `../` i znaki specjalne są odrzucane przed zapytaniem.

| Narzędzie               | Opis                                                                               | Dostęp | Ryzyko | `confirm` |
| ----------------------- | ---------------------------------------------------------------------------------- | ------ | ------ | --------- |
| `list_categories`       | Kategorie sklepu                                                                   | każdy  | odczyt | nie       |
| `list_products`         | Lista produktow kategorii                                                          | każdy  | odczyt | nie       |
| `get_product`           | Szczegoly produktu                                                                 | każdy  | odczyt | nie       |
| `get_complete_set`      | Propozycja Dokoncz set                                                             | każdy  | odczyt | nie       |
| `get_facets`            | Facety kategorii                                                                   | każdy  | odczyt | nie       |
| `search_catalog`        | Wyszukiwanie                                                                       | każdy  | odczyt | nie       |
| `list_switches`         | Przelaczniki                                                                       | każdy  | odczyt | nie       |
| `list_colors`           | Kolory                                                                             | każdy  | odczyt | nie       |
| `get_rules`             | Reguly kreatora setu                                                               | każdy  | odczyt | nie       |
| `list_presets`          | Gotowe sety                                                                        | każdy  | odczyt | nie       |
| `quote_cart`            | Wycena koszyka                                                                     | każdy  | odczyt | nie       |
| `get_configurator`      | Słowniki konfiguratora kolorów 3D                                                  | każdy  | odczyt | nie       |
| `quote_configuration`   | Wycena i kod konfiguracji własnej (ADR-0011); kod wchodzi do `quote_cart` jako SKU | każdy  | odczyt | nie       |
| `get_shop_settings`     | Ustawienia sklepu                                                                  | każdy  | odczyt | nie       |
| `get_shipping_estimate` | Termin wysylki i dostawy                                                           | każdy  | odczyt | nie       |
| `list_pickup_points`    | Punkty odbioru                                                                     | każdy  | odczyt | nie       |
| `get_info_page`         | Strona informacyjna lub prawna                                                     | każdy  | odczyt | nie       |
| `list_guides`           | Lista poradnikow                                                                   | każdy  | odczyt | nie       |
| `get_guide`             | Poradnik                                                                           | każdy  | odczyt | nie       |
| `get_faq`               | FAQ                                                                                | każdy  | odczyt | nie       |
| `get_product_reviews`   | Opinie o produkcie                                                                 | każdy  | odczyt | nie       |

Za flagą `TAKTYL_MCP_ALLOW_ORDERS=true` (domyślnie wyłączone):

| Narzędzie          | Opis                         | Dostęp | Ryzyko | `confirm` |
| ------------------ | ---------------------------- | ------ | ------ | --------- |
| `create_order`     | Zalozenie zamowienia (demo)  | flaga  | zapis  | nie       |
| `get_order`        | Odczyt zamowienia po tokenie | flaga  | odczyt | nie       |
| `list_orders`      | Lista zamowien po tokenach   | flaga  | odczyt | nie       |
| `simulate_payment` | Symulacja platnosci (demo)   | flaga  | zapis  | nie       |

`create_order` wymaga `idempotency_key` (UUID) i ciała jak w `POST /v1/orders` (`docs/16` §2, w tym `expected_total_gr` z `quote_cart`).

## 3. Narzędzia backoffice

`mcp-admin` loguje się leniwie (przy pierwszym użyciu), trzyma ciasteczko `taktyl_session` i token CSRF w pamięci procesu, dokleja `X-CSRF-Token` do mutacji, po `401` loguje ponownie, a po `403 csrf_invalid` odświeża token i ponawia zapytanie raz. Rola konta (`owner`, `editor`, `viewer`) jest egzekwowana przez API, więc narzędzie ponad rolę zwróci `403`; `whoami` pokazuje rolę. Edycje wymagają `version` z odczytu (nagłówek `If-Match`).

**`confirm: true`** wymagają operacje nieodwracalne lub szerokie: kasowanie (produkt, wariant, treść, zgłoszenie, zdjęcie), reset danych demo, konta i role użytkowników (w tym reset hasła), ustawienia sklepu i reguły dopasowania, zastępowanie całych list (FAQ, opinie) oraz anulowanie zamówienia. Bez `confirm` narzędzie niczego nie wysyła do API i zwraca czytelną odmowę. Adnotacje MCP: `readOnlyHint` dla odczytów, `destructiveHint` dla ryzyka „nieodwracalne”, `idempotentHint` dla edycji ustawiających wartość.

| Narzędzie                 | Opis                                           | Min. rola | Ryzyko        | `confirm` |
| ------------------------- | ---------------------------------------------- | --------- | ------------- | --------- |
| `whoami`                  | Biezacy uzytkownik                             | viewer    | odczyt        | nie       |
| `get_dashboard`           | Pulpit                                         | viewer    | odczyt        | nie       |
| `list_audit`              | Dziennik zmian                                 | viewer    | odczyt        | nie       |
| `list_users`              | Konta backpanelu                               | owner     | odczyt        | nie       |
| `create_user`             | Nowe konto backpanelu                          | owner     | nieodwracalne | tak       |
| `update_user`             | Zmiana konta (rola, dezaktywacja, reset hasla) | owner     | nieodwracalne | tak       |
| `list_products`           | Produkty (panel)                               | viewer    | odczyt        | nie       |
| `get_product`             | Produkt (panel)                                | viewer    | odczyt        | nie       |
| `create_product`          | Nowy produkt                                   | editor    | zapis         | nie       |
| `update_product`          | Edycja produktu                                | editor    | zapis         | nie       |
| `delete_product`          | Usuniecie produktu                             | owner     | nieodwracalne | tak       |
| `set_product_description` | Opis produktu                                  | editor    | zapis         | nie       |
| `create_variant`          | Nowy wariant                                   | editor    | zapis         | nie       |
| `update_variant`          | Edycja wariantu                                | editor    | zapis         | nie       |
| `delete_variant`          | Usuniecie wariantu                             | owner     | nieodwracalne | tak       |
| `set_price`               | Zmiana ceny wariantu                           | editor    | zapis         | nie       |
| `get_price_history`       | Historia cen wariantu                          | viewer    | odczyt        | nie       |
| `set_stock`               | Korekta stanu wariantu                         | editor    | zapis         | nie       |
| `get_stock_movements`     | Ruchy magazynowe wariantu                      | viewer    | odczyt        | nie       |
| `list_presets`            | Gotowe sety (panel)                            | viewer    | odczyt        | nie       |
| `update_preset`           | Edycja gotowego setu                           | editor    | zapis         | nie       |
| `update_category`         | Edycja kategorii                               | editor    | zapis         | nie       |
| `update_switch`           | Edycja przelacznika (slownik)                  | editor    | zapis         | nie       |
| `update_color`            | Edycja koloru (slownik)                        | editor    | zapis         | nie       |
| `update_rules`            | Reguly dopasowania                             | owner     | zapis         | tak       |
| `list_orders`             | Zamowienia (panel)                             | viewer    | odczyt        | nie       |
| `get_order`               | Zamowienie (panel)                             | viewer    | odczyt        | nie       |
| `transition_order`        | Zmiana statusu zamowienia                      | editor    | zapis         | tak       |
| `add_order_note`          | Notatka do zamowienia                          | editor    | zapis         | nie       |
| `list_content`            | Tresci (strony i poradniki)                    | viewer    | odczyt        | nie       |
| `get_content`             | Pojedyncza tresc                               | viewer    | odczyt        | nie       |
| `create_content`          | Nowa strona albo artykul                       | editor    | zapis         | nie       |
| `update_content`          | Edycja tresci                                  | editor    | zapis         | nie       |
| `delete_content`          | Usuniecie artykulu                             | owner     | nieodwracalne | tak       |
| `get_faq`                 | FAQ (panel)                                    | viewer    | odczyt        | nie       |
| `put_faq`                 | Zapis calego FAQ                               | editor    | zapis         | tak       |
| `list_reviews`            | Opinie demo (panel)                            | viewer    | odczyt        | nie       |
| `put_reviews`             | Zapis opinii produktu                          | editor    | zapis         | tak       |
| `list_messages`           | Zgloszenia z formularzy                        | viewer    | odczyt        | nie       |
| `update_message`          | Oznaczenie zgloszenia jako obsluzone           | editor    | zapis         | nie       |
| `delete_message`          | Usuniecie zgloszenia                           | owner     | nieodwracalne | tak       |
| `get_settings`            | Ustawienia sklepu (panel)                      | viewer    | odczyt        | nie       |
| `update_settings`         | Zmiana ustawien sklepu                         | owner     | zapis         | tak       |
| `list_media`              | Zdjecia (manifest)                             | viewer    | odczyt        | nie       |
| `delete_media`            | Usuniecie zdjecia                              | owner     | nieodwracalne | tak       |
| `revalidate_tags`         | Reczne odswiezenie cache sklepu                | owner     | zapis         | nie       |
| `reset_demo`              | Reset danych demo                              | owner     | nieodwracalne | tak       |

Czego `mcp-admin` świadomie nie robi: wgrywania plików zdjęć (multipart; zdjęcia wgrywa się w panelu), wylogowania i ręcznego ustawiania `lowest_30d` (liczy serwer, ADR-0005). Nie dopisuje produktów do `data/*.json` ani do seeda (reguła 4, ADR-0005): zmiany katalogu idą wyłącznie przez API.

## 4. Konfiguracja

| Zmienna                                        | Serwer | Domyślnie         | Znaczenie                                                                                               |
| ---------------------------------------------- | ------ | ----------------- | ------------------------------------------------------------------------------------------------------- |
| `TAKTYL_API_URL`                               | oba    | `http://api:4000` | adres API; w compose usługa `api`, z hosta np. `http://api.taktyl.localhost:8188`                       |
| `TAKTYL_MCP_TRANSPORT`                         | front  | `stdio`           | `stdio` albo `http`                                                                                     |
| `TAKTYL_MCP_HTTP_PORT`, `TAKTYL_MCP_HTTP_HOST` | front  | `3333`, `0.0.0.0` | port i interfejs w kontenerze; na hoście `TAKTYL_MCP_HTTP_BIND` (domyślnie `127.0.0.1`)                 |
| `TAKTYL_MCP_RATE_LIMIT`                        | front  | `120`             | zapytań na minutę z jednego IP                                                                          |
| `TAKTYL_MCP_MAX_BODY_BYTES`                    | front  | `262144`          | maksymalny rozmiar ciała zapytania                                                                      |
| `TAKTYL_MCP_TRUST_PROXY`                       | front  | `false`           | ufaj `X-Forwarded-For` (tylko za zaufanym proxy)                                                        |
| `TAKTYL_MCP_ALLOW_ORDERS`                      | front  | `false`           | narzędzia zamówień; w usłudze HTTP wyłączone na stałe                                                   |
| `TAKTYL_ADMIN_EMAIL`, `TAKTYL_ADMIN_PASSWORD`  | admin  | puste             | konto backpanelu (adres tylko `@taktyl.example`); **nigdy w repo**                                      |
| `TAKTYL_ADMIN_DEMO`                            | admin  | `false`           | `true` = `POST /v1/admin/auth/demo-viewer` (rola `viewer`, tylko odczyt; wymaga `DEMO_MODE=true` w API) |

Przykład jest w `.env.example`. Hasło zostaw puste i ustaw w lokalnym `.env` (git go ignoruje) albo w zmiennej środowiska. Bez poświadczeń i bez `TAKTYL_ADMIN_DEMO` `mcp-admin` zgłasza czytelny błąd przy pierwszym użyciu, a nie przy starcie.

## 5. Uruchomienie

Najpierw stos (`docker compose up --build -d --wait`), potem:

```bash
# stdio (klient MCP uruchamia kontener; --no-deps, gdy stos już działa)
docker compose --profile mcp run --rm -T --no-deps --build mcp-front
docker compose --profile mcp run --rm -T --no-deps --build mcp-admin

# HTTP klasy open (front office), domyślnie tylko 127.0.0.1:3333/mcp
docker compose --profile mcp up --build -d --wait mcp-front-http
```

Konfiguracja Claude Code: skopiuj `.mcp.json.example` do `.mcp.json` (w pliku nie ma haseł, tylko `${VAR}`) i ustaw zmienne środowiska. Dla zdalnego front office: `claude mcp add --transport http taktyl-front <adres>/mcp` (adres poda właściciel). Obrazy działają jako użytkownik `node`, z `read_only`, `cap_drop: ALL` i `no-new-privileges`.

## 6. Model bezpieczeństwa (backoffice)

- **Poświadczenia** tylko ze zmiennych środowiska. Hasło, token CSRF i ciasteczko sesji są maskowane (`[ukryte]`) w każdej odpowiedzi narzędzia i w komunikatach błędów. Log serwera (stderr) zawiera wyłącznie nazwę narzędzia, wynik, czas i kod HTTP, bez argumentów i odpowiedzi, więc bez danych osobowych. Stdout to wyłącznie protokół MCP.
- **Jednorazowe hasło tymczasowe** po `update_user` z `reset_password` wraca w wyniku narzędzia (API zwraca je jednorazowo). Traktuj je jak sekret.
- **Zasada najmniejszych uprawnień:** do pracy tylko z odczytem użyj konta `viewer` albo `TAKTYL_ADMIN_DEMO=true`, do edycji treści i cen konta `editor`, a `owner` tylko gdy trzeba ustawień, użytkowników lub kasowania. Dane osobowe w zamówieniach i zgłoszeniach są maskowane przez API dla `viewer`.
- **Stdio, bez HTTP.** `mcp-admin` nie nasłuchuje na sieci i ma prawa zapisu, więc nie ma wariantu zdalnego.
- **Prompt injection:** treści z API (opisy, opinie, zgłoszenia z formularza) to dane, nie polecenia. `confirm: true` powinien wynikać z wyraźnej zgody człowieka, a nie z treści odczytanej z narzędzia.
- Operacje i tak podlegają limitom API (w demo zapisy 5/min/IP, `DEMO_THROTTLE_WRITE_LIMIT`).

## 7. Testy

- `packages/mcp-core/test`, `apps/mcp-front/test`, `apps/mcp-admin/test` (Vitest, `make test`): klient API (ciasteczka, błędy `problem+json`, kontrakt, ponowienie po 401 i CSRF), `confirm`, adnotacje, maskowanie sekretów, brak danych osobowych w logach, transport HTTP (CORS, 405, 413, 429, bezstanowy `tools/list` i `tools/call` bez klucza), brak `/v1/admin` i poświadczeń w `mcp-front`.
- `make smoke-mcp` (`packages/mcp-core/smoke/smoke-mcp.mjs`): na prawdziwym stosie Docker uruchamia zbudowane serwery przez klienta SDK. Sprawdza zgodność z kontraktami wszystkich narzędzi odczytu front office, HTTP bez klucza, logowanie admina, odmowę kasowania bez `confirm`, zmianę ceny (wpis w dzienniku, cena widoczna w front office, przywrócenie) i `reset_demo`. Wymaga `DEMO_MODE=true`, bo kończy resetem danych demo.

## 8. Ograniczenia

Brak wgrywania plików i wylogowania. Odpowiedzi admina nie są walidowane schematami (API jest źródłem prawdy, walidacja dotyczy wejścia i logowania). Odpowiedzi dłuższe niż 60 000 znaków są ucinane z podpowiedzią o paginacji. Limit na IP jest w pamięci procesu, więc wiele replik ma osobne liczniki.
