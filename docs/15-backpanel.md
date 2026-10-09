# 15 · Backpanel

Aplikacja `apps/admin` (Next.js, React) do zarządzania sklepem Taktyl. Uzupełnia `docs/02` o funkcje z przedrostkiem **B-** (D-001 w `docs/decyzje.md`). Uwierzytelnianie i role: ADR-0006. Propagacja zmian do sklepu: ADR-0003. Dane i historia cen: ADR-0005. Wszystko działa w Dockerze (ADR-0009).

Zasady wspólne z resztą projektu: tokeny z `docs/06` (nic poza `:root`), ton i słownik z `docs/01` §4, bez grafiki (`docs/09`), bez prawdziwych marek, adresy e-mail tylko `@taktyl.example`, kwoty w groszach, liczebniki przez `Intl.PluralRules('pl')`, daty w `Europe/Warsaw`.

**Priorytety:** P0 — bez tego nie da się pokazać zmiany w backpanelu widocznej w sklepie. P1 — pełny backpanel. P2 — później.

## 1. Cel

Pokazać, że sklep jest prawdziwą aplikacją: człowiek zmienia cenę, stan, opis albo ustawienie, a sklep pokazuje to w ciągu 5 sekund (S25 w `docs/12` §7). Backpanel nie jest narzędziem do dopisywania danych przez model: model niczego nie wpisuje do panelu ani do seedu (ADR-0005).

## 2. Decyzje o wyglądzie i komponentach (D-002)

- Szablon nie ma panelu administracyjnego, więc to wyjątek z reguły 3: komponenty są **bezstylowymi prymitywami Radix UI** (okno, menu, zakładki, przełącznik, lista wyboru, popover, podpowiedzi) ostylowanymi wyłącznie tokenami z `docs/06`.
- Tabele: TanStack Table. Formularze: React Hook Form + schematy Zod z `packages/contracts`. Stan serwera: TanStack Query.
- Te same tokeny co sklep (`packages/tokens`): jeden akcent (`--akcent`) wyłącznie na przycisku głównym, odnośnikach, wybranym wierszu/kaflu i fokusie. Jeden przycisk główny na ekranie. Siedem rozmiarów czcionki, promienie `--r` i `--r-pelny`.
- Ikony wyłącznie z fontu ikon szablonu. Brak ikony w zestawie → sam tekst, wpis w `docs/decyzje.md`.
- **Zero grafiki:** brak wykresów rysowanych SVG/canvas, brak ilustracji w pustych stanach. Pulpit pokazuje liczby i listy. Pusty stan to tekst i jeden przycisk.
- Układ: lewa nawigacja stała (komputer) / szuflada (telefon, 360 px), treść do `--max`, pasek stanu zapisu u góry formularza. Sekcje ciemne (`.sekcja--mod`) tylko w nagłówku nawigacji.
- Język: polski. Skróty klawiszowe backpanelu: `/` szukaj w tabeli, `Esc` zamyka okno, `g` potem `p`/`z`/`t` (produkty/zamówienia/treści) — wyłączane przełącznikiem w profilu (WCAG 2.1.4), nie działają w polach tekstowych.

## 3. Role i macierz uprawnień

| Rola | Kto | Zakres |
|---|---|---|
| `owner` | konto z `ADMIN_BOOTSTRAP_*`, właściciel | wszystko, w tym ustawienia, użytkownicy, resetowanie danych demo |
| `editor` | osoba prowadząca sklep | katalog, treści, zamówienia, media; ustawienia tylko do odczytu |
| `viewer` | konto „demo”, bez hasła (tylko `DEMO_MODE=true`) | tylko odczyt wszystkiego; dane osobowe w zamówieniach zamaskowane |

| Obszar | owner | editor | viewer |
|---|---|---|---|
| Pulpit (B-600) | odczyt | odczyt | odczyt |
| Produkty i warianty: odczyt | tak | tak | tak |
| Produkty i warianty: zapis, ceny, stany, plakietki, archiwizacja | tak | tak | nie |
| Zamówienia: lista i szczegóły | pełne dane | pełne dane | dane zamaskowane |
| Zamówienia: zmiana statusu, notatki | tak | tak | nie |
| Opisy, opinie, poradniki, strony, FAQ: zapis | tak | tak | nie |
| Zgłoszenia (kontakt, newsletter): odczyt / usuwanie | tak / tak | tak / nie | zamaskowane / nie |
| Media: lista, wgrywanie | tak | tak | tylko lista |
| Ustawienia sklepu: zapis | tak | nie (odczyt) | nie (odczyt) |
| Użytkownicy backpanelu | tak | nie | nie |
| Dziennik zmian (audyt) | pełny | pełny | pełny, bez wartości pól osobowych |
| Reset danych demo | tak | nie | nie |

Kontrola dostępu: guard w API (autorytatywny) + ukrycie kontrolek w UI (wygoda). UI nigdy nie jest jedyną barierą.

## 4. Mapa ekranów

Domena: `admin.taktyl.localhost` (ADR-0009). Adresy bez polskich znaków, małymi literami, bez końcowego ukośnika.

