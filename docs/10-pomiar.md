# 10 · Pomiar

Warstwa danych powstaje razem ze sklepem, nie po nim. Sklep jest demonstracyjny, więc domyślnie **nie ładuje żadnego narzędzia analitycznego** — zdarzenia trafiają do `window.dataLayer` i są widoczne w panelu podglądu (F-243). Podpięcie kontenera menedżera tagów to jedna zmienna w konfiguracji (`PUBLIC_GTM_ID`), bez zmian w kodzie zdarzeń.

## 1. Zasady

1. **Jedno źródło prawdy:** zdarzenia wysyła tylko moduł `src/scripts/track.js` (`track(nazwa, parametry)`). Żadnych bezpośrednich wywołań `gtag()` ani pikseli w komponentach.
2. **Zdarzenie po potwierdzeniu, nie po kliknięciu:** `add_to_cart` po zapisaniu koszyka, `purchase` na stronie potwierdzenia po udanej symulacji płatności.
3. **Odporność na powielenie:** `purchase` wysyłany raz na `transaction_id` (lista w `taktyl.tracked.v1`). Odświeżenie potwierdzenia nie liczy drugi raz.
4. **Wartość przy każdym zdarzeniu handlowym:** `value` i `currency: "PLN"`. Kwoty jako liczby (`1203.3`), nie teksty.
5. **Zero danych osobowych:** nigdy e-mail, telefon, imię, adres, NIP. Numer zamówienia tak.
6. **Tryb zgody od początku:** domyślnie wszystko odrzucone, aktualizacja po decyzji w banerze (F-240).
7. **Nazwy zapisane raz:** poniższa lista jest ostateczna. Zmiana nazwy = nowe zdarzenie, nie edycja starego.

## 2. Tryb zgody

```js
window.dataLayer = window.dataLayer || [];
function gtag(){ dataLayer.push(arguments); }
gtag('consent', 'default', {
  ad_storage: 'denied', ad_user_data: 'denied', ad_personalization: 'denied',
  analytics_storage: 'denied', wait_for_update: 500
});
// po decyzji w banerze:
gtag('consent', 'update', { analytics_storage: 'granted' /* …tylko zaakceptowane kategorie */ });
```

Ten fragment stoi w `<head>` przed czymkolwiek innym, a decyzja zapisuje się w `taktyl.consent.v1`.

## 3. Obiekt produktu (`items[]`)

```js
{
  item_id: 'K-BZL75-GRF-PRG',          // SKU
  item_name: 'Bazalt 75',
  item_brand: 'Taktyl',
  item_category: 'klawiatury',
  item_variant: 'Grafit / Próg',        // kolor / przełącznik albo rozmiar
  price: 749.00,                        // cena jednostkowa przed rabatem setu
  quantity: 1,
  discount: 74.90,                      // rabat setu na sztukę (docs/03 §6), w innym przypadku 0
  promotion_name: 'Rabat za set 10%',   // tylko pozycje w secie
  item_list_id: 'klawiatury',           // gdzie zobaczono: kategoria, 'kreator-setu', 'dokoncz-set', 'polecane', 'wyszukiwarka'
  item_list_name: 'Klawiatury',
  index: 0                              // pozycja na liście
}
```

## 4. Zdarzenia handlowe (standard GA4)

| Zdarzenie | Kiedy | Parametry poza `items` |
|---|---|---|
| `view_item_list` | listing, Polecane, Gotowe sety — gdy lista jest w widoku (raz na listę i stronę wyników) | `item_list_id`, `item_list_name` |
| `select_item` | kliknięcie karty produktu | `item_list_id`, `item_list_name` |
| `view_item` | wejście na kartę produktu i zmiana wariantu | `currency`, `value` |
| `add_to_wishlist` | dodanie do ulubionych | `currency`, `value` |
| `add_to_cart` | zapisanie pozycji lub setu w koszyku | `currency`, `value` (po rabacie setu) |
| `remove_from_cart` | usunięcie (także rozbicie setu: usuwany element) | `currency`, `value` |
| `view_cart` | otwarcie strony koszyka i szuflady | `currency`, `value` |
| `begin_checkout` | wejście na `/zamowienie` | `currency`, `value`, `coupon` |
| `add_shipping_info` | wybór metody dostawy | `currency`, `value`, `shipping_tier` (`automat` / `kurier` / `odbior`) |
| `add_payment_info` | wysłanie formularza („Zamawiam i płacę”), także ponowna próba po błędzie | `currency`, `value`, `payment_type` (`blik` / `karta` / `przelew-online` / `przelew`) |
| `purchase` | strona potwierdzenia po udanej symulacji | `transaction_id`, `currency`, `value` (pozycje po rabatach, bez dostawy), `shipping`, `tax` (VAT zawarty w cenie: `value · 23 / 123`), `coupon` |
| `search` | wysłanie wyszukiwania lub wybór podpowiedzi | `search_term` |

