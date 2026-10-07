// F-171, F-173, F-174, F-175 (docs/16 §6.2, docs/12 S17, S18): walidacja formularza zamowienia po stronie klienta.
// Pola zalezne od metody dostawy wynikaja z `shipping_methods[].fields` ustawien sklepu (nie z kodu); NIP przez domene.
// Serwer waliduje to samo (zod) i jest ostateczny; komunikaty bledow serwera mapujemy na te same pola.
import { isValidNip, normalizeNip } from "@taktyl/domain";

export type ShippingField = "email" | "phone" | "name" | "street" | "postcode" | "city" | "point";

export interface CheckoutValues {
  email: string;
  phone: string;
  shipping: string;
  point: string;
  name: string;
  street: string;
  postcode: string;
  city: string;
  invoice: boolean;
  nip: string;
  companyName: string;
  companyAddress: string;
  payment: string;
  terms: boolean;
  newsletter: boolean;
}

export const EMPTY_CHECKOUT: CheckoutValues = {
  email: "",
  phone: "",
  shipping: "",
  point: "",
  name: "",
  street: "",
  postcode: "",
  city: "",
  invoice: false,
  nip: "",
  companyName: "",
  companyAddress: "",
  payment: "",
  terms: false,
  newsletter: false,
};

export type FieldKey =
  | "email"
  | "phone"
  | "shipping"
  | "point"
  | "name"
  | "street"
  | "postcode"
  | "city"
  | "nip"
  | "companyName"
  | "companyAddress"
  | "payment"
  | "terms";

/** Kolejnosc na stronie = kolejnosc, w jakiej fokus trafia na pierwszy blad (F-174). */
export const FIELD_ORDER: readonly FieldKey[] = [
  "email",
  "phone",
  "shipping",
  "point",
  "name",
  "street",
  "postcode",
  "city",
  "nip",
  "companyName",
  "companyAddress",
  "payment",
  "terms",
];

export type Errors = Partial<Record<FieldKey, string>>;

export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
export const POSTCODE_RE = /^\d{2}-\d{3}$/;

/** Telefon: 9 cyfr, dopuszczone spacje, myslniki i prefiks +48; zwraca same cyfry albo null. */
export function normalizePhone(input: string): string | null {
  let digits = input.replace(/[\s-]/g, "");
  if (digits.startsWith("+48")) digits = digits.slice(3);
  return /^\d{9}$/.test(digits) ? digits : null;
}

export function fieldsOf(
  methods: readonly { id: string; fields: readonly string[] }[],
  methodId: string,
): ShippingField[] {
  const m = methods.find((x) => x.id === methodId);
  return (m ? [...m.fields] : []) as ShippingField[];
}

export function validateField(
  key: FieldKey,
  v: CheckoutValues,
  fields: readonly ShippingField[],
): string | null {
  const t = (s: string) => s.trim();
  switch (key) {
    case "email":
      return EMAIL_RE.test(t(v.email)) ? null : "Podaj adres e-mail w formacie nazwa@domena.pl.";
    case "phone":
      return normalizePhone(t(v.phone))
        ? null
        : "Podaj numer telefonu: 9 cyfr, na przykład 500 000 000.";
    case "shipping":
      return v.shipping ? null : "Wybierz metodę dostawy.";
    case "point":
      return fields.includes("point") && !v.point ? "Wybierz automat paczkowy z listy." : null;
    case "name":
      return fields.includes("name") && t(v.name).length < 2
        ? "Podaj imię i nazwisko (co najmniej 2 znaki)."
        : null;
    case "street":
      return fields.includes("street") && t(v.street).length < 2
        ? "Podaj ulicę i numer domu."
        : null;
    case "postcode":
      return fields.includes("postcode") && !POSTCODE_RE.test(t(v.postcode))
        ? "Podaj kod pocztowy w formacie 00-000."
        : null;
    case "city":
      return fields.includes("city") && t(v.city).length < 2 ? "Podaj miejscowość." : null;
    case "nip":
      return v.invoice && !isValidNip(v.nip)
        ? "Numer NIP jest nieprawidłowy. Sprawdź, czy ma 10 cyfr i czy żadna się nie pomyliła."
        : null;
    case "companyName":
      return v.invoice && t(v.companyName).length < 2 ? "Podaj nazwę firmy." : null;
    case "companyAddress":
      return v.invoice && t(v.companyAddress).length < 5
        ? "Podaj adres firmy (ulica, kod pocztowy, miejscowość)."
        : null;
    case "payment":
      return v.payment ? null : "Wybierz metodę płatności.";
    case "terms":
      return v.terms ? null : "Aby złożyć zamówienie, zaakceptuj regulamin.";
  }
}

export function validateAll(v: CheckoutValues, fields: readonly ShippingField[]): Errors {
  const errors: Errors = {};
  for (const k of FIELD_ORDER) {
    const e = validateField(k, v, fields);
    if (e) errors[k] = e;
  }
  return errors;
}

export function firstError(errors: Errors): FieldKey | null {
  return FIELD_ORDER.find((k) => errors[k]) ?? null;
}

/** Mapowanie sciezek bledow serwera (`contact.email`, `shipping.point`, `invoice.nip`...) na pola formularza. */
export const SERVER_PATH_TO_FIELD: Record<string, FieldKey> = {
  "contact.email": "email",
  "contact.phone": "phone",
  "shipping.point": "point",
  "shipping.name": "name",
  "shipping.street": "street",
  "shipping.postcode": "postcode",
  "shipping.city": "city",
  "invoice.nip": "nip",
  "invoice.name": "companyName",
  "invoice.address": "companyAddress",
  payment_type: "payment",
  "consents.terms": "terms",
};

/** Tresc zamowienia dla `POST /v1/orders` (docs/16 §6.2); zadnych pol kart, BLIK ani hasel. */
export function buildOrderBody(args: {
  values: CheckoutValues;
  fields: readonly ShippingField[];
  items: unknown[];
  coupon: string | null;
  expectedTotalGr: number;
}) {
  const { values: v, fields } = args;
  const shipping: Record<string, string> = { method: v.shipping };
  if (fields.includes("point")) shipping.point = v.point;
  if (fields.includes("name")) shipping.name = v.name.trim();
  if (fields.includes("street")) shipping.street = v.street.trim();
  if (fields.includes("postcode")) shipping.postcode = v.postcode.trim();
  if (fields.includes("city")) shipping.city = v.city.trim();
  return {
    items: args.items,
    coupon: args.coupon,
    contact: { email: v.email.trim(), phone: normalizePhone(v.phone.trim()) ?? v.phone.trim() },
    shipping,
    invoice: v.invoice
      ? {
          nip: normalizeNip(v.nip) ?? v.nip.trim(),
          name: v.companyName.trim(),
          address: v.companyAddress.trim(),
        }
      : null,
    payment_type: v.payment,
    consents: { terms: v.terms, newsletter: v.newsletter },
    expected_total_gr: args.expectedTotalGr,
  };
}