| Adres | Po co | Role | P |
|---|---|---|---|
| `/logowanie` | wejście do backpanelu, „Wejdź jako viewer” w trybie demo | wszyscy | P0 |
| `/` | pulpit: liczby i ostatnie zmiany | wszystkie | P0 |
| `/produkty` | lista produktów z filtrami | wszystkie (zapis: owner, editor) | P0 |
| `/produkty/{id}` | edycja produktu: dane, warianty, ceny, stany, plakietki, podgląd w sklepie | wszystkie (zapis: owner, editor) | P0 |
| `/produkty/{id}/ceny` | historia cen wariantu i wyliczone `lowest_30d` | wszystkie | P0 |
| `/zamowienia` | lista zamówień | wszystkie | P0 |
| `/zamowienia/{numer}` | szczegóły, zmiana statusu, notatki | wszystkie (zapis: owner, editor) | P0 |
| `/tresci/opisy` | opisy produktów | wszystkie (zapis: owner, editor) | P1 |
| `/tresci/opinie` | opinie demonstracyjne | wszystkie (zapis: owner, editor) | P1 |
| `/tresci/poradnik` i `/tresci/poradnik/{slug}` | poradniki | wszystkie (zapis: owner, editor) | P1 |
| `/tresci/strony` i `/tresci/strony/{slug}` | strony informacyjne i prawne | wszystkie (zapis: owner, editor) | P1 |
| `/tresci/faq` | pytania i odpowiedzi | wszystkie (zapis: owner, editor) | P1 |
| `/zgloszenia` | wiadomości z formularza kontaktu i zapisy do newslettera | wszystkie (maskowanie dla viewera) | P1 |
| `/ustawienia` | ustawienia sklepu (zakładki) | odczyt wszyscy, zapis owner | P0 |
| `/media` | manifest zdjęć i wgrywanie | wszystkie (zapis: owner, editor) | P1 |
| `/dziennik` | dziennik zmian | wszystkie | P1 |
| `/uzytkownicy` | konta backpanelu | owner | P2 |
| `/profil` | skróty klawiszowe, wylogowanie | zalogowani | P1 |
| `/404` | nieznany adres, odnośnik do pulpitu | wszyscy | P0 |

## 5. Znaczniki rewalidacji (przypomnienie)

Zapis w API wylicza znaczniki i po zatwierdzeniu transakcji wysyła je do sklepu (ADR-0003). Nazwy znaczników używane w tym dokumencie; **tabela autorytatywna: `docs/14` §6**.

| Znacznik | Czego dotyczy |
|---|---|
| `catalog` | listingi, filtry, wyszukiwarka, strona główna (Polecane, kategorie, gotowe sety) |
| `category:{slug}` | listing jednej kategorii |
| `product:{slug}` | karta produktu i karty tego produktu na listingach |
| `presets` | gotowe sety (ceny liczone z produktów) |
| `shop-settings` | pasek warunków, progi, dostawa, kody, stopka, etykieta demo |
| `content:{slug}` | jedna strona informacyjna/prawna/poradnik |
| `content:guide` | lista poradników |
| `reviews:{slug}` | opinie przykładowe na karcie produktu |
| `content:faq` | strona FAQ |

---

## 6. B-001 – B-099 · Uwierzytelnianie, sesja, role, tryb demo, dziennik

| ID | Funkcja | P | Kryterium odbioru |
|---|---|---|---|
| B-001 | Logowanie e-mailem i hasłem (argon2id po stronie API) | P0 | poprawne dane → pulpit; błędne → komunikat „Nieprawidłowy e-mail lub hasło.” bez wskazywania, które pole jest błędne |
| B-002 | Sesja w ciasteczku `HttpOnly; Secure; SameSite=Strict`, wygasa po bezczynności (30 min) i po 12 h | P0 | po wygaśnięciu: komunikat „Sesja wygasła. Zaloguj się ponownie.”, powrót do tej samej strony po zalogowaniu |
| B-003 | Ochrona CSRF dla mutacji (token w nagłówku) | P0 | mutacja bez tokenu → 403, w UI komunikat „Odśwież stronę i spróbuj ponownie.” |
| B-004 | Limit prób logowania (np. 5 / 15 min na konto i adres IP) | P0 | szóste logowanie → „Za dużo prób. Spróbuj za 15 minut.” |
| B-005 | Konto początkowe z `ADMIN_BOOTSTRAP_EMAIL` i `ADMIN_BOOTSTRAP_PASSWORD` przy pierwszym starcie; brak haseł w repozytorium | P0 | bez zmiennych API nie tworzy konta i loguje ostrzeżenie; w repo wyłącznie `.env.example` z placeholderami w domenie `taktyl.example` |
| B-006 | Role `owner`, `editor`, `viewer`; guard w API sprawdza rolę przy każdej mutacji | P0 | `viewer` wysyłający mutację bezpośrednio do API dostaje 403; macierz z §3 przechodzi testem automatycznym |
| B-007 | Tryb demo (`DEMO_MODE=true`): przycisk „Wejdź jako viewer” na ekranie logowania, bez pola hasła | P0 | przycisk widoczny tylko przy `DEMO_MODE`; sesja `viewer` bez żadnej mutacji |
| B-008 | Maskowanie danych osobowych dla `viewer` (e-mail, telefon, imię, adres, NIP): „a***@taktyl.example”, „+48 *** *** 000” | P0 | wartości w odpowiedzi API są już zamaskowane, nie tylko w UI |
| B-009 | Wylogowanie | P0 | ciasteczko unieważnione po stronie serwera; Wstecz nie pokazuje danych |
| B-010 | Zmiana własnego hasła | P1 | wymaga starego hasła; minimum 12 znaków; komunikat błędu mówi, co poprawić |
| B-011 | Dziennik zmian (`audit_log`): kto, co, encja, wartości przed → po, kiedy (`Europe/Warsaw`) przy każdej mutacji | P0 | zmiana ceny tworzy wpis z wartością przed i po; wpis powstaje w tej samej transakcji co zmiana |
| B-012 | Widok dziennika z filtrami (osoba, encja, zakres dat) | P1 | filtry w adresie; licznik wyników z poprawną odmianą |
| B-013 | Zarządzanie kontami backpanelu (dodaj, zmień rolę, wyłącz) | P2 | ostatniego `owner` nie da się wyłączyć |
| B-014 | Reset danych demo (`db:reset-demo`) z przycisku | P1 | tylko `owner` i tylko `DEMO_MODE`; wymaga potwierdzenia w treści (nie `confirm()`) wpisaniem słowa „reset”; po resecie dane = seed |
| B-015 | Skróty klawiszowe backpanelu z przełącznikiem „Wyłącz skróty” | P2 | wyłączenie zapamiętane; skróty nie działają w polach tekstowych |

