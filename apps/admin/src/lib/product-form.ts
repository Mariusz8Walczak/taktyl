// B-102, B-111 (docs/15 par. 7.2, docs/04 par. 4): opis pol edycji produktu i schematy formularzy zlozone ze schematow
// @taktyl/contracts. Atrybuty sa walidowane schematem kategorii (attributesSchemaByCategory), reszta schematem PATCH.
import {
  attributesSchemaByCategory,
  fitSchema,
  gpsrSchema,
  productCreateSchema,
  productPatchSchema,
  type CategoryId,
} from "@taktyl/contracts";
import { z } from "zod";
import type { FieldErrors, FieldValues } from "react-hook-form";

export type AttrKind =
  "text" | "nulltext" | "int" | "bool" | "multi" | "select" | "dims" | "handcm";
export interface AttrDesc {
  key: string;
  label: string;
  kind: AttrKind;
  options?: readonly { v: string; l: string }[];
  hint?: string;
}

const CONNECTIVITY = [
  { v: "usb-c", l: "Przewód USB-C" },
  { v: "2.4ghz", l: "2,4 GHz" },
  { v: "bt", l: "Bluetooth" },
] as const;

/** Pola atrybutow wg docs/04 par. 4 (etykiety jak na karcie produktu). Pola podkladek: osobny blok rozmiarow. */
export const ATTRIBUTE_FIELDS: Record<CategoryId, readonly AttrDesc[]> = {
  klawiatury: [
    { key: "size", label: "Kod rozmiaru", kind: "text", hint: "Np. 75, tkl." },
    { key: "size_label", label: "Rozmiar", kind: "text" },
    { key: "keys", label: "Liczba klawiszy", kind: "int" },
    { key: "layout", label: "Układ", kind: "text" },
    { key: "connectivity", label: "Łączność", kind: "multi", options: CONNECTIVITY },
    { key: "case", label: "Obudowa", kind: "text" },
    { key: "mount", label: "Mocowanie płyty", kind: "text" },
    { key: "hotswap", label: "Wymiana przełączników bez lutowania", kind: "bool" },
    { key: "keycaps", label: "Keycapy", kind: "text" },
    { key: "backlight", label: "Podświetlenie", kind: "text" },
    { key: "battery", label: "Akumulator", kind: "nulltext", hint: "Puste = brak akumulatora." },
    { key: "knob", label: "Pokrętło", kind: "bool" },
    { key: "weight_g", label: "Waga (g)", kind: "int" },
    { key: "dims_mm", label: "Wymiary (szer. x gł. x wys., mm)", kind: "dims" },
  ],
  myszki: [
    { key: "shape", label: "Kształt", kind: "text" },
    {
      key: "hand",
      label: "Ręka",
      kind: "select",
      options: [
        { v: "prawa", l: "Dla praworęcznych" },
        { v: "obureczna", l: "Oburęczna" },
      ],
    },
    { key: "hand_note", label: "Uwagi", kind: "nulltext" },
    {
      key: "size",
      label: "Rozmiar",
      kind: "select",
      options: [
        { v: "S", l: "S" },
        { v: "M", l: "M" },
        { v: "L", l: "L" },
      ],
    },
    { key: "hand_cm", label: "Długość dłoni (od, do, cm)", kind: "handcm" },
    {
      key: "grips",
      label: "Chwyt",
      kind: "multi",
      options: [
        { v: "palm", l: "Dłoniowy (palm)" },
        { v: "claw", l: "Szponowy (claw)" },
        { v: "fingertip", l: "Opuszkowy (fingertip)" },
      ],
    },
    { key: "weight_g", label: "Waga (g)", kind: "int" },
    { key: "dims_mm", label: "Wymiary (szer. x gł. x wys., mm)", kind: "dims" },
    {
      key: "connectivity",
      label: "Łączność",
      kind: "multi",
      options: [{ v: "przewod", l: "Przewód" }, ...CONNECTIVITY],
    },
    { key: "dpi_max", label: "Rozdzielczość maks. (DPI)", kind: "int" },
    { key: "polling_hz", label: "Częstotliwość raportowania (Hz)", kind: "int" },
    { key: "battery", label: "Bateria", kind: "nulltext", hint: "Puste = brak baterii." },
    { key: "sensor", label: "Sensor", kind: "text", hint: "Opisowo, bez nazw handlowych." },
  ],
  podkladki: [
    { key: "surface", label: "Powierzchnia", kind: "text" },
    { key: "material", label: "Materiał", kind: "text" },
    { key: "thickness_mm", label: "Grubość (mm)", kind: "int" },
    { key: "edge", label: "Krawędź", kind: "text" },
  ],
};

