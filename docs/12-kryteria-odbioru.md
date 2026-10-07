# 12 · Kryteria odbioru

Sklep jest gotowy, gdy przechodzą wszystkie punkty P0 poniżej. Każda wartość oczekiwana wynika z `data/` — jeśli wychodzi inna, błąd jest w kodzie, nie w teście.

## 1. Scenariusze (P0)

| # | Kroki | Oczekiwany wynik |
|---|---|---|
| S1 | `/klawiatury` → Rozmiar 75% + Łączność Bluetooth | „1 produkt” (Bazalt 75); adres `?rozmiar=75&lacznosc=bt`; odświeżenie zachowuje widok |
| S2 | `/klawiatury` → Cena 300–700 | „4 produkty”: Łupek 65, Kreda 98, Granit TKL, Marmur 100 |
| S3 | `/myszki` → Długość dłoni 19,5 | „5 produktów”: wszystkie poza Mewą |
| S4 | `/podkladki` → Na biurko | „5 produktów” (bez Lodu) |
| S5 | `/klawiatury/granit-tkl` | 599,00 zł; przekreślone 699,00 zł; plakietka −14%; „Najniższa cena z 30 dni przed obniżką: 699,00 zł” |
| S6 | `/myszki/wrobel` | 129,00 zł; przekreślone 139,00 zł (nie 149,00); −7% |
| S7 | `/klawiatury/bazalt-75` → Kobalt + Szept | „Brak w tym kolorze”, „Dodaj do koszyka” nieaktywny z wyjaśnieniem |
| S8 | `/myszki/jerzyk` → Mgła | „Ostatnie sztuki (zostały 2 szt.)”, ilość maks. 2 |
| S9 | Strona główna → Gotowe sety → Programista → kreator | Razem 1203,30 zł, „Oszczędzasz 133,70 zł”, „Pasuje”, „Zapas: 28,3 cm” |
| S10 | W S9: profil „Gry FPS, niski sens”, podkładka Tafla M | „Pasuje z 1 uwagą”, przycisk „Zmień na Tafla L (+30,00 zł)”; po kliknięciu „Pasuje” |
| S11 | Kreator: Marmur 100 + Jerzyk + Szron XL, profil FPS | uwaga „…ten set potrzebuje 91 cm…”, propozycja Tafla XXL |
| S12 | „Dodaj set do koszyka” | szuflada (A-03); grupa „Twój set · −10%”; licznik nagłówka +1; dostawa darmowa |
| S13 | Kod `TAKTYL10` przy samym secie | „Kod nie obejmuje setów — rabat za set jest już naliczony.” |
| S14 | + Tafla M Grafit osobno, kod `TAKTYL10` | rabat kodu −6,90 zł; razem 1265,40 zł |
| S15 | Usunięcie klawiatury z grupy setu | „Set rozdzielony — rabat 10% usunięty. Cofnij”; „Cofnij” przywraca grupę i rabat |
| S16 | Koszyk z samym Wróblem | „Brakuje 170,00 zł do darmowej dostawy” |
| S17 | Zamówienie, automat paczkowy | brak pól adresu; lista punktów filtrowana po mieście |
| S18 | Faktura na firmę, błędny NIP | komunikat pod polem, fokus na polu po próbie wysłania |
| S19 | „Zamawiam i płacę” → „Symuluj odrzuconą płatność” → „Spróbuj ponownie” → „Symuluj udaną płatność” | potwierdzenie z numerem `TK-RRMMDD-XXXX`; koszyk pusty; w historii `payment_failed`, potem jeden `purchase` |
| S20 | Odświeżenie potwierdzenia | brak drugiego `purchase` |
| S21 | „Kopiuj link do setu” → wklejenie w nowej karcie | ten sam set, ten sam profil, ten sam krok |
| S22 | Wyszukiwarka: „lupek”, „lod”, „pustulka”, „tkl” | Łupek 65, Lód, Pustułka, Granit TKL |
| S23 | `/nie-ma-takiej-strony` | strona 404 z kodem odpowiedzi 404 |
| S24 | Pierwsza wizyta | pasek demo, baner zgód z równorzędnymi przyciskami; brak zdarzeń wysyłanych do narzędzi przed zgodą |

## 2. Testy jednostkowe logiki