### 6.1. Ekran `/logowanie`

- **Układ:** jedna kolumna do 420 px, nagłówek H1 „Zaloguj się do backpanelu”, pola E-mail i Hasło (etykiety nad polami), przycisk główny „Zaloguj się”. W trybie demo pod spodem przycisk poboczny „Wejdź jako viewer” i zdanie „Tylko do odczytu. Nic nie zmienisz.”. Nad formularzem pasek demo z `shop.json → demo.label`.
- **Walidacje:** E-mail wymagany i w formacie adresu; hasło wymagane. Komunikaty: „Wpisz adres e-mail.”, „Wpisz hasło.”.
- **Stany:** ładowanie — przycisk z wskaźnikiem szablonu, etykieta zostaje; błąd logowania — komunikat w treści (alert z ikoną) nad polami, fokus na nim; limit prób — komunikat z B-004, przycisk nieaktywny z podanym powodem.
- **Klawiatura:** kolejność E-mail → Hasło → „Zaloguj się” → „Wejdź jako viewer”; Enter w polu wysyła formularz.
- **Znaczniki rewalidacji:** brak (nie zmienia danych sklepu).

---

## 7. B-100 – B-199 · Katalog

| ID | Funkcja | P | Kryterium odbioru |
|---|---|---|---|
| B-100 | Lista produktów: nazwa, kategoria, liczba wariantów, cena od, suma stanów, plakietki, status (`aktywny` / `ukryty`) | P0 | 18 produktów po świeżym seedzie; sortowanie po nagłówku kolumny |
| B-101 | Filtry listy: kategoria, status, „ma warianty bez stanu”, „w promocji”, szukaj po nazwie lub SKU (normalizacja `ł` jak `docs/04` §9) | P0 | „lupek” znajduje „Łupek 65”; filtry w adresie; licznik z odmianą |
| B-102 | Edycja produktu: nazwa, slug, `short`, atrybuty wg `docs/04` §4, zawartość zestawu (`in_box`), dane GPSR, `fit` (0–3 dla profilu) | P0 | zapis zmienia kartę w sklepie; błędne wartości odrzucone z komunikatem pod polem |
| B-103 | Edycja wariantu: SKU (tylko odczyt po utworzeniu), kolor z `colors.json`, przełącznik z `switches.json` lub rozmiar podkładki, domyślny wariant produktu | P0 | nie da się ustawić domyślnego wariantu bez stanu, gdy jest dostępny inny (ostrzeżenie, nie blokada) |
| B-104 | Zmiana ceny wariantu w złotych z dwoma miejscami po przecinku; API zapisuje grosze (liczba całkowita) i dopisuje wiersz do historii cen | P0 | wpis `price_history` z datą i osobą; nowa cena w sklepie w ≤ 5 s (S25) |
| B-105 | Historia cen wariantu (tabela: data, cena, osoba) i wyliczone `lowest_30d` tylko do odczytu, z objaśnieniem „Liczone z historii cen z ostatnich 30 dni. Nie wpisujesz tego ręcznie.” | P0 | brak jakiegokolwiek pola edycji `lowest_30d`; wartość zgodna z regułą Omnibus z `docs/04` §5.2 |
| B-106 | Podgląd promocji przed zapisem: jeśli nowa cena jest niższa niż najniższa z 30 dni, panel pokazuje plakietkę „−X%” policzoną wzorem z `docs/04` §5.2 i zdanie dla klienta „Najniższa cena z 30 dni przed obniżką: …” | P0 | dla Granit TKL: −14% i 699,00 zł; dla Wróbla: −7% i 139,00 zł |
| B-107 | `regular_price` jako pole wewnętrzne, opisane „Tylko do użytku wewnętrznego. Nie jest pokazywane klientom.” | P1 | wartość nigdzie nie trafia do sklepu jako cena przekreślona |
| B-108 | Stany magazynowe wariantów: edycja liczby (0 lub więcej, liczba całkowita) z podglądem etykiety wg `docs/04` §5.3 (Brak / Ostatnie sztuki / Dostępny) | P0 | stan 0 → w sklepie „Brak w tym kolorze”, przycisk koszyka nieaktywny (S7); stan 2 → „zostały 2 szt.” (S8) |
| B-109 | Plakietki ręczne: `nowosc`, `bestseller`; plakietki „Promocja” i „Ostatnie sztuki” i „Brak” wyliczane, tylko do odczytu | P0 | wyliczane nie mają kontrolki edycji; „Ostatnie sztuki” tylko z danych (stan ≤ 3) |
| B-110 | Archiwizacja i przywracanie produktu (`status = archived`) zamiast usuwania; twarde usunięcie tylko dla produktu bez zamówień | P0 | produkt ukryty znika z listingu, wyszukiwarki i gotowych setów; adres karty daje 404; zamówione pozycje zachowują nazwę i cenę |
| B-111 | Dodawanie nowego produktu i wariantu | P1 | formularz wymusza komplet atrybutów dla kategorii; nowy SKU zgodny ze wzorem `docs/04` §3.1 |
| B-112 | Podgląd „Tak to wygląda w sklepie”: osadzone okno z kartą produktu i kartą listingu, odświeżane po zapisie | P1 | odświeża się po sygnale zakończenia rewalidacji; dostępne z klawiatury (okno z pułapką fokusu) |
| B-113 | Ostrzeżenie o skutkach zmiany: gotowy set, którego ceny się zmieniają; wariant użyty w `presets.json` ukrywany lub bez stanu | P1 | komunikat „Ten produkt jest w 2 gotowych setach. Ich ceny zmienią się razem z nim.” (odmiana przez `PluralRules`) |
| B-114 | Edycja gotowych setów (SKU, nazwa, `note`); cena liczona, nie wpisywana | P2 | suma i rabat zgodne z `docs/03` §6 |
| B-115 | Operacje zbiorcze na liście: ustaw status, dodaj/usuń plakietkę | P2 | jedna transakcja, jeden wpis w dzienniku na produkt |

