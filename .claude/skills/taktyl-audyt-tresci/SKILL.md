---
name: taktyl-audyt-tresci
description: Audyt treści Taktyla - zakazane słowa, prawdziwe marki, logotypy płatności i przewoźników, resztki dema szablonu, lorem ipsum, angielskie etykiety, ceny w USD, adresy spoza taktyl.example (docs/12 §5, docs/11). Użyj przed REVIEW zadań z treścią lub widokami oraz przed publikacją.
---

# taktyl-audyt-tresci

Reguły 1, 4, 5, 10 z `CLAUDE.md`; `docs/11` §1-2; `docs/12` §5. Skanuj kod (`apps/`, `packages/`), dane (`data/`), treści i dokumenty (`docs/`) oraz - po zbudowaniu - wyrenderowane strony ze stosu `compose`.

## Skan
```
# zakazane słowa w opisach i copy
rg -n -i '\b(najlepsz\w*|rewolucyjn\w*|profesjonaln\w*|premium|idealn\w*|niesamowit\w*)\b|ultra-' apps packages data docs --glob '!docs/11-*' --glob '!docs/04-*' --glob '!**/node_modules/**'
# resztki dema szablonu i lorem ipsum
rg -n -i 'lorem ipsum|crafto|ecomus|themezaa|themesflat|demo-(fashion|decor)|add to cart|quick view|buy now|\$\s?[0-9]' apps packages data
# angielskie etykiety interfejsu
rg -n -i '\b(sign in|log in|checkout|wishlist|subscribe|read more|shop now|my account|search\.\.\.)\b' apps packages --glob '*.{tsx,ts}'
# prawdziwi przewoźnicy, operatorzy płatności, marki peryferiów, producenci przełączników i sensorów:
# lista nazw jest LOKALNA (plik .claude/marki-zakazane.local.txt, jedna nazwa w linii, w .gitignore),
# bo samo wypisanie cudzych marek w publicznym repo łamie regułę 5. Człowiek tworzy ten plik u siebie.
rg -n -i -f .claude/marki-zakazane.local.txt apps packages data docs
# adresy e-mail inne niż taktyl.example
rg -n -I '[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[a-z]{2,}' apps packages data docs | rg -v 'taktyl\.example'
# logotypy i obrazy płatności/przewoźników, SVG
git ls-files | rg -i 'logo|payment|carrier|\.svg$'
```
Gdy pliku z markami brak, skan marek pomiń i zaznacz to w raporcie; kontrolę ręczną (niżej) wykonaj zawsze. Uwaga: w `docs/` niektóre trafienia są dozwolone, bo opisują zakaz (np. `docs/11`); w kodzie i danych - nie. Wzorców jest więcej niż marek wpisanych wyżej: każdy nowy tekst oceniaj też ręcznie.

## Kontrola ręczna
- [ ] Tytuły stron (`<title>`), meta i stopka bez nazwy szablonu; `lang="pl"`; waluta PLN; teksty po polsku.
- [ ] Sklep ma pasek demo, etykietę demo w stopce, kasie i symulacji płatności (reguła 10); `noindex` w meta i nagłówku.
- [ ] Opisy produktów wyprowadzone z atrybutów, bez nowych parametrów; brak "ostatnich sztuk" i zniżek spoza danych.
- [ ] Opinie tylko na kartach produktów, z etykietą "Opinie przykładowe - sklep demonstracyjny"; brak `aggregateRating`/`review` w JSON-LD.
- [ ] Strona główna bez opinii, liczników klientów, logotypów "zaufali nam".
- [ ] Strony prawne: "Wzór treści dla sklepu demonstracyjnego Taktyl. Nie stanowi oferty.", brak NIP/REGON/KRS/BDO, brak linku do platformy ODR.
- [ ] Zdjęcia tylko z manifestu; brak = placeholder; brak obrazów z dema szablonu.

## Po zbudowaniu (na stosie compose)
Pobierz HTML stron P0 i przeszukaj go tymi samymi wzorcami (Playwright `page.content()` lub `curl` na `http://taktyl.localhost`). Skrypt `docs/12` §4 (obce domeny, obrazy bez wymiarów/`srcset`/`alt`, dokładnie jeden `h1`) uzupełnia kontrolę.

## Raport
Plik:linia | kategoria | co zmienić. Zero trafień w kodzie i danych = PRZEPUŚĆ.