| Moduł | Przypadki |
|---|---|
| Ceny setów | 4 sety z `presets.json`: suma, rabat, razem zgodne co do grosza; suma rozbicia rabatu = rabat |
| Reguły dopasowania | 6 przykładów z `docs/03` §4.4 |
| Liczebniki | 0 produktów, 1 produkt, 2 produkty, 5 produktów, 12 produktów, 22 produkty, 112 produktów |
| Formatowanie | 1203.3 → „1203,30 zł”; 12999 → „12 999,00 zł” (wynik `Intl`, nie ręczny); 26000 DPI → „26 000 DPI” |
| NIP | sumy kontrolne: poprawny przechodzi, zmieniona jedna cyfra odpada, 10 cyfr wymagane. Poprawne numery **generowane w teście** z losowych cyfr i wyliczonej cyfry kontrolnej — nigdy wpisane na stałe |
| Termin wysyłki (strefa Warszawa) | środa 7.10.2026 13:00 → wysyłka dziś, kurier: czwartek, 8 października; 15:00 → wysyłka czwartek, dostawa piątek 9 października; sobota 10.10 → wysyłka poniedziałek 12, dostawa wtorek 13 października |
| Wyszukiwanie | normalizacja `ł` |
| Koszyk | `localStorage` niedostępny (rzuca wyjątek) → koszyk działa w pamięci |

## 3. Audyt systemu designu

Na każdej stronie P0, w konsoli przeglądarki:

```js
const vis = [...document.querySelectorAll('*')].filter(e => e.offsetParent);
const fs = {}; vis.forEach(e => { const s = getComputedStyle(e);
  if (e.textContent && !e.children.length && e.textContent.trim()) fs[s.fontSize] = (fs[s.fontSize]||0)+1; });
const btns = [...document.querySelectorAll('.btn-glowny')].filter(e => e.offsetParent);
const w = new Set(), r = new Set();
[...document.querySelectorAll('button, a.btn-glowny, a.btn-poboczny')].filter(e => e.offsetParent)
  .forEach(b => r.add(getComputedStyle(b).borderRadius));
btns.forEach(b => { const s = getComputedStyle(b); w.add(s.backgroundColor + '/' + s.color); });
JSON.stringify({
  rozmiarow: Object.keys(fs).length,
  rodzin: new Set(vis.slice(0, 600).map(e => getComputedStyle(e).fontFamily.split(',')[0])).size,
  wariantow_przycisku_glownego: w.size, promieni: [...r],
  male_cele: [...document.querySelectorAll('a,button,input,select,textarea,[role=button]')].filter(e => {
    const b = e.getBoundingClientRect(); return e.offsetParent && b.width > 0 && (b.width < 44 || b.height < 44); })
    .map(e => e.outerHTML.slice(0, 80)),
  zdublowane_id: [...document.querySelectorAll('[id]')].map(e => e.id).filter((v, i, a) => a.indexOf(v) !== i)
}, null, 1)
```

Oczekiwane: `rozmiarow` ≤ 7, `rodzin` = 1, `wariantow_przycisku_glownego` = 1, `promieni` tylko `10px` i `999px` (oraz `0px` dla przycisków bez tła, np. ikon), `male_cele` = [] (wyjątek: odnośniki w ciągłym tekście), `zdublowane_id` = [].

## 4. Budżet wydajności

Pomiar na łączu komórkowym i przeciętnym telefonie (PageSpeed, tryb „Komórka”).

| Co | Strony treściowe (główna, listing, karta, informacyjne) | Strony z aplikacją (kreator, koszyk, zamówienie) |
|---|---|---|
| Waga pierwszego widoku | ≤ 800 KB | ≤ 1 500 KB |
| JavaScript po kompresji | ≤ 150 KB | ≤ 400 KB |
| CSS po kompresji | ≤ 60 KB (CSS szablonu przez PurgeCSS) | ≤ 100 KB |
| Fonty | 1 plik, 64 KB | jw. |
| Żądania w pierwszym widoku | ≤ 30 | ≤ 45 |
| LCP | ≤ 2,0 s | ≤ 2,5 s |
| CLS | ≤ 0,05 | ≤ 0,1 |
| INP | ≤ 200 ms | ≤ 200 ms |
| Obce domeny | 0 | 0 |

Kontrola w konsoli:

