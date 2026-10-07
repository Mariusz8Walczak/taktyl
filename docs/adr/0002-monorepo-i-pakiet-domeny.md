# ADR-0002 · Monorepo (pnpm + Turborepo) i pakiet domeny

- **Status:** przyjęta

## Decyzja

Jedno repozytorium, cztery aplikacje/pakiety rdzeniowe:

```
apps/
  api/        NestJS: REST API sklepu + API backpanelu, Prisma, seed
  web/        Next.js: sklep (storefront)
  admin/      Next.js: backpanel
packages/
  domain/     czysta logika domeny, bez I/O: grosze, rabat setu, reguły dopasowania,
              termin wysyłki, NIP, liczebniki, normalizacja wyszukiwania, filtry/facety
  contracts/  schematy Zod + typy DTO (kontrakt API), klient HTTP
  tokens/     assets/tokens.css bez zmian + taktyl.css (nadpisania) — używane przez web i admin
data/         seed (bez zmian)
assets/       manifest zdjęć, fonty
docs/         dokumentacja (źródło prawdy dla agentów)
.claude/      agenci i skille projektu
```

## Dlaczego `packages/domain`

Ta sama arytmetyka i te same reguły muszą działać w **dwóch miejscach**: w sklepie (podgląd na żywo w kreatorze, bez czekania na sieć) i w API (autorytatywna wycena zamówienia, walidacja). Jeden pakiet = jedna prawda, jedne testy z `docs/12` §2 (ceny setów, reguły z `docs/03` §4.4, liczebniki, formatowanie, NIP, termin wysyłki).

Zasady pakietu: zero zależności od Nest/Next/Prisma, zero `Date.now()` bez wstrzykniętego zegara, zero floatów dla pieniędzy (grosze, `number` całkowity), strefa `Europe/Warsaw` jawnie.

## Konsekwencje

- API **nigdy nie ufa** kwotom z klienta: przelicza zamówienie z pakietu `domain` na podstawie bazy.
- Klient pokazuje wycenę lokalnie (A-04, kreator), a przy otwarciu koszyka i zamówienia pobiera „wycenę” z API (`POST /cart/quote`) i pokazuje różnice (F-157).
- Zmiana reguły w `domain` = zmiana w obu miejscach naraz, jeden test.