export const PAD_SIZE_KEYS = ["m", "l", "xl", "xxl"] as const;
export const PAD_TYPE_OPTIONS = [
  { v: "mysz", l: "Pod myszkę" },
  { v: "biurko", l: "Na całe biurko" },
] as const;
export const FIT_KEYS = ["fps", "gry", "programowanie", "biuro", "cisza"] as const;
export const FIT_LABEL = {
  fps: "FPS",
  gry: "Gry",
  programowanie: "Programowanie",
  biuro: "Biuro",
  cisza: "Cisza",
} as const;

/** Odczyt bledu pola po sciezce "a.b.c" z drzewa bledow RHF. */
export function getFieldError(errors: FieldErrors<FieldValues>, path: string): string | undefined {
  let cur: unknown = errors;
  for (const seg of path.split(".")) {
    if (cur === null || typeof cur !== "object") return undefined;
    cur = (cur as Record<string, unknown>)[seg];
  }
  const msg = (cur as { message?: unknown } | undefined)?.message;
  return typeof msg === "string" ? msg : undefined;
}

const patchShape = productPatchSchema.shape;

/** Linie tekstu -> lista (jedna pozycja zestawu na wiersz), zgodna z `in_box` z kontraktu. */
const inBoxFromText = z
  .string()
  .transform((s) =>
    s
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean),
  )
  .pipe(patchShape.in_box.unwrap());

/** Schemat edycji produktu: pola z productPatchSchema + atrybuty wg schematu kategorii. */
export function productEditSchema(category: CategoryId) {
  return z.object({
    name: patchShape.name.unwrap(),
    slug: patchShape.slug.unwrap(),
    short: patchShape.short.unwrap(),
    badges: patchShape.badges.unwrap(),
    fit: fitSchema,
    in_box: inBoxFromText,
    gpsr: gpsrSchema,
    status: patchShape.status.unwrap(),
    attributes: attributesSchemaByCategory[category],
  });
}

/** Schemat tworzenia produktu: pola z productCreateSchema + atrybuty wg schematu kategorii. */
export function productNewSchema(category: CategoryId) {
  const s = productCreateSchema.shape;
  return z.object({
    id: s.id,
    slug: s.slug,
    category: s.category,
    name: s.name,
    short: s.short,
    options: s.options,
    badges: patchShape.badges.unwrap(),
    fit: fitSchema,
    in_box: inBoxFromText,
    gpsr: gpsrSchema,
    attributes: attributesSchemaByCategory[category],
  });
}

/** Polskie komunikaty pol edycji produktu (docs/15 par. 7.2). */
export const PRODUCT_MESSAGES: Record<string, string> = {
  name: "Wpisz nazwę produktu (2 do 80 znaków).",
  slug: "Adres: małe litery, cyfry i łączniki, np. bazalt-75.",
  short: "Wpisz krótki opis (od 5 do 300 znaków).",
  id: "Identyfikator: małe litery, cyfry i łączniki, zaczyna się od k-, m- albo p-.",
  "gpsr.manufacturer": "Wpisz producenta.",
  "gpsr.address": "Wpisz adres producenta.",
  "gpsr.contact": "Użyj adresu w domenie taktyl.example.",
  "gpsr.warnings": "Wpisz ostrzeżenia lub „Brak”.",
  options: "Wybierz co najmniej jedną opcję wariantu.",
};
