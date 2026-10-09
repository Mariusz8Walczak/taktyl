# ADR-0011 · Konfigurator kolorów z modelami 3D

- **Status:** przyjęty 2026-10-09 (F-110..F-119 do nadania w `docs/02`). Faza 1 (dane, kontrakty, reguły i SKU w `packages/domain`) wykonana 2026-10-09.
- **Wejście od właściciela:** paczka `taktyl-rendery/out/konfigurator` (26 modeli GLB, 27 nadruków podkładek, `kolory.json`, `modele.json`) oraz kolekcja kolorów `out/kolekcja`.

## Kontekst

Dziś wariant to para kolor + przełącznik z 4 kolorów (`data/colors.json`). Właściciel dostarczył modele GLB każdej klawiatury, myszki i podkładki (z osobnymi częściami do malowania), paletę 49 kolorów z wykończeniami oraz 110 gotowych wariantów kolorystycznych ("kolekcja Kolory").

## Decyzje

1. **Dwa poziomy wyboru.** (A) Gotowe warianty kolorystyczne: kolekcja wchodzi jako kolejne kolory istniejących produktów (np. Kwarc 60 w kolorze Turkus), z własnymi SKU, stanem i zdjęciami, zgodnie z `docs/04`. (B) Konfigurator części na karcie produktu: widok 3D, użytkownik maluje obudowę, klawisze, nadruki, korpus myszki itd.
2. **Reguła 4 (dane tylko z `data/*.json`) pozostaje.** Paleta 49 kolorów, wykończenia i palety części trafiają do `data/colors.json` i nowych plików `data/finishes.json`, `data/parts.json` jako dane od właściciela. Model nie wymyśla kolorów, cen ani dopłat.
3. **Łączenie (potwierdzone):** dowolne w obrębie palet części. Ograniczenia tylko techniczne: anodowanie wyłącznie w modelach aluminiowych; obudowy i klawisze półprzezroczyste wyłącznie w modelach z podświetleniem; pokrętło tylko w Bazalcie 75; nadruk na klawiszu o kontraście do klawisza poniżej 3:1 zmieniany automatycznie na biel lub czerń. Zestawień estetycznych nie blokujemy. Reguły liczy **serwer** (`packages/domain`), widok 3D tylko je stosuje.
4. **Ceny:** dopłata za wykończenie, nie za kolor; kolory z serii (grafit, mgła, kobalt) bez dopłaty. Tabela `doplaty` z paczki jest źródłem (seed). Cenę konfiguracji liczy API w groszach (reguła 7), cena w widoku jest tylko podglądem.
5. **Magazyn (potwierdzone):** gotowe warianty mają stan per SKU jak dziś. Konfiguracje własne są na zamówienie, bez stanu, z terminem wysyłki z ustawień sklepu (domyślnie 7 dni roboczych, do potwierdzenia w `docs/05`).
6. **SKU konfiguracji (potwierdzone):** `<SKU modelu bazowego>-CFG-<kody części oddzielone kropką>`, kod części = kod koloru (3 litery) + kod wykończenia (1 litera), kolejność części z `modele.json`. Przykład: `K-KWR60-CFG-TRKP.KRMB.TRKB.KORB.AUTO`. Kod jest deterministyczny, więc API odtwarza konfigurację ze SKU i weryfikuje ją przy wycenie (klient nie wysyła ceny).
7. **Widok 3D to wyspa kliencka ładowana na żądanie** (three.js, dynamic import po kliknięciu "Dostosuj kolory"; dekoder Draco hostowany u nas, bez CDN). Nie wchodzi do budżetu JS strony (S36), a bez WebGL, przy `prefers-reduced-motion` lub błędzie ładowania zostaje wybór z listy kolorów ze zdjęciem wariantu. Wszystko działa z klawiatury, a kolor i wykończenie są ogłaszane tekstowo (WCAG), nie tylko kolorem.
8. **Zdjęcia.** Reguła 1 bez zmian: nie tworzymy grafiki. Modele i nadruki są od właściciela, a kadry produktowe gotowych wariantów to rendery od właściciela.

9. **Sety zostają, dochodzi „Stwórz własny set” (decyzja właściciela 2026-10-09).** Gotowe sety i kreator „Zbuduj set” (−10% za komplet) działają bez zmian. Obok nich powstaje ścieżka, w której klient komponuje cały zestaw (klawiatura + mysz + podkładka) wizualnie dowolnie: na jednej scenie 3D wybiera modele i kolory każdej części, a rabat setu liczy się jak dziś (reguła z `shop.json`, nie z widoku). Tekst marketingowy ścieżki pisze agent treści z atrybutów (reguła 4), a hasła i opisy trafiają do `docs/` i `data/` jako treści, nie do kodu.

## Reguły przyjęte w fazie 1 (do wglądu właściciela)

- **Bez dopłaty jest kolor z serii (grafit, mgła, kobalt) oraz domyślny kolor części w danym modelu** (np. antracyt anodowany w Bazalcie 75); inny kolor anodowany +40 zł.
- **Części zależne podążają za nadrzędnymi**, jeśli klient ich nie ruszył: spód obudowy i pokrętło za obudową, przyciski i przyciski boczne myszki za korpusem. Dwukolorowa obudowa (+20 zł) to dopiero świadomy wybór innego spodu.
- **SKU liczymy po rozwiązaniu konfiguracji:** nadruki „auto” stają się konkretnym kolorem (biel lub czerń), więc dwie konfiguracje o tym samym wyglądzie mają to samo SKU. Token `AUTO` z propozycji paczki nie występuje.
- **Rozbieżność do wyjaśnienia (faza 2):** ceny 110 wariantów kolekcji nie zawsze zgadzają się z tabelą dopłat. Zgadzają się dla klawiatur i myszek w macie, połysku i opalu, ale podkładki z nadrukiem w kolekcji kosztują +40…+110 zł, a tabela przewiduje +10 zł za nadruk i +30 zł pod szkłem. Warianty kolekcji mają w sklepie ceny z kolekcji, a konfiguracja własna liczy się z tabeli, więc ta sama podkładka może mieć dwie ceny.

## Fazy (osobne PR)

1. Dane i kontrakty: assety do `apps/web/public/3d`, `data/` + seed, schemat Zod konfiguracji, reguły i wycena w `packages/domain`, testy.
2. Gotowe warianty kolorystyczne (A): kolekcja jako warianty, picker kolorów na karcie i w listingu, zdjęcia.
3. Widok 3D i konfigurator części (B): wyspa kliencka, panel wyboru, podgląd ceny i SKU; następnie „Stwórz własny set” (pkt 9) na wspólnej scenie.
4. Koszyk, zamówienie, backpanel: pozycja z konfiguracją, wycena serwerowa, widok w panelu, MCP.

## Konsekwencje

- Kolejność wprowadzania jest bezpieczna dla sklepu: faza 2 działa bez 3D.
- Rozmiar assetów: ok. 5,3 MB (modele 2,3 MB, nadruki 3 MB) w repo; katalogi `raw` i `raw_tex` z paczki (34 MB) nie wchodzą do repo.
- Nowe pojęcie "konfiguracja własna" wymaga rozszerzenia modelu zamówienia (ADR-0007) w fazie 4.