### 7.1. Ekran `/produkty`

- **Układ:** H1 „Produkty” z licznikiem („18 produktów”), pasek narzędzi (szukaj, filtry w żetonach, „Dodaj produkt” — przycisk główny, P1), tabela pod spodem. Na telefonie tabela przewija się poziomo z przyklejoną kolumną nazwy.
- **Pola tabeli:** Nazwa, Kategoria, Warianty, Cena od, Stan łącznie, Plakietki, Status.
- **Stany:** pusty (brak wyników filtra) — „Nic tu nie pasuje do filtrów.” + „Wyczyść filtry”; ładowanie — szkielet wierszy (A-18); błąd — komunikat „Nie udało się pobrać produktów.” + „Spróbuj ponownie”.
- **Klawiatura:** nagłówki kolumn to przyciski sortowania (`aria-sort`); wiersz ma jeden odnośnik na nazwie, cały wiersz klikalny przez pseudoelement; `/` ustawia fokus w polu szukaj.
- **Znaczniki:** brak (odczyt). Zmiana statusu z listy (P2): jak B-110.

### 7.2. Ekran `/produkty/{id}`

- **Układ:** H1 = nazwa produktu, pasek stanu zapisu u góry („Zapisano 14:32” / „Niezapisane zmiany”), zakładki: **Dane**, **Warianty i ceny**, **Opis**, **Opinie**, **Zdjęcia**. Prawa kolumna na komputerze: „Tak to wygląda w sklepie” (B-112) i lista znaczników, które zostaną odświeżone.
- **Dane:** nazwa (wymagana, 2–60 znaków), slug (wymagany, małe litery, cyfry, łącznik; unikalny), `short` (wymagane, 20–200 znaków), atrybuty kategorii (pola typowane według `docs/04` §4, jednostki podpowiedziane), `in_box` (lista wierszy), GPSR (producent, adres, kontakt `@taktyl.example`, ostrzeżenia), `fit` (pięć pól 0–3).
- **Warianty i ceny:** tabela wariantów (SKU, kolor, przełącznik/rozmiar, cena, stan, status); wiersz otwiera okno edycji (Radix Dialog) z polami ceny i stanu oraz odnośnikiem „Historia cen”. Przycisk „Zapisz” w oknie zapisuje wariant od razu (jedna transakcja).
- **Walidacje i komunikaty:** cena — liczba ≥ 0,01, maks. dwa miejsca po przecinku: „Wpisz cenę w złotych, np. 749,00.”; stan — liczba całkowita ≥ 0: „Wpisz całkowitą liczbę sztuk, np. 17.”; slug zajęty: „Ten adres jest już używany. Wybierz inny.”; GPSR kontakt poza domeną: „Użyj adresu w domenie taktyl.example.”; marka inna niż Taktyl: „W sklepie demonstracyjnym wszystkie produkty są marki Taktyl.”.
- **Stany:** ładowanie — szkielet; błąd zapisu — komunikat w treści z ikoną nad formularzem, pola z `aria-invalid` i `aria-describedby`, fokus na pierwszy błąd; konflikt edycji (ktoś zapisał wcześniej) — „Ten produkt zmienił się, odkąd go otworzyłeś. Wczytaj zmiany i spróbuj ponownie.” (kontrola wersji `updated_at`).
- **Klawiatura:** zakładki natywnie (strzałki), okna z pułapką fokusu, Esc zamyka, fokus wraca na wiersz, z którego okno otwarto.
- **Znaczniki po zapisie:** `product:{slug}`, `category:{kategoria}`, `catalog`, a przy zmianie ceny, stanu lub statusu także `presets`. Zmiana slugu odświeża też stary adres (`product:{stary-slug}`).

### 7.3. Ekran `/produkty/{id}/ceny`

- **Układ:** wybór wariantu (lista), tabela historii (Data, Cena, Zmienił), pod nią blok „Cena przy obniżce”: aktualna cena, najniższa z 30 dni, plakietka z procentem, zdanie dla klienta. Nic nie jest edytowalne poza przejściem do edycji wariantu.
- **Stany:** pusty — „Ten wariant nie ma jeszcze historii cen.” (nie występuje po seedzie).
- **Znaczniki:** brak (odczyt).

---

## 8. B-200 – B-299 · Zamówienia

