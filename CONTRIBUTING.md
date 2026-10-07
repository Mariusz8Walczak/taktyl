# Współpraca

Dziękujemy za zainteresowanie. Taktyl to sklep demonstracyjny, który ma być wzorem dyscypliny projektowej, więc zasady są ścisłe.

## Zanim zaczniesz

Przeczytaj `README.md`, `CLAUDE.md` (reguły 1–11 i aneks), potem `docs/01`–`docs/12` i `docs/adr/`. Brak odpowiedzi w dokumentach oznacza pytanie w `docs/decyzje.md`, nie zgadywanie.

## Zasady

1. **Tokeny.** Kolor, odstęp, promień, cień, rozmiar czcionki, czas i krzywa animacji tylko ze zmiennych (`docs/06`). Zero `#rrggbb` i `rgb(` poza plikiem tokenów (wyjątek: `data/colors.json → swatch`).
2. **Brak własnej grafiki.** Żadnych ilustracji, SVG, rysunków w CSS lub canvas, generowanych ikon i logo. Ikony z zestawu szablonu, zdjęcia z `assets/manifest.json`, w ich braku placeholdery (`docs/09`).
3. **Brak prawdziwych bytów.** Bez prawdziwych marek, logotypów, adresów, NIP-ów, telefonów. E-maile tylko `@taktyl.example`.
4. **Dane.** `data/*.json` to seed; nie dopisuj produktów, wariantów, cen, stanów, parametrów ani marek (ADR-0005).
5. **Ruch** tylko z katalogu `docs/07`; animuj `transform` i `opacity`; wyłączony przy `prefers-reduced-motion: reduce`.
6. **Polszczyzna przez API:** `Intl.NumberFormat`, `Intl.PluralRules('pl')`, strefa `Europe/Warsaw`, kwoty w groszach.
7. **Pomiar** tylko zdarzenia z `docs/10`, nazwy i parametry bez zmian.
8. **Szablon.** Nigdy nie commituj plików Crafto (`html/`, `vendor/`). Nie wklejaj jego markupu ani CSS do plików śledzonych (ADR-0004).
9. **Sekrety.** Nigdy nie commituj `.env`, kluczy ani haseł. Używaj `.env.example`.
10. **Docker-first.** Wszystko ma działać w `docker compose` (ADR-0009); nie zakładaj lokalnego Node ani Postgresa.

## ID funkcji

Każda zmiana odnosi się do ID: `F-xxx` (`docs/02`), `A-xx` (`docs/07`), `B-xxx` (backpanel i API, `docs/15`), `I-xxx` (infrastruktura, Docker, CI). ID podajesz w commicie i w komentarzu nad kodem.

Format commita: `typ(zakres): opis [ID]`, np. `feat(web): dodaj filtr ceny [F-021]`. Szczegóły: `docs/19` §6.

## Definicja ukończenia

Zmiana jest skończona, gdy:

- spełnia odpowiednie punkty `docs/12-kryteria-odbioru.md`,
- działa z klawiatury i na szerokości 360 px,
- nie dodała wartości spoza tokenów,
- nie zostawiła treści z dema szablonu,
- ma testy (jednostkowe dla `domain`, e2e dla scenariuszy) i przechodzi CI,
- nie zawiera sekretów ani plików szablonu.

## Proces

1. Zadanie ma ID, kryteria odbioru i priorytet (szablon w `.github/ISSUE_TEMPLATE/`).
2. Gałąź z `main`, mały zakres, jeden temat.
3. Pull request z wypełnionym szablonem; wymagane zielone CI i akceptacja.
4. Scalenie squashem.

## Zgłaszanie błędów i bezpieczeństwa

Błędy: issue z szablonu `blad`. Podatności: wyłącznie prywatnie, zgodnie z `SECURITY.md`.

## Hook pre-commit (kontrola sciezek i sekretow)

Repozytorium ma hook w `.githooks/pre-commit`: kontrola sciezek zakazanych (`html/`, `vendor/`, `*.zip`, `.env*`, zrzuty bazy, prywatny adres e-mail) oraz gitleaks na zmianach w indeksie (jesli jest zainstalowany). Wlacz go raz po sklonowaniu:

```
git config core.hooksPath .githooks
```

Te same kontrole uruchamia CI (`kontrola-sciezek`, `gitleaks`), wiec hook jest tylko szybkim ostrzezeniem przed pushem. Reczne uruchomienie: `sh scripts/check-forbidden-paths.sh` (test negatywny: `--self-test`).
