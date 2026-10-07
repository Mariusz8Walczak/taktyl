# ADR-0007 · Koszyk po stronie klienta, zamówienia po stronie serwera

- **Status:** przyjęta

## Decyzja

| Obszar | Gdzie | Dlaczego |
|---|---|---|
| Koszyk, ulubione, porównanie, bieżący set | przeglądarka (`localStorage`, klucze z `docs/02` §1.2, w `try/catch`, zapas w pamięci) | brak logowania wymuszonego (F-170), zgodnie z dokumentacją; działa bez sieci do momentu wyceny |
| Wycena koszyka i weryfikacja stanów | API `POST /cart/quote` (bez cache) | ceny nie są zapisywane w koszyku (`docs/03` §7), stany z bazy (F-157) |
| Zamówienie | API `POST /orders` → baza | backpanel musi widzieć zamówienia; kwoty liczy API pakietem `domain` |
| Symulacja płatności | API `POST /orders/:id/payment/simulate` z wynikiem `paid` / `failed` | F-177…F-179; zero danych kart i kodów BLIK |
| Konto demo, „Moje zamówienia” | zamówienia powiązane z `order_token` zapisanym w przeglądarce | brak haseł (F-200) |
| Zdarzenia pomiaru | tylko klient (`track.ts` → `dataLayer`), reguły `docs/10` | dane osobowe nigdy nie opuszczają formularza zamówienia |

## Zasady API zamówienia

- Idempotencja: nagłówek `Idempotency-Key`; ponowne wysłanie tego samego klucza zwraca to samo zamówienie.
- Stan magazynu zmniejszany przy udanej płatności (nie przy utworzeniu); transakcja z blokadą wiersza wariantu, błąd „brak towaru” zwraca listę problematycznych SKU.
- Numer zamówienia `TK-RRMMDD-XXXX` generuje API (strefa `Europe/Warsaw`), unikalny.
- Dane osobowe z formularza zamówienia: przechowywane tylko tyle, ile potrzeba do pokazania w backpanelu demo; polityka retencji — usuwane przy `db:reset-demo` i po 30 dniach (zadanie cykliczne). Pola e-mail tylko w domenie `taktyl.example` są sugerowane w placeholderze; walidacja nie blokuje innych, ale UI ostrzega, że to demo.
- `purchase` w pomiarze wysyła klient po odpowiedzi `paid`, raz na `transaction_id` (`taktyl.tracked.v1`).
