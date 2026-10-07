# ADR-0003 · Jak zmiana w backpanelu trafia do sklepu

- **Status:** przyjęta

## Wymaganie

Edycja w backpanelu (cena, stan, opis, plakietka, ustawienia sklepu, treść strony) ma być widoczna w sklepie **bez przebudowy i bez ręcznego odświeżania serwera**, w czasie widocznym dla człowieka (cel: ≤ 5 s do pierwszego odświeżenia strony).

## Decyzja: ISR z odświeżaniem po znacznikach (on-demand revalidation)

```
Backpanel ──PATCH──▶ API (NestJS) ──▶ Postgres
                        │ (po commicie transakcji)
                        ├─▶ zapis w audit_log
                        └─▶ RevalidationService ──POST /api/revalidate (HMAC)──▶ Next.js (sklep)
                                                         revalidateTag('product:bazalt-75'), 'catalog', 'shop-settings' …
```

1. Strony sklepu pobierają dane z API przez `fetch(url, { next: { tags: [...] } })` w komponentach serwerowych. Strony są cache'owane (ISR), więc są szybkie i mieszczą się w budżecie `docs/12` §4.
2. Każda mutacja w API wylicza **zbiór znaczników** dotkniętych zmianą (tabela w `docs/14` §6) i po zatwierdzeniu transakcji wysyła je do sklepu na `POST /api/revalidate` z nagłówkiem podpisu HMAC (`REVALIDATE_SECRET`, tylko w `.env`).
3. Sklep woła `revalidateTag` dla każdego znacznika. Następne żądanie dostaje świeżą stronę.
4. Zabezpieczenie: jeśli webhook zawiedzie (sklep niedostępny), API zapisuje zdarzenie w tabeli `outbox` i ponawia (wykładnicze opóźnienie). Dodatkowo każda strona ma `revalidate: 300` jako sieć bezpieczeństwa.
5. **Dane zmienne w czasie żądania nie są cache'owane na stałe:** stan magazynowy i cena w koszyku/zamówieniu pochodzą z `POST /cart/quote` (bez cache). Strony listingu i karty mogą przez chwilę pokazać stary stan — dlatego koszyk i kasa zawsze weryfikują (F-157, `docs/03` §7: ceny nie są zapisywane w koszyku).

## Czemu nie…

| Opcja | Powód odrzucenia |
|---|---|
| Brak cache, SSR na każde żądanie | wolniej, trudniej zmieścić LCP ≤ 2,0 s |
| Przebudowa statyczna po każdej zmianie | wolna, nie „na żywo”, zła demonstracja |
| WebSocket / SSE do odświeżania otwartych kart | zbędna złożoność; sklep nie jest panelem czasu rzeczywistego |
| Polling z klienta | ruch bez potrzeby, sprzeczny z `docs/12` §4 |

## Konsekwencje

- Każda encja ma zdefiniowany **znacznik** i listę zależności (`docs/14` §6). Dodanie pola do encji bez uzupełnienia tabeli znaczników jest błędem przeglądu (skill `taktyl-admin-sklep-sync`).
- Test odbioru (S25, nowy, `docs/12` §7): zmiana ceny Wróbla w backpanelu → odświeżenie `/myszki/wrobel` pokazuje nową cenę w ≤ 5 s, a „najniższa cena z 30 dni” jest przeliczona z historii.
