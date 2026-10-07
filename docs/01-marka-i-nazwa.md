# 01 · Marka i nazwa

## 1. Nazwa: Taktyl

**Taktyl** — od „taktylny”: odczuwany dotykiem. Pasuje do wszystkich trzech kategorii naraz: przełącznik klawiatury (taktylny to jeden z trzech typów), klik myszy, faktura podkładki. Sześć liter, czyta się tak, jak się pisze, pierwsza sylaba to „tak”.

Zapis: w tekście **Taktyl**, w logotypie małymi literami `taktyl` (wordmark złożony fontem, nie grafika — `docs/06`).

### 1.1. Weryfikacja (stan na 7 października 2026)

| Sprawdzenie | Wynik |
|---|---|
| Domena `taktyl.pl` (rejestr NASK, RDAP) | **wolna** |
| Domena `taktyl.com` (Verisign, RDAP) | zarejestrowana w 2024, wygasła 14.08.2026, status „redemption period” — dziś niedostępna do kupienia, może zwolnić się w ciągu kilku tygodni |
| TMview, znaki zawierające „taktyl” | 4 wyniki, żaden w klasach 9 (sprzęt komputerowy) ani 35 (sprzedaż): TAKTYLE (Wielka Brytania, kl. 19, oznakowanie), TAKTYLE (Irlandia, wygasły), dwa polskie znaki z członem „NeuroTaktylna” (kl. 28, 41, 44 — terapia) |
| TMview, znaki zawierające „tactyl” | aktywne tylko: TacTyle (EUIPO 019057425, kl. 20 i 35, producent wyrobów z drewna) oraz TACTYLON (kl. 1, 9, 10, materiał na rękawice medyczne). Pozostałe TACTYL wygasłe. Inne towary, inne brzmienie — ryzyko pomyłki niskie |
| Wyszukiwarka, „Taktyl” jako marka lub sklep | brak trafień |
| CEIDG / KRS, konta w mediach społecznościowych | **nie sprawdzane** — do zrobienia przed ewentualnym realnym użyciem |

Sklep jest fikcyjny i stoi na subdomenie, więc domena nie jest potrzebna do startu.

### 1.2. Odrzucone kandydatury

| Nazwa | Dlaczego odpada |
|---|---|
| Stukot | `stukot.pl` od 2011 należy do działającej firmy o tej nazwie |
| Klekot | `klekot.pl` od 2000 należy do działającego podmiotu (Fabryka Koncertowa Klekot) |
| Klawo | `klawo.pl` od 2006 należy do spółki |
| Spacja | `spacja.pl` zarejestrowana od 2008 |
| Klak | `klak.pl` zarejestrowana we wrześniu 2026 |

### 1.3. Zapasowe

Gdyby Taktyl odpadł na etapie CEIDG/KRS: **Klawiszarnia** i **Klikoteka** — obie z wolną domeną `.pl` i bez wyników w TMview. Słabsze: opisowe, dłuższe, trudniejsze do ochrony.

## 2. Czym jest Taktyl

Sklep z klawiaturami, myszkami i podkładkami, w którym kupuje się **set dopasowany do biurka i dłoni**. Wszystkie produkty są marki Taktyl (jedna marka własna, fikcyjna) — to upraszcza dane i usuwa ryzyko użycia cudzych marek.

### 2.1. PWE (Problem → Wartość → Efekt)

| | Treść |
|---|---|
| **Problem** | Klawiaturę, myszkę i podkładkę kupuje się osobno, często w trzech sklepach. Dopiero na biurku wychodzi, że mata jest za wąska na klawiaturę i ruch myszki, a mysz za mała na dłoń. |
| **Wartość** | Kreator setu liczy wymiary przed zakupem: szerokość klawiatury + miejsce na ruch myszki dla Twojego stylu gry lub pracy kontra szerokość podkładki, długość dłoni kontra rozmiar myszy. Za komplet −10%. |
| **Efekt** | Jeden koszyk, jedna dostawa, set, który mieści się na biurku. A jeśli nie pasuje — 30 dni na zwrot. |

### 2.2. Pierwszy ekran

- **H1:** Złóż set, który pasuje do biurka i dłoni.
- **Podtytuł:** Wybierz klawiaturę, myszkę i podkładkę. Sprawdzimy wymiary, zanim zapłacisz, a za komplet odejmiemy 10%.
- **Przycisk główny:** Zbuduj set
- **Przycisk poboczny:** Gotowe sety
- **Pasek warunków (4 pozycje, przy przyciskach):** −10% za komplet · Darmowa dostawa od 299 zł · 30 dni na zwrot · Wysyłka w 24 h

