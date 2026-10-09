// I-014: identyfikatory trafiajace do sciezek URL. Waski wzorzec chroni przed wstrzyknieciem segmentow sciezki (../, ?, #).
import { z } from "zod";

export const slugParam = z
  .string()
  .regex(/^[a-z0-9][a-z0-9-]{0,80}$/, "slug: male litery, cyfry i mysliniki")
  .describe("Slug, np. bazalt-75");
export const productIdParam = z
  .string()
  .regex(/^[a-z]-[a-z0-9][a-z0-9-]{0,80}$/, "id produktu, np. k-bazalt-75")
  .describe("Id produktu, np. k-bazalt-75");
export const skuParam = z
  .string()
  .regex(/^[A-Z0-9][A-Z0-9.-]{2,160}$/, "SKU wielkimi literami, np. K-BZL75-GRF-SLZ")
  .describe(
    "SKU wariantu, np. K-BZL75-GRF-SLZ, albo kod konfiguracji wlasnej z narzedzia quote_configuration",
  );
export const orderNumberParam = z
  .string()
  .regex(/^TK-\d{6}-[A-Z0-9]{4}$/, "numer zamowienia: TK-RRMMDD-XXXX")
  .describe("Numer zamowienia, np. TK-261008-AB12");
export const idParam = z
  .string()
  .regex(/^[A-Za-z0-9_-]{1,64}$/, "identyfikator")
  .describe("Identyfikator zasobu");
export const categoryParam = z.enum(["klawiatury", "myszki", "podkladki"]).describe("Kategoria");

/** Skladnik sciezki URL z walidowanej wartosci. */
export const seg = (value: string): string => encodeURIComponent(value);

/** Wartosc zapytania filtrow: liczby, napisy, flagi. */
export const queryRecord = z
  .record(
    z.string().regex(/^[a-z_]{1,32}$/),
    z.union([z.string().max(200), z.number(), z.boolean()]),
  )
  .describe("Parametry zapytania (klucz: wartosc)");