```js
const r = performance.getEntriesByType('resource');
const kb = f => Math.round(r.filter(f).reduce((a, x) => a + (x.transferSize || 0), 0) / 1024);
const im = [...document.querySelectorAll('img')];
JSON.stringify({
  przeslane_kb: kb(() => true), js_kb: kb(x => x.initiatorType === 'script'), css_kb: kb(x => x.initiatorType === 'link'),
  zadan: r.length,
  obce_domeny: [...new Set(r.map(x => { try { return new URL(x.name).hostname } catch { return null } }).filter(Boolean))]
    .filter(h => h !== location.hostname),
  obrazki_bez_wymiarow: im.filter(i => !i.getAttribute('width') || !i.getAttribute('height')).length,
  obrazki_bez_srcset: im.filter(i => !i.srcset).length,
  obrazki_bez_alt: im.filter(i => !i.hasAttribute('alt')).length,
  viewport: document.querySelector('meta[name=viewport]')?.content,
  h1: [...document.querySelectorAll('h1')].map(h => h.textContent.trim().slice(0, 80))
}, null, 1)
```

Obrazy bez wymiarów, `srcset` i `alt`: 0 (placeholdery też mają wymiary). Viewport bez `maximum-scale`. Dokładnie jeden `h1`. Obce domeny: [].

## 5. Treść

Na zbudowanym serwisie (`dist/`):

```bash
# resztki dema i języka
grep -RInE "Ecomus|Crafto|themesflat|themezaa|lorem|ipsum|\\\$[0-9]|USD|Add to cart|Quick view|Buy now|Shop now|Wishlist|Compare" dist --include=*.html
# prawdziwe marki i usługi
grep -RIniE "cherry|gateron|kailh|logitech|razer|steelseries|corsair|hyperx|keychron|pixart|inpost|paczkomat|dpd|dhl|payu|przelewy24|visa|mastercard" dist --include=*.html
# zewnętrzne zasoby
grep -RInE "fonts\.googleapis|fonts\.gstatic|cdn\.|cdnjs|jsdelivr|unpkg" dist
# proste cudzysłowy w treści i brak twardych spacji przed jednostkami
grep -RInE ">[^<]*\"[^<]*<" dist --include=*.html
grep -RInE "[0-9] (g|mm|cm|zł|Hz|DPI)\b" dist --include=*.html
```

Każde polecenie: zero trafień (wyjątki tylko w atrybutach i skryptach, z uzasadnieniem w `docs/decyzje.md`).

## 6. Dostępność (WCAG 2.1 AA)

| Test | Sposób | Oczekiwane |
|---|---|---|
| Cała ścieżka S9 → S19 tylko klawiaturą | Tab, Shift+Tab, Enter, Spacja, strzałki, Esc | wszędzie widoczny fokus; brak pułapek; nakładki oddają fokus |
| Odnośnik „Przejdź do treści” | pierwszy Tab | widoczny, działa |
| Automatyczny skan | axe DevTools na stronach P0 | 0 błędów krytycznych i poważnych |
| Powiększenie 200% i szerokość 320 px | przeglądarka | brak przewijania w poziomie (poza tabelą porównania) |
| Czytnik ekranu w kreatorze | VoiceOver lub NVDA | słychać krok, wybór, nagłówek wyniku dopasowania, końcową cenę |
| Ograniczony ruch | emulacja `prefers-reduced-motion` | stany końcowe bez animacji |
| Skala szarości | filtr przeglądarki | wyniki dopasowania i wybrane warianty rozpoznawalne bez koloru |
| Formularze | błędy | komunikat przy polu, `aria-invalid`, `aria-describedby`, fokus na pierwszy błąd |

## 7. Scenariusze dodatkowe: backpanel, propagacja, Docker

Dodane po ADR-0001, ADR-0003, ADR-0006 i ADR-0009. Wartości oczekiwane wynikają z seedu (`data/*.json`); każdy scenariusz startuje od `db:reset-demo`. Jeśli wychodzi inna wartość, błąd jest w kodzie, nie w teście.

