---
name: taktyl-admin-sklep-sync
description: Procedura dodania pola lub encji end-to-end w Taktylu tak, aby zmiana w backpanelu była widoczna w sklepie - Prisma, migracja, seed, contracts, API, formularz admina, fetch w sklepie, znacznik rewalidacji, test. Użyj przy każdej zmianie modelu danych lub nowym ekranie edycji.
---

# taktyl-admin-sklep-sync

Kontrakt: ADR-0002 (jedna logika i schematy), ADR-0003 (propagacja przez znaczniki), ADR-0005 (seed i baza). Kolejność ma znaczenie - każdy krok ma własny dowód.

## Kroki
1. **Model** - `apps/api/prisma/schema.prisma`: pole/encja; pieniądze `Int` (grosze); status zamiast twardego usuwania. Migracja w kontenerze: `docker compose run --rm migrate` (nowa migracja generowana w kontenerze `dev`). Nie edytuj ręcznie historii migracji.
2. **Seed** - jeśli pole wynika z `data/*.json`: mapowanie w seedzie (idempotentne). Nie dopisujesz danych (reguła 4); brakująca wartość = `null` lub pytanie `Q-xx`.
3. **Kontrakt** - schemat Zod w `packages/contracts` (odczyt i zapis), typy wyeksportowane; wersjonowanie OpenAPI przez DTO. Reguły i obliczenia - tylko w `packages/domain`.
4. **API** - serwis, kontroler, guard roli (viewer nie zapisuje), walidacja Zod, wpis do `audit_log`, **zbiór znaczników** wyliczany z mutacji, zapis do `outbox` po commicie transakcji.
5. **Tabela znaczników** - uzupełnij `docs/14` §6 (encja -> znaczniki, np. produkt: `product:{slug}`, `catalog`, `category:{slug}`, `search-index`; ustawienia: `shop-settings`). Brak wpisu = błąd przeglądu.
6. **Backpanel** - formularz React Hook Form + ten sam schemat Zod, tabela, stany (ładowanie, błąd, brak uprawnień), komunikat "Zapisano. Sklep odświeży stronę w kilka sekund", link "Zobacz w sklepie". ID `B-xxx` w komentarzu.
7. **Sklep** - komponent serwerowy pobiera dane z `fetch(url, { next: { tags: [...] } })` z tymi samymi znacznikami; `/api/revalidate` zna znacznik; dane zmienne w czasie żądania (cena/stan w koszyku i kasie) idą przez `POST /cart/quote` bez cache.
8. **Test** - Vitest (domena/serwis), test integracyjny API (mutacja -> wpis w `outbox` ze znacznikami), Playwright: edycja w backpanelu -> odświeżenie strony sklepu pokazuje zmianę w <= 5 s (wzór S25 z `docs/12` §7). Wszystko w kontenerze `test`.
9. **Dokumenty** - `docs/16-api.md`, `docs/17-model-danych-db.md`, `docs/15-backpanel.md` (ID), w razie potrzeby wpis w `docs/decyzje.md`.

## Kontrola przed REVIEW
- [ ] Migracja przechodzi na pustej bazie i na bazie z seedem.
- [ ] `db:reset-demo` przywraca stan; test e2e startuje od resetu.
- [ ] Viewer widzi, ale nie zapisuje; mutacja jest w `audit_log`.
- [ ] Znaczniki w API = znaczniki w sklepie = wpis w `docs/14` §6.
- [ ] Zero pieniędzy w float; zero kopii reguł poza `packages/domain`.
- [ ] `taktyl-audyt-tokenow` i `taktyl-audyt-tresci` czyste.
