# ADR-0006 · Backpanel: uwierzytelnianie, role i tryb demo

- **Status:** przyjęta jako domyślna; wymaga potwierdzenia (Q-02 w `docs/decyzje.md`)

## Problem

Reguła 10 `CLAUDE.md` i F-200 zakazują pól hasła **w sklepie**. Backpanel to osobna aplikacja i realnie wymaga logowania. Do tego repo jest publiczne i ma być pokazywane: gdyby każdy mógł edytować dane demo, demo szybko by się zepsuło.

## Decyzja

1. **Sklep (`apps/web`):** bez haseł, bez zmian (F-200 „Zaloguj jako użytkownik demo”).
2. **Backpanel (`apps/admin`):** logowanie e-mailem i hasłem, hasło hashowane (argon2id), sesja w ciasteczku `HttpOnly; Secure; SameSite=Strict`, CSRF token dla mutacji, limit prób logowania.
3. **Role:** `owner` (pełny dostęp, ustawienia), `editor` (katalog, treści, zamówienia), `viewer` (tylko odczyt — konto „demo”).
4. **Konta tworzone z konfiguracji, nie z kodu:** `ADMIN_BOOTSTRAP_EMAIL` i `ADMIN_BOOTSTRAP_PASSWORD` w `.env` przy pierwszym starcie. W repo wyłącznie `.env.example` z placeholderami; adresy tylko w domenie `taktyl.example`. **Żadnych haseł ani domyślnych poświadczeń w repozytorium.**
5. **Tryb publicznego demo** (`DEMO_MODE=true`): przycisk „Wejdź jako viewer” na ekranie logowania (rola tylko do odczytu, bez pola hasła) — każdy może obejrzeć backpanel, nikt obcy nie zmieni danych. Zapisy robi `editor` po zalogowaniu (np. właściciel na prezentacji). Przy `DEMO_MODE` działa harmonogram `db:reset-demo`.
6. Każda mutacja trafia do `audit_log` (kto, co, przed → po, kiedy). Widok dziennika w backpanelu (B-xxx).

## Konsekwencje

- Hasło występuje tylko w backpanelu, co jest zgodne z literą reguły 10 („sklep… nie ma pól na hasła”), ale to zmiana wobec zakazu „żadnych pól hasła w serwisie” z F-200 — stąd pytanie Q-02.
- Zmienne sekretów (`JWT/SESSION_SECRET`, `REVALIDATE_SECRET`, dane bazy) są wyłącznie w `.env` i w sekretach CI. Skanowanie sekretów w CI (gitleaks).
