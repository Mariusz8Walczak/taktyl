// B-400..B-408 (docs/15 par. 10): schematy formularzy ustawien zlozone ze schematow @taktyl/contracts (settingsPatchSchema,
// adminShippingMethodSchema, discountCodeSchema, ...). Kwoty w zlotych (tekst) -> grosze przez helper domeny.
import {
  type adminSettingsSchema,
  adminShippingMethodSchema,
  discountCodeSchema,
  paymentTypeSchema,
  pickupPointSchema,
  settingsPatchSchema,
  setDiscountSchema,
  shippingFieldSchema,
} from "@taktyl/contracts";
import { formatZlotyInput, parseZlotyInput } from "@taktyl/domain";
import { z } from "zod";

export type AdminSettings = z.infer<typeof adminSettingsSchema>;

const patch = settingsPatchSchema.shape;

/** Kwota w zlotych z przecinkiem -> grosze (>= 0). Zle dane daja NaN, ktory odrzuca schemat calkowity. */
const zlotyText = z.string().transform((s) => parseZlotyInput(s) ?? Number.NaN);
const emptyToNull = z.string().transform((s) => (s.trim() === "" ? null : s.trim()));

export const SHIPPING_FIELD_LABEL: Record<z.infer<typeof shippingFieldSchema>, string> = {
  email: "E-mail",
  phone: "Telefon",
  name: "Imię i nazwisko",
  street: "Ulica",
  postcode: "Kod pocztowy",
  city: "Miasto",
  point: "Punkt odbioru",
};
export const SHIPPING_FIELD_OPTIONS = shippingFieldSchema.options;

// ---- Dostawa (B-400, B-402)
export const shippingFormSchema = z.object({
  threshold: zlotyText.pipe(patch.free_shipping_threshold_gr.unwrap()),
  methods: z.array(
    z.object({
      id: adminShippingMethodSchema.shape.id,
      label: adminShippingMethodSchema.shape.label,
      price: zlotyText.pipe(adminShippingMethodSchema.shape.price_gr),
      eta: adminShippingMethodSchema.shape.eta_business_days,
      fields: adminShippingMethodSchema.shape.fields,
      address: emptyToNull,
      active: z.boolean(),
    }),
  ),
});
export type ShippingInput = z.input<typeof shippingFormSchema>;
export type ShippingOutput = z.output<typeof shippingFormSchema>;

export function shippingDefaults(s: AdminSettings): ShippingInput {
  return {
    threshold: formatZlotyInput(s.free_shipping_threshold_gr),
    methods: s.shipping_methods.map((m) => ({
      id: m.id,
      label: m.label,
      price: formatZlotyInput(m.price_gr),
      eta: m.eta_business_days,
      fields: [...m.fields],
      address: m.address ?? "",
      active: m.active,
    })),
  };
}
export function shippingBody(v: ShippingOutput) {
  return {
    free_shipping_threshold_gr: v.threshold,
    shipping_methods: v.methods.map((m) => ({
      id: m.id,
      label: m.label,
      price_gr: m.price,
      eta_business_days: m.eta,
      fields: m.fields,
      address: m.address,
      active: m.active,
    })),
  };
}

// ---- Platnosci (B-403)
export const paymentsFormSchema = z.object({
  methods: z.array(
    z.object({
      id: paymentTypeSchema,
      label: z.string().trim().min(1).max(60),
      active: z.boolean(),
    }),
  ),
});
export type PaymentsInput = z.input<typeof paymentsFormSchema>;
export type PaymentsOutput = z.output<typeof paymentsFormSchema>;
export const paymentsDefaults = (s: AdminSettings): PaymentsInput => ({
  methods: s.payment_methods.map((m) => ({ id: m.id, label: m.label, active: m.active })),
});
export const paymentsBody = (v: PaymentsOutput) => ({ payment_methods: v.methods });

// ---- Rabaty i kody (B-401, B-404)
const codeValue = z
  .string()
  .transform((s) => (s.trim() === "" ? null : Number(s)))
  .pipe(discountCodeSchema.shape.value);
