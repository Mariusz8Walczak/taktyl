// F-250..F-256 (ADR-0011): konfiguracja wlasna produktu. Klient niesie tylko wybory; cene (doplaty) i SKU liczy serwer.
import { z } from "zod";

const keySchema = z
  .string()
  .min(1)
  .max(40)
  .regex(/^[a-z0-9-]+$/);

/** Id czesci modelu (`legendy_alfa`, `obudowa_spod`). */
const partKeySchema = z
  .string()
  .min(1)
  .max(40)
  .regex(/^[a-z0-9_-]+$/);

export const configPartChoiceSchema = z.strictObject({
  /** Klucz koloru z `data/colors.json`; "auto" tylko dla nadrukow klawiszy (kontrast liczy serwer). */
  color: z.union([keySchema, z.literal("auto")]),
  finish: keySchema.nullable(),
});

export const configurationSchema = z.strictObject({
  /** Id modelu 3D: `k-kwarc-60`, `p-tafla_l`. */
  model: partKeySchema,
  parts: z.record(partKeySchema, configPartChoiceSchema),
  print: keySchema.nullish(),
  /** Przelacznik klawiatury (id ze slownika); pominiety = pierwszy ze slownika. */
  switch: keySchema.nullish(),
});
export type ConfigurationInput = z.infer<typeof configurationSchema>;

// --- Odpowiedzi publiczne: slowniki konfiguratora i wycena (GET /v1/configurator, POST /v1/configurator/quote) ---

const finishPbrSchema = z.record(
  z.string(),
  z.union([z.number(), z.string(), z.boolean(), z.array(z.number())]),
);

export const configuratorPartSchema = z.object({
  id: z.string().min(1).max(40),
  etykieta: z.string(),
  konfigurowalna: z.boolean(),
  paleta: z.string().nullish(),
  domyslnie: z.object({ kolor: z.string().nullable(), wykonczenie: z.string().nullable() }),
  uwagi: z.string().optional(),
});
export const configuratorModelSchema = z.object({
  id: z.string(),
  product: z.string(),
  size: z.string().nullable(),
  sku_prefix: z.string(),
  name: z.string(),
  file: z.string(),
  dims_mm: z.array(z.number()),
  parts: z.array(configuratorPartSchema),
});
export const configuratorDataSchema = z.object({
  colors: z.record(
    z.string(),
    z.object({ code: z.string(), label: z.string(), harmony: z.string(), swatch: z.string() }),
  ),
  finishes: z.record(
    z.string(),
    z.object({ code: z.string(), label: z.string(), pbr: finishPbrSchema }),
  ),
  palettes: z.record(
    z.string(),
    z.object({
      wykonczenia: z.array(z.string()),
      kolory: z.union([z.array(z.string()), z.string()]),
      auto: z.string().optional(),
    }),
  ),
  /** Przelaczniki klawiatur (kod 3-literowy z SKU). */
  switches: z.record(z.string(), z.object({ code: z.string(), name: z.string() })),
  models: z.array(configuratorModelSchema),
  prints: z.array(
    z.object({
      id: z.string(),
      nazwa: z.string(),
      plik: z.string(),
      miniatura: z.string(),
      tryb: z.string(),
      mm: z.array(z.number()).optional(),
      dla: z.array(z.string()),
      obszycie: z.string().nullish(),
    }),
  ),
});
export type ConfiguratorData = z.infer<typeof configuratorDataSchema>;

export const configuratorQuoteSchema = z.object({
  ok: z.boolean(),
  issues: z.array(z.object({ code: z.string(), part: z.string().optional(), message: z.string() })),
  adjustments: z.array(
    z.object({ part: z.string(), from: z.string(), to: z.string(), reason: z.string() }),
  ),
  /** Konfiguracja po uzupelnieniu domyslnych i podmianie nadrukow o slabym kontrascie. */
  config: z.object({
    model: z.string(),
    parts: z.record(z.string(), configPartChoiceSchema),
    print: z.string().nullable(),
    switch: z.string().nullish(),
  }),
  sku: z.string().nullable(),
  base_price_gr: z.number().int().nonnegative(),
  surcharge_gr: z.number().int().nonnegative(),
  total_gr: z.number().int().nonnegative(),
  made_to_order: z.literal(true),
});
export type ConfiguratorQuote = z.infer<typeof configuratorQuoteSchema>;

// --- „Stwórz własny set” (F-255): trzy konfiguracje, rabat setu liczy API wg ustawien sklepu ---

export const configuratorSetRequestSchema = z.strictObject({
  items: z.array(configurationSchema).min(1).max(3),
});
export type ConfiguratorSetRequest = z.infer<typeof configuratorSetRequestSchema>;

export const configuratorSetQuoteSchema = z.object({
  items: z.array(configuratorQuoteSchema),
  sum_gr: z.number().int().nonnegative(),
  /** Rabat setu (reguła i procent z ustawien sklepu); 0, gdy brak kompletu trzech kategorii. */
  discount_gr: z.number().int().nonnegative(),
  total_gr: z.number().int().nonnegative(),
  percent: z.number(),
  complete: z.boolean(),
  ok: z.boolean(),
  made_to_order: z.literal(true),
});
export type ConfiguratorSetQuote = z.infer<typeof configuratorSetQuoteSchema>;