| # | Kroki | Oczekiwany wynik |
|---|---|---|
| S25 | Backpanel (rola editor): zmiana ceny Wróbla z 129,00 zł na 119,00 zł → `/myszki/wrobel` w sklepie (bez ręcznego odświeżania serwera) | w ≤ 5 s nowa cena 119,00 zł; przekreślona wartość to najniższa cena z 30 dni przeliczona z historii cen (nie wpisana ręcznie; w backpanelu pole tylko do odczytu); zdanie „Najniższa cena z 30 dni przed obniżką: …” zgodne z historią; w `audit_log` wpis z wartością przed i po |
| S26 | Sklep: złożenie zamówienia (S19) → backpanel, lista zamówień | zamówienie z numerem `TK-RRMMDD-XXXX`, pozycjami, kwotami i statusem po symulacji płatności widoczne na liście i w szczegółach; kwoty zgodne z koszykiem co do grosza |
| S27 | Backpanel: stan `M-JRZ-MGL` zmieniony z 2 na 0 → karta `/myszki/jerzyk` w kolorze Mgła | w ≤ 5 s „Brak w tym kolorze”, „Dodaj do koszyka” nieaktywny z wyjaśnieniem; API odrzuca zamówienie z tym SKU, zwracając listę problematycznych pozycji |
| S28 | Zalogowanie jako `viewer` (przycisk w trybie `DEMO_MODE`) → próba zapisu ceny, zmiany stanu, ustawienia i statusu zamówienia | żaden zapis nie przechodzi: interfejs ma pola nieaktywne, API odpowiada 403 na bezpośrednie wywołanie; brak wpisu w `audit_log`; w sklepie nadal brak pól hasła |
| S29 | Dowolna mutacja w backpanelu (cena, stan, ustawienie, status) | w `audit_log` wpis: użytkownik, rola, encja, pola przed → po, czas w `Europe/Warsaw`; wpisu nie da się edytować ani usunąć z poziomu API |
| S30 | Webhook propagacji: wywołanie `POST /api/revalidate` z błędnym podpisem HMAC; następnie wyłączenie sklepu, zmiana ceny, włączenie sklepu | błędny podpis: 401 i brak odświeżenia; po powrocie sklepu zdarzenie z tabeli `outbox` zostaje dostarczone (ponowienie), a cena jest widoczna bez interwencji ręcznej |
| S31 | Czysty klon repozytorium, `cp .env.example .env`, `docker compose up --build` na maszynie z samym Dockerem | wszystkie usługi `healthy`; sklep na `taktyl.localhost`, backpanel na `admin.taktyl.localhost`, API na `api.taktyl.localhost`; seed wczytany (18 produktów, 99 wariantów, 4 sety); czas od startu do działającego stosu ≤ 10 min; bez lokalnego Node i Postgresa |
| S32 | Po edycjach z S25 i S27: `make reset` (`db:reset-demo`) | dane wracają do seedu (cena Wróbla 129,00 zł, stan `M-JRZ-MGL` 2 szt.), zamówienia demo usunięte, `audit_log` wyczyszczony zgodnie z polityką demo; sklep pokazuje stan początkowy w ≤ 5 s |
| S33 | CI i lokalnie: skan sekretów (gitleaks, cała historia) i kontrola `git ls-files` | 0 sekretów; żadna ze ścieżek `html/`, `vendor/`, `*.zip`, `.env*` (poza `.env.example`) nie jest śledzona; brak prywatnych adresów e-mail i telefonów; test negatywny z próbnym plikiem kończy się błędem CI |
| S34 | `curl -I` na adres sklepu, backpanelu i API przez proxy | nagłówek `X-Robots-Tag: noindex, nofollow`; w HTML sklepu `<meta name="robots" content="noindex, nofollow">`; `robots.txt` blokuje indeksowanie |
| S35 | Bezpośrednie `POST /orders` z zaniżonymi kwotami i nieistniejącym SKU; ponowne wysłanie z tym samym `Idempotency-Key` | API ignoruje kwoty z klienta i liczy własne; nieistniejący SKU: 422 z listą; ponowienie zwraca to samo zamówienie bez duplikatu i bez podwójnego zmniejszenia stanu |
| S36 | Audyt sklepu i backpanelu (§3, §4, §6) na stosie produkcyjnym z `compose` | wartości w limitach; 0 błędów krytycznych i poważnych axe na stronach P0 i ekranach backpanelu P0; fokus, `aria-invalid`, `aria-describedby` jak w sklepie; 0 obcych domen |

### 7.1. Testy automatyczne i kontrole CI

Wszystko uruchamia się w Dockerze (ADR-0009); kontener `test` startuje od `db:reset-demo`.