| ID | Funkcja | P | Kryterium odbioru |
|---|---|---|---|
| B-200 | Lista zamówień: numer `TK-RRMMDD-XXXX`, data, status, metoda dostawy, płatność, wartość, liczba pozycji | P0 | zamówienie z S19 widoczne po „Symuluj udaną płatność” |
| B-201 | Filtry listy: status, metoda dostawy, zakres dat, szukaj po numerze | P0 | filtry w adresie; licznik z odmianą |
| B-202 | Szczegóły zamówienia: pozycje (w tym grupy setów z rabatem), kwoty (produkty, rabat setu, kod, dostawa, razem), dostawa, faktura (NIP), płatność, historia statusów | P0 | kwoty co do grosza zgodne z koszykiem klienta |
| B-203 | Zmiana statusu zgodna z maszyną stanów (`docs/18` §E); niedozwolone przejścia niedostępne z powodem | P0 | przycisk „Oznacz jako wysłane” tylko ze statusu `w_realizacji`; API odrzuca inne przejścia z 409 |
| B-204 | Notatki wewnętrzne do zamówienia (z autorem i czasem), niewidoczne dla klienta | P1 | notatka w dzienniku zmian; w sklepie niewidoczna |
| B-205 | Anulowanie zamówienia z powodem; zwrot stanów do magazynu | P0 | po anulowaniu opłaconego zamówienia stan wariantów rośnie o zamówione sztuki, jeden wpis w dzienniku |
| B-206 | Podgląd „Tak widzi to klient” strony potwierdzenia/statusu | P2 | tylko do odczytu |
| B-207 | Wydruk faktury demo (`docs/02` F-206) | P2 | oznaczona „dokument demonstracyjny” |
| B-208 | Maskowanie danych osobowych w zamówieniu dla `viewer` | P0 | jak B-008 |
| B-209 | Zadanie cykliczne: usuwanie danych osobowych z zamówień po 30 dniach (ADR-0007) | P1 | po upływie terminu pola osobowe puste, numer i kwoty zostają |

### 8.1. Ekran `/zamowienia`

- **Układ:** H1 „Zamówienia” z licznikiem, żetony statusów, tabela. Brak przycisku „Dodaj”: zamówienia powstają tylko w sklepie.
- **Stany:** pusty — „Nie ma jeszcze zamówień. Złóż pierwsze w sklepie demonstracyjnym.” z odnośnikiem „Otwórz sklep”; ładowanie, błąd jak w §7.1.
- **Klawiatura:** jak §7.1; wiersz otwiera szczegóły.
- **Znaczniki:** brak.

### 8.2. Ekran `/zamowienia/{numer}`

- **Układ:** H1 = numer, pod nim status jako plakietka z tekstem; dwie kolumny: lewa — pozycje, kwoty, notatki; prawa — status i akcje, dostawa, faktura, płatność, historia statusów (lista z czasem w `Europe/Warsaw`).
- **Akcje:** jedna akcja główna zależna od statusu (np. „Rozpocznij realizację”), akcje poboczne („Anuluj zamówienie”, „Dodaj notatkę”).
- **Walidacje i komunikaty:** anulowanie wymaga powodu (min. 5 znaków): „Podaj powód anulowania.”; niedozwolone przejście: „Z tego statusu nie da się przejść do wybranego. Odśwież stronę.”; zamówienie zmienione przez kogoś: komunikat o konflikcie jak §7.2.
- **Stany:** ładowanie — szkielet; błąd — komunikat + „Spróbuj ponownie”; nieznany numer — strona 404.
- **Klawiatura:** akcje jako przyciski; okno anulowania z pułapką fokusu; po zapisie fokus na nagłówek statusu (`tabindex="-1"`), zmiana ogłoszona przez `role="status"`.
- **Znaczniki po zapisie:** brak dla stron katalogowych; **anulowanie z powrotem stanów** wywołuje `product:{slug}` i `catalog` dla każdego dotkniętego wariantu. Status zamówienia jest widoczny w „Moje zamówienia” klienta przez API bez cache (nie wymaga znacznika).

---

## 9. B-300 – B-399 · Treści

Treści pisze model według `docs/04` §7–8, `docs/01` §4 i `docs/11`, człowiek zatwierdza w backpanelu (D-003). Backpanel pozwala edytować i zatwierdzać.

| ID | Funkcja | P | Kryterium odbioru |
|---|---|---|---|
| B-300 | Opisy produktów: edytor tekstu (akapity, bez obrazów), status `szkic` / `zatwierdzony`; w sklepie widoczne tylko zatwierdzone | P1 | produkt bez zatwierdzonego opisu: zakładka „Opis” w sklepie ukryta, nie pusta |
| B-301 | Walidator opisu: 60–120 słów, 2–3 akapity; zakazane słowa („najlepszy”, „rewolucyjny”, „profesjonalny”, „premium”, „idealny”, „niesamowity”, „ultra-”); brak nazw marek spoza Taktyl; ostrzeżenie o liczbach niewystępujących w atrybutach | P1 | zakazane słowo, długość i akapity: ostrzeżenia z listą słów, zapis przechodzi; marka i obietnica medyczna: 422 (Q-07) |
| B-302 | Opinie demonstracyjne: autor (imię + inicjał), data (do 6 miesięcy wstecz), ocena 3–5, wariant, tekst 1–4 zdania; flaga `demo = true` nieusuwalna | P1 | 3–6 opinii na produkt; walidacja odrzuca ocenę poza 3–5 |
| B-303 | Etykieta „Opinie przykładowe — sklep demonstracyjny” i średnia z liczbą opinii wyliczane przez sklep, bez możliwości wyłączenia | P1 | brak kontrolki usuwającej etykietę; średnia „4,6 · 5 opinii” |
| B-304 | Poradniki (4 artykuły z F-220): tytuł, slug, treść, ustawiony profil kreatora (`profil` do końcowego odnośnika), status | P1 | artykuł 600–900 słów (walidator liczby słów), kończy się wejściem do kreatora z ustawionym profilem |
| B-305 | Strony informacyjne i prawne (F-221): treść, slug, nagłówek „Wzór treści dla sklepu demonstracyjnego Taktyl. Nie stanowi oferty.” wstawiany automatycznie i nieusuwalny | P1 | edycja jest możliwa, ale nagłówek zawsze renderuje sklep |
| B-306 | Walidator treści prawnych: brak odnośnika do platformy ODR, brak numerów NIP/REGON/KRS (w ich miejscu „— (sklep fikcyjny)”), e-maile tylko `@taktyl.example` | P1 | zapis z zakazanym wzorcem odrzucony z wskazaniem miejsca |
| B-307 | FAQ: pary pytanie–odpowiedź, kolejność przeciąganiem **lub** przyciskami „Wyżej / Niżej” (alternatywa dla przeciągania) | P1 | zmiana kolejności działa samą klawiaturą |
| B-308 | Zgłoszenia z formularza kontaktu i newslettera: lista (data, typ, e-mail, temat, wiadomość), status „nowe/obsłużone”; w demo nic nie jest wysyłane | P1 | zgłoszenie z `/kontakt` pojawia się na liście; `viewer` widzi dane zamaskowane |
| B-309 | Usuwanie zgłoszeń (RODO w demo) | P2 | tylko `owner`; wpis w dzienniku |
| B-310 | Podgląd treści przed zatwierdzeniem („Tak to wygląda w sklepie”) | P2 | tylko do odczytu |

