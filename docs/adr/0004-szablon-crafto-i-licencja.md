# ADR-0004 · Szablon: Crafto (wariant z `docs/08` §6) i licencja w publicznym repo

- **Status:** przyjęta; punkt „ryzyko licencyjne” wymaga potwierdzenia właściciela (patrz `docs/decyzje.md`, pytanie Q-01)

## Kontekst

`docs/08` rekomenduje Ecomus, ale w katalogu `html/` jest paczka **Crafto** (631 plików). Właściciel poleca użyć Crafto i dobrać komponenty „z dokumentacji”, czyli z tabeli wariantu awaryjnego `docs/08` §6.

## Decyzja

1. Źródłem komponentów jest Crafto, wg mapowania `docs/08` §6: listing `demo-fashion-store-shop`, kolekcje `demo-decor-store-collections`, karta produktu `demo-fashion-store-single-product`, koszyk `demo-decor-store-cart`, kasa `demo-decor-store-checkout`, konto `demo-decor-store-account`, ulubione `demo-fashion-store-wishlist`, FAQ `demo-decor-store-faq`.
2. Czego Crafto nie ma, budujemy z komponentów Bootstrapa 5 i tokenów (lista w `docs/08` §6): suwak ceny, żetony filtrów, „pokaż więcej”, „Dokończ set”, przyklejony pasek zakupu, kafle przełączników, grupy setów, zakładka „Moje sety”, porównywarka, statusy płatności.
3. Usuwamy z Crafto: Slider Revolution, GSAP i ScrollTrigger, Atropos, Anime, ekrany ładowania (`docs/08` §6, `docs/07` §4).
4. Wygląd definiują wyłącznie tokeny (`docs/06`), ruch wyłącznie katalog A-xx (`docs/07`).

## Licencja i publiczne repo — twarda zasada

Licencja szablonu (Regular) **nie pozwala na publikowanie jego plików źródłowych**. Repo jest publiczne, więc:

- Katalog `html/` i każdy plik pochodzący z paczki Crafto leżą w `vendor/crafto/` i są w `.gitignore`. **Nigdy nie trafiają do commitów.**
- Do repo trafia **wyłącznie nasz kod**: komponenty React napisane przez nas na siatce Bootstrapa 5 (MIT) i naszych tokenach. Crafto służy jako **wzorzec układu przy budowie**, nie jako źródło kopiowanych plików.
- Nie kopiujemy markupu ani CSS Crafto do plików śledzonych przez git. Jeśli komponent wymaga stylów Crafto, ładuje je build z `vendor/crafto/` (lokalnie, u właściciela licencji); bez tego katalogu repo buduje się na samych tokenach i Bootstrapie, a komponenty wyglądają poprawnie, choć prościej.
- Hook `pre-push` i job CI sprawdzają, że żaden ścieżka z listy zakazanej (`html/`, `vendor/`, `*.zip`, `.env*`) nie jest śledzona (skill `taktyl-straznik-repo`).
- README zawiera wprost: „Szablon Crafto nie jest częścią repozytorium. Wymaga osobnej licencji.”

## Konsekwencje

- Publiczna wersja jest w pełni uruchamialna bez Crafto (demo „na tokenach”). Wersja z Crafto to lokalny, prywatny overlay.
- Komentarz źródłowy w komponencie (`<!-- źródło: … -->` z `docs/08` §5) zapisujemy jako komentarz JSX z **nazwą pliku wzorca**, bez wklejania jego treści.
