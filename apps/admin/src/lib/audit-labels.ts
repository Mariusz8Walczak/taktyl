// B-011, B-012, B-603 (docs/15 par. 6, 12): polskie nazwy akcji i encji dziennika. Nieznana akcja pokazuje kod.
import type { PluralForms } from "@taktyl/domain";

export const ACTION_LABEL: Record<string, string> = {
  "auth.login": "Logowanie",
  "auth.logout": "Wylogowanie",
  "content.create": "Nowa treść",
  "content.update": "Zmiana treści",
  "content.delete": "Usunięcie treści",
  "faq.replace": "Zmiana listy FAQ",
  "message.update": "Zmiana statusu zgłoszenia",
  "message.delete": "Usunięcie zgłoszenia",
  "messages.retention_purge": "Czyszczenie zgłoszeń (30 dni)",
  "order.note": "Notatka do zamówienia",
  "order.transition": "Zmiana statusu zamówienia",
  "orders.retention_purge": "Anonimizacja zamówień (30 dni)",
  "preset.update": "Zmiana gotowego setu",
  "product.create": "Nowy produkt",
  "product.update": "Zmiana produktu",
  "product.delete": "Usunięcie produktu",
  "product.description.update": "Zmiana opisu produktu",
  "review.replace": "Zmiana opinii przykładowych",
  "revalidate.manual": "Ręczne odświeżenie sklepu",
  "settings.update": "Zmiana ustawień sklepu",
  "user.bootstrap": "Konto początkowe",
  "user.create": "Nowe konto",
  "user.update": "Zmiana konta",
  "variant.create": "Nowy wariant",
  "variant.update": "Zmiana wariantu",
  "variant.delete": "Usunięcie wariantu",
  "variant.price.set": "Zmiana ceny wariantu",
  "variant.stock.set": "Zmiana stanu wariantu",
  "media.upload": "Wgranie zdjęcia",
  "media.delete": "Usunięcie zdjęcia",
};

export const ENTITY_LABEL: Record<string, string> = {
  content: "Treść",
  login: "Logowanie",
  media: "Zdjęcie",
  message: "Zgłoszenie",
  order: "Zamówienie",
  preset: "Gotowy set",
  product: "Produkt",
  revalidate: "Odświeżenie sklepu",
  review: "Opinie",
  session: "Sesja",
  settings: "Ustawienia",
  user: "Konto",
  variant: "Wariant",
};

export interface FieldChange {
  path: string;
  before: string;
  after: string;
}

const show = (v: unknown): string => {
  if (v === undefined || v === null) return "brak";
  if (typeof v === "string") return v === "" ? "(puste)" : v;
  if (typeof v === "boolean") return v ? "tak" : "nie";
  if (typeof v === "number") return v.toLocaleString("pl-PL");
  return JSON.stringify(v);
};

function flatten(value: unknown, prefix: string, out: Map<string, unknown>): void {
  if (value !== null && typeof value === "object" && !Array.isArray(value)) {
    const entries = Object.entries(value as Record<string, unknown>);
    if (entries.length === 0 && prefix) out.set(prefix, "{}");
    for (const [k, v] of entries) flatten(v, prefix ? `${prefix}.${k}` : k, out);
    return;
  }
  out.set(prefix || "(wartość)", value);
}

/** B-012: czytelna lista zmienionych pol (przed -> po); pola bez zmiany sa pomijane. */
export function diffAudit(before: unknown, after: unknown): FieldChange[] {
  const a = new Map<string, unknown>();
  const b = new Map<string, unknown>();
  if (before !== null && before !== undefined) flatten(before, "", a);
  if (after !== null && after !== undefined) flatten(after, "", b);
  const paths = [...new Set([...a.keys(), ...b.keys()])];
  return paths
    .filter((p) => JSON.stringify(a.get(p) ?? null) !== JSON.stringify(b.get(p) ?? null))
    .map((p) => ({ path: p, before: show(a.get(p)), after: show(b.get(p)) }));
}

export const ENTRY_COUNT: PluralForms = { one: "wpis", few: "wpisy", many: "wpisów" };