### 9.1. Ekrany treści (`/tresci/*`, `/zgloszenia`)

- **Układ:** lista z tytułem, statusem i datą zmiany; edycja w drugim ekranie: tytuł, slug, treść (jedna kolumna tekstu do 720 px jak w sklepie), pasek statusu walidatora pod edytorem (liczba słów, lista ostrzeżeń i błędów), przycisk główny „Zatwierdź” (po przejściu walidacji), poboczny „Zapisz szkic”.
- **Komunikaty walidatora:** „Opis ma 48 słów. Potrzeba 60–120.”, „Usuń słowo „idealny”.”, „Wpisz adres w domenie taktyl.example.”, „Nie podawaj numerów NIP, REGON ani KRS. Wpisz „— (sklep fikcyjny)”.”.
- **Stany:** pusty — „Nie ma jeszcze treści w tej sekcji. Dodaj pierwszą.” + przycisk; ładowanie — szkielet; błąd — komunikat + „Spróbuj ponownie”.
- **Klawiatura:** edytor tekstu nie przechwytuje Tab (Esc wychodzi z edytora, zgodnie z wzorcem WCAG); wszystkie akcje jako przyciski z pełną treścią.
- **Znaczniki po zapisie:** opis produktu — `product:{slug}`; opinie — `reviews:{slug}`, `product:{slug}`; poradnik — `content:{slug}`, `content:guide` (oraz `catalog`, bo strona główna ma 3 karty artykułów); strona informacyjna — `content:{slug}`; FAQ — `content:faq`; zgłoszenia — brak.

---

## 10. B-400 – B-499 · Ustawienia sklepu

Odpowiednik `data/shop.json`. Zapis tylko `owner`; `editor` i `viewer` widzą wartości tylko do odczytu.

| ID | Funkcja | P | Kryterium odbioru |
|---|---|---|---|
| B-400 | Próg darmowej dostawy w złotych (w bazie grosze) | P0 | zmiana progu zmienia komunikat „Brakuje X zł do darmowej dostawy” w koszyku (S16) |
| B-401 | Rabat setu: procent (0–50) i wymagane kategorie (`requires_categories`) | P0 | zmiana procentu przelicza ceny gotowych setów; arytmetyka w groszach wg `docs/03` §6 |
| B-402 | Metody dostawy: nazwa (opisowa, bez nazw handlowych przewoźników), cena, `eta_business_days`, pola wymagane w kasie (`fields`) | P0 | dodanie pola adresu do metody pokazuje je w kasie, brak pól adresu przy automacie (S17) |
| B-403 | Metody płatności (tekstem: BLIK, karta płatnicza, przelew online, przelew), włączone/wyłączone | P0 | wyłączona metoda znika z kasy; brak logotypów |
| B-404 | Kody rabatowe: kod, rodzaj (procent lub kwota), wartość, czy obejmuje pozycje w setach (domyślnie nie), aktywny | P0 | `TAKTYL10` nie obejmuje setów (S13, S14); duplikat kodu odrzucony |
| B-405 | Punkty odbioru (automaty paczkowe): nazwa, miasto, ulica, kod pocztowy — wyłącznie adresy fikcyjne | P1 | w kasie lista filtrowana po mieście (S17); kod pocztowy `00-000` |
| B-406 | Etykieta demo (`demo.label`) | P0 | zmiana widoczna w pasku demo, stopce, kasie i ekranie płatności; **pole nie może być puste** |
| B-407 | Godziny i dni wysyłki: godzina graniczna (domyślnie 14:00), dni robocze; podgląd obliczonego terminu dla wybranego czasu (strefa `Europe/Warsaw`) | P1 | podgląd dla środy 13:00 daje „Wysyłka dziś” i dostawę kurierem w czwartek (`docs/12` §2) |
| B-408 | Dane firmy fikcyjnej w stopce i GPSR: nazwa „Taktyl (podmiot fikcyjny)”, adres fikcyjny, telefon `+48 22 000 00 00`, e-maile `@taktyl.example` | P1 | walidator odrzuca NIP/REGON/KRS/BDO i adresy poza domeną |
| B-409 | Włączniki funkcji sklepu P1/P2 (np. porównywarka, konto demo) | P2 | wyłączona funkcja znika z nawigacji i adresy zwracają 404 |