### 2.3. Dowód bez zmyślania

Sklep jest fikcyjny, więc nie ma prawdziwych opinii, liczby klientów ani logotypów partnerów. **Dowodem jest działanie kreatora na liczbach**, pokazane wprost na stronie głównej:

> Marmur 100 ma 44 cm szerokości. Przy grze na niskim sensie mysz potrzebuje około 40 cm. Z odstępami to 91 cm — a mata XL ma 90 cm. Kreator to wyłapie i zaproponuje XXL.

Na stronie głównej nie ma sekcji opinii. Opinie demonstracyjne występują tylko na kartach produktów, z widoczną etykietą (`docs/11`).

## 3. Odbiorcy

| Profil (ID z `data/rules.json`) | Kto | Czego szuka | Typowy set |
|---|---|---|---|
| `fps` | gra w strzelanki na niskiej czułości | lekka mysz, dużo miejsca na ruch ramieniem, wąska klawiatura | 60% + mysz do 55 g + mata XL kontrolna |
| `gry` | gra w inne gatunki | wygoda, ładny set, bezprzewodowo | 65–75% + mysz średnia + szybka tkanina |
| `programowanie` | programista, praca zdalna | rząd F, taktylny przełącznik, ergonomiczna mysz | 75% lub TKL + mysz ergonomiczna + mata XL |
| `biuro` | praca biurowa, liczby | blok numeryczny, mysz na cały dzień | 1800 lub 100% + mysz ergonomiczna lub pionowa |
| `cisza` | open space, praca nocą | ciche przełączniki, ciche przyciski, tłumiąca mata | 1800 z „Szeptem” + mysz z cichymi przyciskami + filc |

## 4. Ton i słownik

- **Na ty**, zaimki w interfejsie wielką literą („Twój set”, „Twoja dłoń”). Gdzie się da — bez zaimków („Koszyk”, „Zamówienia”).
- **Liczba zamiast przymiotnika.** „49 g”, nie „ultralekka”. „Węższa od TKL o 3,3 cm”, nie „kompaktowa”.
- **Bez emoji, bez wykrzykników, bez „Kliknij tutaj”.** Odnośnik mówi, dokąd prowadzi.
- **Komunikaty błędów mówią, co poprawić**, nie przepraszają: „Wpisz kod pocztowy w formacie 00-000.”
- **Pusty stan zaprasza do działania:** „Nic tu jeszcze nie ma. Zacznij od klawiatury.”
- **Cudzysłowy polskie** „…”, półpauza z odstępami w zakresach słownych, łącznik bez odstępów w zakresach liczbowych z jednostką („60–80 g”).
- **Twarda spacja** między liczbą a jednostką („49 g”, „90 cm”, „299 zł”) i po jednoliterowych spójnikach i przyimkach w nagłówkach (w, z, i, a, o, u).
- **Kwoty tak, jak formatuje `Intl` dla `pl-PL`:** czterocyfrowe bez odstępu („1203,30 zł”), od pięciu cyfr z twardą spacją („12 999,00 zł”). Nie poprawiasz tego ręcznie.

### 4.1. Słownik działań (jedna nazwa przez cały przepływ)

| Przycisk | Komunikat po wykonaniu | Gdzie |
|---|---|---|
| Dodaj do koszyka | Dodano do koszyka | karta produktu, listing |
| Dodaj do setu | Dodano do setu | karta produktu → kreator |
| Zbuduj set | — (przejście do kreatora) | nagłówek, pierwszy ekran |
| Dodaj set do koszyka | Set dodany do koszyka | kreator, „Dokończ set” |
| Zapisz set | Set zapisany | kreator |
| Kopiuj link do setu | Link skopiowany | kreator |
| Przejdź do zamówienia | — | koszyk |
| Zamawiam i płacę | Zamówienie przyjęte | zamówienie (treść przycisku wymagana prawem) |
| Dodaj do ulubionych / Usuń z ulubionych | Dodano do ulubionych / Usunięto z ulubionych | wszędzie |
| Porównaj | Dodano do porównania (2 z 4) | listing, karta produktu |

Liczebniki zawsze przez `Intl.PluralRules('pl')`: 1 produkt, 2 produkty, 5 produktów, 22 produkty, 112 produktów.

## 5. Etykieta demonstracyjna

Tekst z `data/shop.json → demo.label`: **„Taktyl to sklep demonstracyjny. Nie realizujemy zamówień i nie pobieramy płatności.”**

Występuje: pasek nad nagłówkiem (zamykany, wraca w nowej sesji), stopka (stały), strona zamówienia nad przyciskiem „Zamawiam i płacę” (stały), ekran symulacji płatności (stały).
