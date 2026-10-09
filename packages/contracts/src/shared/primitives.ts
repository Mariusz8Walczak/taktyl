// B-xxx / docs/16 §1: wspolne typy proste kontraktu. Pieniadze to grosze (int), pola z sufiksem _gr.
import { z } from "zod";

/** Kwota w groszach, liczba calkowita >= 0 (ADR-0007, docs/17 §1). Float jest odrzucany. */
export const grosze = z.int();
export const groszeNonNegative = grosze.min(0);
export const groszePositive = grosze.min(1);

export const currencySchema = z.literal("PLN");

export const slugSchema = z
  .string()
  .min(1)
  .max(80)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "slug: male litery, cyfry, myslniki");
export const productIdSchema = z
  .string()
  .min(1)
  .max(80)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);

/** SKU wg docs/04 §3.1: K-{model}-{kolor}-{przelacznik}, M-{model}-{kolor}, P-{model}-{rozmiar}-{kolor}. */
export const SKU_PATTERN =
  /^(?:K-[A-Z0-9]{2,8}-[A-Z]{3}-[A-Z]{3}|M-[A-Z0-9]{2,8}-[A-Z]{3}|P-[A-Z0-9]{2,8}-(?:M|L|XL|XXL)-[A-Z]{3})$/;
export const skuSchema = z.string().regex(SKU_PATTERN, "SKU niezgodny ze wzorem z docs/04 §3.1");

/** SKU konfiguracji wlasnej (ADR-0011): `<prefiks modelu>-CFG-<kody czesci rozdzielone kropka>`, np. K-KWR60-CFG-TRKP.KRMB. */
export const CONFIG_SKU_PATTERN =
  /^(?:K-[A-Z0-9]{2,8}|M-[A-Z0-9]{2,8}|P-[A-Z0-9]{2,8}-(?:M|L|XL|XXL))-CFG-[A-Z0-9]{3,16}(?:\.[A-Z0-9]{3,16}){0,15}$/;
export const configSkuSchema = z
  .string()
  .regex(CONFIG_SKU_PATTERN, "kod konfiguracji niezgodny ze wzorem z ADR-0011");
/** SKU pozycji koszyka: wariant z katalogu albo konfiguracja wlasna. */
export const cartSkuSchema = z
  .string()
  .refine(
    (s) => SKU_PATTERN.test(s) || CONFIG_SKU_PATTERN.test(s),
    "SKU niezgodny ze wzorem (docs/04 §3.1, ADR-0011)",
  );

/** Numer zamowienia TK-RRMMDD-XXXX (docs/16 §1). Alfabet XXXX jest sciagany w API (docs/17 §3.4), tu tolerancyjnie [A-Z0-9]. */
export const orderNumberSchema = z
  .string()
  .regex(/^TK-\d{6}-[A-Z0-9]{4}$/, "numer zamowienia: TK-RRMMDD-XXXX");

export const emailSchema = z.email().max(254);
/** 9 cyfr z opcjonalnym +48 i separatorami (spacja, myslnik). */
export const phoneSchema = z
  .string()
  .regex(/^(?:\+48[ -]?)?(?:\d[ -]?){8}\d$/, "telefon: 9 cyfr, opcjonalnie +48");
/** Kod pocztowy PL: 00-000. */
export const postcodeSchema = z.string().regex(/^\d{2}-\d{3}$/, "kod pocztowy: NN-NNN");
/** NIP: 10 cyfr (suma kontrolna sprawdzana w packages/domain, S18). */
export const nipSchema = z.string().regex(/^\d{10}$/, "NIP: 10 cyfr");

/** ISO 8601 z przesunieciem, np. 2026-10-07T16:00:00+02:00 (docs/16 §1). */
export const dateTimeSchema = z.iso.datetime({ offset: true });
/** Data kalendarzowa RRRR-MM-DD (strefa Europe/Warsaw). */
export const dateSchema = z.iso.date();

export const couponCodeSchema = z
  .string()
  .min(1)
  .max(32)
  .regex(/^[A-Z0-9_-]+$/, "kod: wielkie litery, cyfry, - i _");

/** Wersja encji do If-Match (docs/16 §1). */
export const versionSchema = z.int().min(1);
/** Naglowek If-Match: "<version>" w cudzyslowie, wynik to liczba. */
export const ifMatchSchema = z
  .string()
  .regex(/^"\d+"$/, 'If-Match: "<version>"')
  .transform((v) => Number(v.slice(1, -1)));
/** Naglowek Idempotency-Key (UUID). */
export const idempotencyKeySchema = z.uuid();

export const qtySchema = z.int().min(1).max(10);