### 10.1. Ekran `/ustawienia`

- **Układ:** H1 „Ustawienia sklepu”, zakładki: **Dostawa**, **Płatności**, **Rabaty i kody**, **Punkty odbioru**, **Wysyłka**, **Firma i etykiety**. Każda zakładka to osobny formularz z własnym przyciskiem „Zapisz”.
- **Walidacje i komunikaty:** kwoty jak w §7.2; procent rabatu: „Wpisz liczbę od 0 do 50.”; kod: „Kod ma 4–20 znaków: wielkie litery i cyfry.”; kod pocztowy: „Wpisz kod pocztowy w formacie 00-000.”; metoda dostawy bez nazwy: „Wpisz nazwę metody dostawy.”; nazwa metody z nazwą handlową przewoźnika: „W demonstracji używamy opisowych nazw, np. „Kurier”.”.
- **Stany:** ładowanie — szkielet; zapis — przycisk z wskaźnikiem; błąd — komunikat w treści; tryb odczytu (`editor`, `viewer`) — pola nieaktywne z objaśnieniem „Tylko właściciel zmienia ustawienia sklepu.”.
- **Klawiatura:** zakładki natywne; edycja list (metody, kody, punkty) przez przyciski „Dodaj”, „Edytuj”, „Usuń” w tabeli, usuwanie z „Cofnij” w komunikacie (5 s), bez `confirm()`.
- **Znaczniki po zapisie:** `shop-settings`; zmiana rabatu setu lub progu dodatkowo `catalog` i `presets`; zmiana etykiety demo odświeża wszystkie strony (`shop-settings` obejmuje layout).

---

## 11. B-500 – B-599 · Media

Backpanel **nie tworzy grafiki**. Pokazuje manifest `assets/manifest.json` jako listę zadań dla człowieka i przyjmuje pliki, które człowiek przygotował (`docs/09`).

| ID | Funkcja | P | Kryterium odbioru |
|---|---|---|---|
| B-500 | Lista wpisów manifestu (300 obrazów): klucz, produkt, kolor, rodzaj (`packshot` / `topdown` / `texture`), wymiary wymagane, priorytet P0/P1, status `gotowe` / `brak` | P1 | po seedzie: 190 wpisów, 76 w P0, wszystkie `brak`; filtry po rodzaju, priorytecie, statusie |
| B-501 | Pasek postępu P0 jako liczba: „Gotowe 12 z 76” (tekst, bez wykresu) | P1 | liczba zgodna z manifestem |
| B-502 | Wgrywanie pliku do wpisu (WebP, `@1x` i `@2x`, dla `packshot` rozmiary 400/800/1600) z kontrolą nazwy i typu | P1 | zły typ pliku: „Wgraj plik WebP.”; zła nazwa: pokazuje oczekiwaną |
| B-503 | Kontrola wymiarów `topdown`: wymiary pliku muszą być równe `pixels` z manifestu co do piksela (1 px = 1 mm dla `@1x`, 2 px = 1 mm dla `@2x`) | P1 | plik 330 × 140 dla 327 × 140: „Plik ma 330 × 140 px. Ten wpis wymaga 327 × 140 px (1 px = 1 mm).” i odrzucenie |
| B-504 | Kontrola tekstury: 200 × 200 (`@1x`) i 400 × 400 (`@2x`), kafel bezszwowy (tylko wymiary, bez analizy obrazu) | P1 | komunikat o wymiarach jak w B-503 |
| B-505 | Kontrola kanału alfa dla `packshot` i `topdown` (tło przezroczyste) | P2 | plik bez alfy: ostrzeżenie „Plik nie ma przezroczystego tła.” (nie blokada) |
| B-506 | Po udanym wgraniu API ustawia `status = gotowe`; usunięcie pliku przywraca `brak` | P1 | sklep zamienia placeholder na zdjęcie bez zmian układu (ten sam `width`/`height`/`srcset`) |
| B-507 | Wgrywanie obrazów spoza manifestu: favicon, `og.jpg` 1200 × 630, obrazy poradników 1200 × 675 | P2 | kontrola wymiarów jak wyżej |
| B-508 | Podgląd miniatury wgranego pliku (tylko plik człowieka) | P1 | miniatura ma `alt=""`, opis niesie wiersz tabeli |

### 11.1. Ekran `/media`

- **Układ:** H1 „Zdjęcia”, liczba „Gotowe X z Y (P0)”, filtry w żetonach, tabela wpisów manifestu. Wiersz ma przycisk „Wgraj plik” (przycisk poboczny) i status tekstem.
- **Stany:** pusty — „Manifest jest pusty. Uruchom seed.”; ładowanie — szkielet; błąd wgrywania — komunikat z konkretnym powodem (wymiary, typ, rozmiar pliku > 2 MB).
- **Klawiatura:** wybór pliku natywnym polem; drag-and-drop jest tylko dodatkiem, nigdy jedyną drogą.
- **Znaczniki po zapisie:** `product:{slug}` produktu, którego dotyczy wpis, `catalog`; dla obrazów poradnika `content:{slug}`; dla favicon/og `shop-settings`.

---

## 12. B-600 – B-699 · Pulpit

Pulpit pokazuje **wyłącznie liczby i listy z danych**. Żadnych wykresów, żadnych wymyślonych wskaźników.