| Kontrola | Narzędzie | Co sprawdza | Blokuje PR |
|---|---|---|---|
| Logika domeny | Vitest (pakiet `domain`) | §2: ceny setów, reguły z `docs/03` §4.4, liczebniki, formatowanie, NIP, termin wysyłki, normalizacja | tak |
| Kontrakt API | Vitest + Supertest (kontener z bazą) | zgodność odpowiedzi ze schematami Zod i OpenAPI; kwoty z klienta ignorowane; idempotencja zamówień; role i 403 | tak |
| Migracje i seed | skrypt w kontenerach `migrate` i `seed` | migracja od zera przechodzi, seed idempotentny (dwa uruchomienia = ten sam stan), liczby 18/99/4, historia cen daje 699 zł i 139 zł | tak |
| Scenariusze S1 do S36 | Playwright (kontener `test`) | pełne ścieżki sklepu i backpanelu, propagacja ≤ 5 s | tak |
| Dostępność | axe-core w Playwright | 0 błędów krytycznych i poważnych na stronach P0 i ekranach backpanelu P0 | tak |
| Budżet wydajności i design | Lighthouse CI + skrypt audytu z §3 | wartości z §3 i §4 na stosie produkcyjnym | tak |
| Treść | skrypt z §5 | zero trafień (marki, dema szablonu, lorem, proste cudzysłowy) | tak |
| Tokeny | skrypt CI | `#[0-9a-fA-F]{3,8}` i `rgb(` poza plikiem tokenów: 0; brak `z-index` spoza `--z-*`; brak animacji `width`, `height`, `top`, `left` | tak |
| Sekrety i ścieżki | gitleaks + `git ls-files` | S33 | tak |
| Obrazy Docker | buildx + skan podatności | użytkownik nie-root, brak sekretów w warstwach, przypięte wersje | tak |
| Zależności | `pnpm audit`, Dependabot | brak wysokich i krytycznych podatności | tak (wysokie i krytyczne) |
| ID w commitach | skrypt na komunikacie commita | komunikat zawiera `F-`, `A-`, `B-` lub `I-` (reguła 8 `CLAUDE.md`) | tak |

### 7.2. Pokrycie automatyczne S25 do S36 (Playwright, projekt `backpanel`, TAKTYL-54)

Pliki w `e2e/tests/backpanel/`; projekt `backpanel` startuje po S1-S24 (zmienia dane wspólne ze sklepem), a dane wracają do seedu przy kolejnym `db:reset-demo` (`e2e-reset` przed przebiegiem albo `make reset`).

| # | Plik | Stan |
|---|---|---|
| S25 | `s25-cena-propagacja.spec.ts` (też B-S2) | automatyczny; mierzy czas od zapisu do nowej ceny w sklepie (budżet 5 s) |
| S26 | `s26-zamowienie-w-panelu.spec.ts` (też B-S6) | automatyczny |
| S27 | `s27-stan-brak.spec.ts` (też B-S3) | automatyczny z odstępstwem od brzmienia (Q-08): kafel Mgła nieaktywny z „Brak”, koszyk blokuje, API 409 |
| S28 | `s28-s29-role-i-dziennik.spec.ts` (też B-S5) | automatyczny; viewer to konto z setupu (stos e2e ma `DEMO_MODE=false`) |
| S29 | `s28-s29-role-i-dziennik.spec.ts` | automatyczny (cena, stan, status zamówienia; ustawienia w B-S4) |
| S30 | `s30-s34-s35-webhook-i-api.spec.ts` | błędny i poprawny podpis: automatyczny; część „wyłącz sklep, zmień cenę, włącz sklep”: `test.fixme` (kontener e2e nie steruje Dockerem), należy do job-a CI `e2e-demo` (TAKTYL-71) |
| S31 | CI `e2e-demo` | poza e2e |
| S32 | `smoke-demo` / CI `e2e-demo` | w e2e tylko negatyw: bez `DEMO_MODE` brak przycisku resetu i viewer |
| S33 | CI (gitleaks, kontrola ścieżek) | poza e2e |
| S34 | `s30-s34-s35-webhook-i-api.spec.ts` | automatyczny (nagłówki na 3 hostach, meta i `robots.txt` sklepu) |
| S35 | `s30-s34-s35-webhook-i-api.spec.ts` | automatyczny |
| S36 | `b-s-panel.spec.ts` (axe ekranów panelu); reszta (Lighthouse, audyt designu, 0 obcych domen panelu) | axe: automatyczny; reszta w TAKTYL-71 |
| B-S1, B-S4, B-S7, B-S8 | `b-s-panel.spec.ts` | automatyczne (B-S8 opisuje aktualne zachowanie: ostrzeżenie, nie blokada, Q-07) |

## 8. Pomiar

`docs/10` §7 — kolejność zdarzeń, liczby zamiast tekstów, jeden `purchase`.

## 9. Na koniec

- Obejrzane na prawdziwym telefonie (nie tylko w emulatorze): pierwszy ekran, kreator z dolnym paskiem, zamówienie.
- Obejrzane w ciemnej sekcji: fokus i przyciski mają jasny kobalt, nie ciemny.
- `docs/decyzje.md` zawiera każdą decyzję spoza dokumentacji i każdy brak (ikona, zdjęcie).
