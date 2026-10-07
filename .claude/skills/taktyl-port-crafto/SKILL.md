---
name: taktyl-port-crafto
description: Jak zbudować komponent React Taktyla według wzorca układu Crafto (katalog html/, mapowanie docs/08 §6) bez kopiowania plików szablonu do publicznego repo, ostylowany tokenami. Użyj, gdy budujesz stronę lub komponent sklepu mający odpowiednik w szablonie.
---

# taktyl-port-crafto

Reguła 3 z `CLAUDE.md` (komponenty z szablonu) w zgodzie z ADR-0004 (licencja, publiczne repo). Szablon jest **wzorcem układu**, nie źródłem plików.

## Mapowanie (docs/08 §6)
| Nasza strona | Wzorzec Crafto (plik w `html/`) | Budujesz od zera (Bootstrap 5 + tokeny) |
|---|---|---|
| Listing | `demo-fashion-store-shop.html` | suwak ceny, żetony aktywnych filtrów, "pokaż więcej" |
| Kategorie, gotowe sety | `demo-decor-store-collections.html` | - |
| Karta produktu | `demo-fashion-store-single-product.html` | "Dokończ set", przyklejony pasek zakupu, kafle przełączników |
| Koszyk | `demo-decor-store-cart.html` | grupy setów |
| Kasa | `demo-decor-store-checkout.html` | - |
| Konto | `demo-decor-store-account.html` | zamówienia, szczegóły, zapisane sety |
| Ulubione | `demo-fashion-store-wishlist.html` | - |
| FAQ | `demo-decor-store-faq.html` | - |
| Porównywarka, statusy płatności, kreator, DeskStage | - | całe strony i komponenty |

Usuwasz z wzorca: Slider Revolution, GSAP, ScrollTrigger, Atropos, Anime, ekrany ładowania, przełączniki wersji, treści demo.

## Procedura
1. Otwórz plik wzorca (lokalnie, `vendor/crafto/` lub `html/`) **tylko do odczytu**; zanotuj strukturę sekcji, siatkę kolumn i listę potrzebnych stanów.
2. Napisz **własny** komponent TSX na siatce Bootstrapa 5 (12 kolumn, `--s3` odstęp) z klasami własnymi (`taktyl-...`) i tokenami; nie wklejaj markupu, klas ani CSS z szablonu. Nie przepisuj linijka po linijce.
3. W komentarzu JSX zapisz **tylko nazwę wzorca** i ID: `{/* wzorzec: demo-fashion-store-shop · F-020, F-021 */}`. Bez fragmentów treści pliku.
4. Wygląd tylko z `var(--...)`. Stany: spoczynek, najechanie, fokus, wciśnięcie, nieaktywny, ładowanie, błąd. Ruch tylko A-xx.
5. Ikony: tylko font ikon szablonu, ładowany lokalnie z `vendor/` na maszynie właściciela; brak ikony = sam tekst + wpis w `docs/decyzje.md` ("brak ikony: ..."). W publicznej wersji bez fontu szablonu komponent ma działać z samym tekstem.
6. Zdjęcia: tylko manifest; brak = placeholder z `docs/09`. Nie bierzesz obrazów z dema.
7. Wszystkie teksty po polsku, dane z API; zero treści dema (`taktyl-audyt-tresci`).
8. Wynik ma działać **bez** `vendor/crafto/` (publiczne repo buduje się na tokenach i Bootstrapie); z katalogiem lokalnie można dołożyć style przez overlay `docker-compose.crafto.yml` (w `.gitignore`).

## Kontrola przed commitem
```
git ls-files | rg '^(html|vendor)/'                 # ma być puste
rg -n -i 'crafto|themezaa|data-wow|\.wow\b|swiper|gsap|atropos' apps packages   # ma być puste poza komentarzem z nazwą wzorca
```
Następnie `taktyl-audyt-tokenow` i `taktyl-straznik-repo`.
