## ID funkcji

<!-- F-xxx, A-xx, B-xxx, I-xxx; klucz zadania z task-managera, jeśli jest -->

## Co i dlaczego

<!-- Krótki opis zmiany i powód. -->

## Kryteria odbioru (`docs/12`)

- [ ] Scenariusze: <!-- np. S9, S10 -->
- [ ] Testy jednostkowe / e2e dodane lub zaktualizowane

## Definicja ukończenia (`CLAUDE.md`)

- [ ] Działa z klawiatury i na szerokości 360 px
- [ ] Nie dodano wartości spoza tokenów (zero `#rrggbb` i `rgb(` poza plikiem tokenów)
- [ ] Nie zostawiono treści z dema szablonu
- [ ] Brak własnej grafiki (ikony z zestawu szablonu, zdjęcia z manifestu)
- [ ] Brak prawdziwych marek, adresów, NIP-ów, telefonów
- [ ] Zdarzenia pomiaru wyłącznie z `docs/10`
- [ ] Działa w Dockerze (`docker compose`)

## Bezpieczeństwo i publikacja

- [ ] Brak sekretów, `.env`, kluczy i haseł w diffie
- [ ] Brak plików szablonu Crafto (`html/`, `vendor/`) i paczek `.zip`
- [ ] Commity mają ID funkcji i adres `noreply`
- [ ] Decyzje nietrywialne zapisane w `docs/decyzje.md`