| ID | Funkcja | P | Kryterium odbioru |
|---|---|---|---|
| B-600 | Liczba zamówień: dziś, w ostatnich 7 dniach, wszystkie; liczba zamówień wg statusu | P0 | po wykonaniu S19 liczba rośnie o 1 |
| B-601 | Wartość zamówień opłaconych w ostatnich 7 dniach (kwota przez `Intl`) | P1 | suma zgodna z listą zamówień o statusie ≥ `oplacone` |
| B-602 | Produkty z niskim stanem: lista wariantów ze stanem 0–3 (nazwa, SKU, stan) | P0 | po seedzie: `K-BZL75-KOB-SZP` i `P-LOD-L-MGL` (stan 0), `K-KRD98-GRF-TRZ` (3), `M-JRZ-MGL` (2) |
| B-603 | Ostatnie zmiany z dziennika (10 wpisów: kto, co, kiedy) z odnośnikiem „Cały dziennik” | P1 | wpis pojawia się po zmianie ceny |
| B-604 | Zamówienia wymagające reakcji: w statusie `oplacone` dłużej niż 24 h | P1 | lista z odnośnikami do szczegółów |
| B-605 | Postęp zdjęć P0 jako liczba (z B-501) | P1 | „Gotowe 0 z 76” po świeżym seedzie |
| B-606 | Stan połączenia: ostatnia udana rewalidacja sklepu i liczba zdarzeń w kolejce `outbox` | P1 | po awarii sklepu liczba w kolejce > 0, po odzyskaniu → 0 |
| B-607 | Skróty do najczęstszych zadań (Produkty, Zamówienia, Ustawienia) jako odnośniki tekstowe | P0 | działają z klawiatury |

### 12.1. Ekran `/`

- **Układ:** H1 „Pulpit”; sekcje jako lista bloków: Zamówienia (liczby), Niski stan, Ostatnie zmiany, Zdjęcia, Połączenie ze sklepem. Każdy blok ma własny `<h2>`; bloki 2-kolumnowe na komputerze, jedna kolumna na telefonie.
- **Stany:** pusty blok — „Brak danych do pokazania.” (np. brak zamówień: „Nie ma jeszcze zamówień.”); ładowanie — szkielet na blok, bloki ładują się niezależnie; błąd bloku — „Nie udało się pobrać tego bloku.” + „Spróbuj ponownie”, pozostałe bloki działają.
- **Klawiatura:** nawigacja po nagłówkach, odnośniki w listach; brak elementów tylko-na-najechanie.
- **Znaczniki:** brak (odczyt).

---

## 13. Wymagania przekrojowe

| Temat | Wymaganie |
|---|---|
| Dostępność | WCAG 2.1 AA: etykiety nad polami, błędy z `aria-describedby`, fokus na pierwszy błąd, cele min. 44 × 44 px, tabele z nagłówkami, `lang="pl"`; kolor nie jest jedynym nośnikiem informacji (status ma tekst) |
| Wydajność | strony backpanelu są aplikacją (budżet „aplikacja” z `docs/12` §4: JS ≤ 400 KB po kompresji, 0 obcych domen) |
| Bezpieczeństwo | każdy wiersz API sprawdza rolę; sekrety wyłącznie w `.env`; `X-Robots-Tag: noindex, nofollow` i `meta robots` na całym backpanelu; ciasteczka `Secure` za proxy |
| Zapis i konflikty | każda encja ma `updated_at`/wersję; zapis z nieaktualną wersją → 409 z komunikatem z §7.2 |
| Dziennik | każda mutacja → wpis w `audit_log` w tej samej transakcji (B-011) |
| Rewalidacja | każdy zapis deklaruje znaczniki; brak deklaracji w nowej mutacji to błąd przeglądu (skill `taktyl-admin-sklep-sync`) |
| Brak `confirm()` / `alert()` | potwierdzenia i „Cofnij” w treści i toastach (`docs/11` pułapka 11) |
| Czas i liczby | `Europe/Warsaw`, `Intl.NumberFormat('pl-PL')`, `Intl.PluralRules('pl')`, grosze jako liczby całkowite |
| Ruch | tylko A-01 (wciśnięcie przycisku), A-12 (okna), A-15 (toast), A-18 (szkielet); wszystko wyłączone przy `prefers-reduced-motion: reduce` |

## 14. Kryteria odbioru backpanelu (do dopisania w `docs/12`)

| # | Kroki | Oczekiwany wynik |
|---|---|---|
| B-S1 | Zaloguj jako `owner`, wejdź w `/produkty`, wyszukaj „lupek” | „1 produkt”: Łupek 65 |
| B-S2 | Zmień cenę Wróbla na 119,00 zł | w historii cen nowy wiersz; w panelu −14% (`floor((139−119)/139·100)` = 14) i „Najniższa cena z 30 dni przed obniżką: 139,00 zł”; `/myszki/wrobel` pokazuje 119,00 zł w ≤ 5 s (S25) |
| B-S3 | Ustaw stan `M-JRZ-MGL` na 0 | w sklepie wariant „Brak w tym kolorze”; na pulpicie nadal w „Niski stan” |
| B-S4 | Zmień próg darmowej dostawy | komunikat w koszyku w sklepie zmienia kwotę (S16) |
| B-S5 | Wejdź jako `viewer`, spróbuj zapisać cenę (UI i bezpośrednie żądanie do API) | UI: kontrolki nieaktywne z objaśnieniem; API: 403 |
| B-S6 | Złóż zamówienie w sklepie (S19), otwórz je w backpanelu | numer `TK-RRMMDD-XXXX`, kwoty zgodne z koszykiem; `viewer` widzi dane zamaskowane |
| B-S7 | Wgraj do wpisu `topdown` plik o złych wymiarach | odrzucenie z komunikatem o wymiarach (B-503) |
| B-S8 | Zapisz opis z słowem „idealny” | zapis przechodzi z ostrzeżeniem i listą słów (Q-07); opis z obietnicą medyczną lub marką: 422, zapis zablokowany |
