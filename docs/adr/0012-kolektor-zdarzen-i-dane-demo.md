# ADR-0012 · Własny kolektor zdarzeń pomiaru i historia danych demonstracyjnych

- **Status:** przyjęty 2026-11-25 (decyzje właściciela z `docs/25` §5, wpisy w `docs/decyzje.md`). Funkcje: B-621 (kolektor), B-622 (generator historii), B-620 (ruch w backpanelu).
- **Powiązania:** `docs/10` (zdarzenia), ADR-0005 (dane i seed), ADR-0007 (zamówienia), ADR-0009 (Docker), `docs/25` (plan pokazówki).

## Kontekst

Sklep wysyła zdarzenia z `docs/10` do `window.dataLayer`; bez podpiętego menedżera tagów nikt ich nie zbiera, więc backpanel nie ma danych o ruchu (sesje, lejek, konwersja). Do tego po `db:reset-demo` baza ma 0 zamówień, więc pulpit pokazówki pokazuje same zera. Właściciel zdecydował (2026-11-25): własny kolektor zdarzeń zapisujący do naszej bazy oraz generator ok. 90 dni zamówień i ruchu przez prawdziwą logikę sklepu.

## Decyzje

1. **Endpoint `POST /v1/events`** (publiczny, bez sesji). Ciało: `{ session_id, events: [{ name, params, ts }] }`, maks. 20 zdarzeń w paczce. Kontrakt Zod w `packages/contracts/src/public/events.ts` (`eventsBatchSchema`), wspólny dla API i sklepu. Odpowiedź `202 { accepted }`. Limit 60 zapytań/min/IP (bez sufitu trybu demo, bo to zapis pomiaru, nie zmiana danych sklepu).
2. **Nazwy i parametry bez zmian z `docs/10`** (reguła 9). Lista nazw w kontrakcie (`ANALYTICS_EVENT_NAMES`, 27 zdarzeń z §4 i §5); nazwa spoza listy (np. `page_view`, którego `docs/10` nie zna) = `422`. Parametry są zapisywane tak, jak przyszły (JSONB), z limitem 4000 znaków.
3. **Zero danych osobowych** (`docs/10` §1 pkt 5). Walidator odrzuca klucze osobowe (`email`, `phone`, `name`, `address`, `nip`, `ip`, `user_agent` i polskie odpowiedniki) na każdym poziomie i każdą wartość wyglądającą na adres e-mail. API nie zapisuje adresu IP ani nagłówka User-Agent. `session_id` to losowy, anonimowy identyfikator sesji przeglądarki (8–64 znaki `[A-Za-z0-9_-]`), niepowiązany z zamówieniem ani kontem.
4. **Zgoda.** Sklep wysyła zdarzenia do kolektora wyłącznie po zgodzie na analitykę (tryb zgody z `docs/10` §2). Bez zgody zdarzenia zostają tylko w `dataLayer`, jak dotąd. Statystyki ruchu w backpanelu mówią wprost, że dotyczą sesji ze zgodą.
5. **Czas.** `ts` to chwila zdarzenia u klienta; serwer przyjmuje tylko okno [teraz − 48 h, teraz + 10 min] (inaczej `422 out_of_window`) i zapisuje własne `received_at`.
6. **Model danych.** Tabela `analytics_events` (`id`, `session_id`, `name`, `params` JSONB, `ts`, `received_at`, `demo`), indeksy po `ts`, `(name, ts)`, `(session_id, ts)`, migracja `20261125000100_analytics_events`. `reset-demo` czyści tabelę jak resztę danych biznesowych.
7. **Generator historii demo (B-622).** Po seedzie pustej bazy zamówień i po każdym resecie demo (`DEMO_HISTORY=true`, domyślnie w `docker compose`) skrypt tworzy ok. 90 dni zamówień **przez prawdziwe usługi API**: wycena koszyka (`CartQuoteService` + `packages/domain`), utworzenie zamówienia (`OrdersService`), symulacja płatności (`PaymentsSimService`, ruch magazynowy `sale`) i zmiany statusu (`AdminOrdersService`, maszyna stanów, zwrot stanów przy anulowaniu). Usługi dostają własny zegar ustawiany na chwilę z planu, więc daty są wsteczne i spójne. Tylko istniejące produkty, warianty, sety i słowniki konfiguratora z bazy; do katalogu nic nie jest dopisywane.
8. **Determinizm.** Plan (co i kiedy) jest czystą funkcją ze stałym ziarnem (`DEMO_HISTORY_SEED`) i chwili `now`: rozkład dni tygodnia i godzin w `Europe/Warsaw`, trend rosnący, sety (gotowe i z kreatora), pojedyncze produkty, konfiguracje własne `…-CFG-…`, kody rabatowe, nieudane płatności, anulowania, zamówienia czekające ponad 24 h. Numery zamówień też z ziarna. Ten sam stan bazy i ta sama chwila dają te same dane.
9. **Oznaczenie i porządek.** Zamówienia z generatora mają `orders.demo = true`, zdarzenia `analytics_events.demo = true`; pulpit mówi „dane demonstracyjne”. Klienci są fikcyjni (`klient-NNNN@taktyl.example`), dane osobowe starsze niż 30 dni czyści retencja (ADR-0007). Braki towaru w przeszłości uzupełnia ruch `adjustment` „Dostawa (dane demo)”, a na koniec stany wracają do wartości z seeda („Inwentaryzacja (dane demo)”), więc sklep i scenariusze z `docs/12` widzą stany z `data/*.json`. Dziennik zmian dostaje jeden wpis `demo.history` zamiast setek wpisów o statusach; kolejka rewalidacji nie jest zalewana.
10. **Ruch demo.** Generator dosypuje zdarzenia z `docs/10` spójne z zamówieniami (sesje kupujących ze zgodą: lista, karta, koszyk, kasa, ewentualnie `payment_failed`, `purchase` z kwotami z prawdziwej wyceny) oraz sesje bez zakupu (odbicia, przeglądanie, wyszukiwanie, porzucone koszyki i kasy, kreator setu). `page_view` nie jest generowany, bo nie ma go w `docs/10`; sesje liczymy po `session_id`.
11. **Testy i odbiór.** `e2e-reset` uruchamia seed z `--no-demo-history`, więc scenariusze S1–S36 startują od czystych danych. Testy integracyjne API (`apps/api/test/stats.e2e.test.ts`) sprawdzają kolektor, generator (kwoty, statusy, powrót stanów, determinizm) i statystyki.

## Konsekwencje

- Backpanel ma prawdziwe liczby od pierwszego uruchomienia, a ruch w sklepie (po zgodzie) trafia do tej samej bazy, bez obcych domen i narzędzi analitycznych.
- Generator wydłuża pierwszy seed i reset o ok. 25 s (635 zamówień, ok. 39 tys. zdarzeń na 90 dni). Reset z backpanelu (B-014) odpowiada od razu, historia dosypuje się w tle.
- Każda zmiana `docs/10` (nowe zdarzenie) wymaga dopisania nazwy do `ANALYTICS_EVENT_NAMES`; inaczej kolektor odrzuci zdarzenie.
- Nie ma tu identyfikacji użytkowników ani atrybucji kampanii; to świadomie poza zakresem (sklep demonstracyjny, zero danych osobowych).