## 5. Zdarzenia kreatora i sklepu (własne)

| Zdarzenie | Kiedy | Parametry |
|---|---|---|
| `set_builder_start` | pierwsze wyświetlenie kreatora w sesji | `entry_point`: `hero`, `nav`, `pdp`, `pdp_complete`, `preset`, `share_link`, `guide`, `account` |
| `set_profile_select` | wybór lub zmiana profilu | `profile`, `hand_cm` (liczba lub `null`) |
| `set_step_complete` | wybór produktu w kroku | `step`: `klawiatura` / `myszka` / `podkladka`, `item_id`, `item_name` |
| `set_fit_warning` | reguła zmienia wynik na `uwaga` | `rule` (ID z `rules.json`), `profile`, `item_ids` |
| `set_suggestion_apply` | kliknięcie propozycji zmiany | `rule`, `from_item_id`, `to_item_id`, `value_delta` |
| `set_complete` | set ma trzy kategorie (raz na zmianę 2 → 3) | `value`, `discount`, `profile`, `warnings` (liczba) |
| `set_share` | „Kopiuj link do setu” | `method`: `clipboard` / `fallback` |
| `set_save` | „Zapisz set” | `value` |
| `set_add_to_cart` | dodanie setu do koszyka (obok standardowego `add_to_cart`) | `value`, `discount`, `profile`, `preset_id`, `warnings` |
| `filter_apply` | zmiana filtra na listingu | `item_list_id`, `filter_name`, `filter_value` |
| `compare_add` | dodanie do porównania | `item_id`, `compare_count` |
| `shortcut_use` | użycie skrótu klawiszowego | `key`: `/`, `esc`, `?` |
| `payment_failed` | „Symuluj odrzuconą płatność” | `transaction_id`, `payment_type`, `value` |
| `generate_lead` | formularz kontaktu i newsletter **po potwierdzeniu wysyłki** (w demo: po walidacji) | `form_id`: `kontakt` / `newsletter`, `value: 0`, `currency` |
| `return_request` | formularz zwrotu (P2) | `transaction_id`, `value` |

## 6. Wzorzec

```js
// src/scripts/track.js
const DEBUG = new URLSearchParams(location.search).has('pomiar');
export function track(event, params = {}) {
  window.dataLayer = window.dataLayer || [];
  if (params.items) window.dataLayer.push({ ecommerce: null });   // czyszczenie poprzedniego obiektu
  const payload = params.items ? { event, ecommerce: params } : { event, ...params };
  window.dataLayer.push(payload);
  if (DEBUG) window.dispatchEvent(new CustomEvent('taktyl:track', { detail: payload }));
}
```

Panel podglądu (F-243) nasłuchuje `taktyl:track` i dopisuje zdarzenia do listy: nazwa, godzina, parametry w JSON. Panel jest wysuwany z prawej krawędzi, nie zmienia układu strony, ma przycisk „Wyczyść” i „Kopiuj jako JSON”.

## 7. Test przed oddaniem

1. `?pomiar=1`, przejście ścieżki: strona główna → Gotowe sety „Programista” → kreator → profil „Gry FPS, niski sens” i podkładka Tafla M (ostrzeżenie: 36 cm na 40 cm ruchu) → propozycja „Zmień na Tafla L” → „Dodaj set do koszyka” → koszyk → kod `TAKTYL10` (komunikat o setach) → zamówienie → automat paczkowy → BLIK → symulacja błędu → ponowna próba → sukces → potwierdzenie → odświeżenie potwierdzenia.
2. Sprawdzić w panelu: kolejność zdarzeń z §4 i §5, `value` jako liczby, `discount` w pozycjach setu sumuje się do rabatu z podsumowania, **jeden** `purchase`.
3. To samo z odrzuconą i z zaakceptowaną zgodą (zdarzenia w `dataLayer` w obu przypadkach; po podpięciu kontenera — tagi tylko przy zgodzie).
4. Po podpięciu kontenera: podgląd menedżera tagów i DebugView w GA4 — te same zdarzenia, bez duplikatów.
