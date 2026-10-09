// F-110..F-119 (ADR-0011): konfiguracja wlasna produktu. Klient niesie tylko wybory; cene (doplaty) i SKU liczy serwer.
import { z } from "zod";

const keySchema = z.string().min(1).max(40).regex(/^[a-z0-9-]+$/);

export const configPartChoiceSchema = z.strictObject({
  /** Klucz koloru z `data/colors.json`; "auto" tylko dla nadrukow klawiszy (kontrast liczy serwer). */
  color: z.union([keySchema, z.literal("auto")]),
  finish: keySchema.nullable(),
});

export const configurationSchema = z.strictObject({
  model: keySchema,
  parts: z.record(keySchema, configPartChoiceSchema),
  print: keySchema.nullish(),
});
export type ConfigurationInput = z.infer<typeof configurationSchema>;