export const discountsFormSchema = z.object({
  percent: setDiscountSchema.shape.percent,
  codes: z.array(
    z.object({
      code: discountCodeSchema.shape.code.min(4).max(20),
      type: discountCodeSchema.shape.type,
      value: codeValue,
      scope: z.string().trim().min(1).max(120),
      label: z.string().trim().min(1).max(120),
      active: z.boolean(),
      valid_from: emptyToNull,
      valid_to: emptyToNull,
    }),
  ),
});
export type DiscountsInput = z.input<typeof discountsFormSchema>;
export type DiscountsOutput = z.output<typeof discountsFormSchema>;
export const discountsDefaults = (s: AdminSettings): DiscountsInput => ({
  percent: s.set_discount.percent,
  codes: s.discount_codes.map((c) => ({
    code: c.code,
    type: c.type,
    value: c.value === null ? "" : String(c.value),
    scope: c.scope,
    label: c.label,
    active: c.active,
    valid_from: c.valid_from ?? "",
    valid_to: c.valid_to ?? "",
  })),
});
export const discountsBody = (v: DiscountsOutput, s: AdminSettings) => ({
  set_discount: { percent: v.percent, categories: s.set_discount.categories },
  discount_codes: v.codes,
});

// ---- Punkty odbioru (B-405)
export const pickupFormSchema = z.object({
  points: z.array(
    z.object({
      id: pickupPointSchema.shape.id,
      city: z.string().trim().min(1).max(60),
      label: z.string().trim().min(1).max(160),
      active: z.boolean(),
    }),
  ),
});
export type PickupInput = z.input<typeof pickupFormSchema>;
export type PickupOutput = z.output<typeof pickupFormSchema>;
export const pickupDefaults = (s: AdminSettings): PickupInput => ({
  points: s.pickup_points.map((p) => ({
    id: p.id,
    city: p.city,
    label: p.label,
    active: p.active,
  })),
});
export const pickupBody = (v: PickupOutput) => ({ pickup_points: v.points });

// ---- Wysylka (B-407)
export const dispatchFormSchema = z.object({ cutoff: patch.dispatch_cutoff_hour.unwrap() });
export type DispatchInput = z.input<typeof dispatchFormSchema>;
export type DispatchOutput = z.output<typeof dispatchFormSchema>;
export const dispatchDefaults = (s: AdminSettings): DispatchInput => ({
  cutoff: s.dispatch_cutoff_hour,
});
export const dispatchBody = (v: DispatchOutput) => ({ dispatch_cutoff_hour: v.cutoff });

// ---- Firma i etykiety (B-406, B-408)
export const COMPANY_KEYS = [
  ["name", "Nazwa firmy"],
  ["address", "Adres"],
  ["phone", "Telefon"],
  ["email", "E-mail"],
] as const;
export const companyFormSchema = z.object({
  demoLabel: patch.demo.unwrap().shape.label,
  company: z.object({
    name: z.string().max(200),
    address: z.string().max(200),
    phone: z.string().max(200),
    email: z.string().max(200),
  }),
});
export type CompanyInput = z.input<typeof companyFormSchema>;
export type CompanyOutput = z.output<typeof companyFormSchema>;
export const companyDefaults = (s: AdminSettings): CompanyInput => ({
  demoLabel: s.demo.label,
  company: {
    name: s.company["name"] ?? "",
    address: s.company["address"] ?? "",
    phone: s.company["phone"] ?? "",
    email: s.company["email"] ?? "",
  },
});
export const companyBody = (v: CompanyOutput, s: AdminSettings) => {
  const extra = Object.fromEntries(
    Object.entries(s.company).filter(([k]) => !COMPANY_KEYS.some(([key]) => key === k)),
  );
  const own = Object.fromEntries(Object.entries(v.company).filter(([, val]) => val.trim() !== ""));
  return { demo: { label: v.demoLabel }, company: { ...extra, ...own } };
};

/** Komunikaty pol ustawien (docs/15 par. 10.1); * zastepuje indeks wiersza. */
export const SETTINGS_MESSAGES = {
  threshold: "Wpisz kwotę w złotych, np. 299,00.",
  "methods.*.price": "Wpisz kwotę w złotych, np. 12,99.",
  "methods.*.label": "Wpisz nazwę metody dostawy.",
  "methods.*.eta": "Wpisz liczbę dni roboczych od 0 do 30.",
  percent: "Wpisz liczbę od 0 do 50.",
  "codes.*.code": "Kod ma 4-20 znaków: wielkie litery i cyfry.",
  "codes.*.value": "Wpisz procent od 1 do 90.",
  "codes.*.scope": "Opisz, czego dotyczy kod.",
  "codes.*.label": "Wpisz etykietę kodu.",
  "points.*.id": "Identyfikator ma postać WAW-001.",
  "points.*.city": "Wpisz miasto.",
  "points.*.label": "Wpisz nazwę punktu (oznaczoną jako fikcyjna).",
  cutoff: "Wpisz godzinę od 0 do 23.",
  demoLabel: "Etykieta demo nie może być pusta.",
} as const;
