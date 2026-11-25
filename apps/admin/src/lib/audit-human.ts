// B-619 (docs/25 par. 2, rzad 5): dziennik zmian po ludzku. Zdanie "kto zrobil co z czym" (nazwa produktu zamiast klucza),
// rodzaj (ikona), odnosnik do encji i grupowanie serii: kolejne wpisy tej samej osoby i akcji w krotkim odstepie
// skladaja sie w jeden ("wgral 38 zdjec w 2 min"). Czysta logika: dane wejsciowe z /v1/admin/audit, slowniki z katalogu.
import { pluralize, type PluralForms } from "@taktyl/domain";
import { ACTION_LABEL } from "./audit-labels";

export type AuditKind =
  | "zdjecie"
  | "cena"
  | "stan"
  | "produkt"
  | "zamowienie"
  | "tresc"
  | "ustawienia"
  | "konto"
  | "system";

export interface AuditLike {
  id: string;
  at: string;
  actor_id: string | null;
  actor_role: string;
  actor_label?: string;
  action: string;
  entity: string;
  entity_id: string;
}

export interface Dictionaries {
  /** id produktu -> nazwa */
  products: ReadonlyMap<string, string>;
  /** id koloru -> etykieta */
  colors: ReadonlyMap<string, string>;
  /** SKU -> { id produktu, nazwa } */
  variants?: ReadonlyMap<string, { productId: string; name: string }>;
}

export interface HumanEntry {
  key: string;
  kind: AuditKind;
  actor: string;
  /** zdanie bez podmiotu, np. "wgrał zdjęcia Tafla (Mgła)" */
  text: string;
  href: string | null;
  at: string;
  /** pierwszy wpis serii (dla "w 2 min") */
  firstAt: string;
  count: number;
}

const PHOTO: PluralForms = { one: "zdjęcie", few: "zdjęcia", many: "zdjęć" };
const ENTRY: PluralForms = { one: "zmiana", few: "zmiany", many: "zmian" };
/** Odstep, w ktorym kolejne wpisy tej samej osoby i akcji tworza serie. */
export const SERIES_GAP_MS = 5 * 60_000;

const ROLE_ACTOR: Record<string, string> = {
  owner: "Właściciel",
  editor: "Edytor",
  viewer: "Viewer",
  system: "System",
};

function kindOf(action: string, entity: string): AuditKind {
  if (entity === "media") return "zdjecie";
  if (action.startsWith("variant.price")) return "cena";
  if (action.startsWith("variant.stock")) return "stan";
  if (entity === "product" || entity === "variant" || entity === "preset") return "produkt";
  if (entity === "order") return "zamowienie";
  if (["content", "review", "faq", "message"].includes(entity)) return "tresc";
  if (entity === "settings") return "ustawienia";
  if (["user", "login", "session"].includes(entity)) return "konto";
  return "system";
}

/** Klucz zdjecia "m-pustulka_kowalik_01-34" -> { produkt, kolor }. */
export function parseMediaKey(key: string): { productId: string; color: string } | null {
  const m = /^([a-z0-9-]+?)_([a-z0-9-]+)_/.exec(key);
  return m ? { productId: m[1] as string, color: m[2] as string } : null;
}

function subject(e: AuditLike, d: Dictionaries): { name: string; href: string | null } {
  if (e.entity === "media") {
    const k = parseMediaKey(e.entity_id);
    if (!k) return { name: e.entity_id, href: "/media" };
    const product = d.products.get(k.productId) ?? k.productId;
    const color = d.colors.get(k.color) ?? k.color;
    return {
      name: `${product} (${color})`,
      href: `/media?product_id=${encodeURIComponent(k.productId)}`,
    };
  }
  if (e.entity === "product") {
    return {
      name: d.products.get(e.entity_id) ?? e.entity_id,
      href: `/produkty/${encodeURIComponent(e.entity_id)}`,
    };
  }
  if (e.entity === "variant") {
    const v = d.variants?.get(e.entity_id);
    return {
      name: v ? `${v.name}, ${e.entity_id}` : e.entity_id,
      href: v ? `/produkty/${encodeURIComponent(v.productId)}?zakladka=warianty` : null,
    };
  }
  if (e.entity === "order") {
    return e.entity_id === "retention"
      ? { name: "zamówień starszych niż 30 dni", href: "/zamowienia" }
      : { name: e.entity_id, href: `/zamowienia/${encodeURIComponent(e.entity_id)}` };
  }
  if (e.entity === "settings") return { name: "ustawień sklepu", href: "/ustawienia" };
  if (e.entity === "content") return { name: e.entity_id, href: "/tresci" };
  return { name: e.entity_id, href: null };
}

const VERB: Record<string, (n: number, what: string) => string> = {
  "media.upload": (n, what) =>
    n > 1 ? `wgrał ${n} ${pluralize(n, PHOTO)}, ostatnie: ${what}` : `wgrał zdjęcia ${what}`,
  "media.delete": (n, what) =>
    n > 1 ? `usunął ${n} ${pluralize(n, PHOTO)}` : `usunął zdjęcia ${what}`,
  "variant.price.set": (n, what) =>
    n > 1 ? `zmienił ${n} cen, ostatnio ${what}` : `zmienił cenę ${what}`,
  "variant.stock.set": (n, what) =>
    n > 1 ? `zmienił ${n} stanów, ostatnio ${what}` : `zmienił stan ${what}`,
  "order.transition": (n, what) =>
    n > 1 ? `zmienił status ${n} zamówień` : `zmienił status zamówienia ${what}`,
  "order.note": (_n, what) => `dodał notatkę do zamówienia ${what}`,
  "product.update": (n, what) => (n > 1 ? `zmienił ${n} produktów` : `zmienił produkt ${what}`),
  "product.create": (_n, what) => `dodał produkt ${what}`,
  "product.description.update": (_n, what) => `zmienił opis produktu ${what}`,
  "settings.update": () => "zmienił ustawienia sklepu",
  "auth.login": () => "zalogował się",
  "auth.logout": () => "wylogował się",
  "auth.demo_login": () => "wszedł do panelu w trybie demonstracyjnym",
  "demo.reset": () => "przywrócił dane demonstracyjne",
  "demo.history": () => "wygenerował historię zamówień i ruchu (dane demonstracyjne)",
  "orders.retention_purge": () => "zanonimizował dane osobowe starych zamówień",
};

/** Opis jednej serii wpisow (n >= 1). */
export function describe(
  e: AuditLike,
  n: number,
  d: Dictionaries,
): { text: string; href: string | null } {
  const s = subject(e, d);
  const verb = VERB[e.action];
  if (verb) return { text: verb(n, s.name), href: s.href };
  const label = (ACTION_LABEL[e.action] ?? e.action).toLowerCase();
  return {
    text: n > 1 ? `${label}: ${n} ${pluralize(n, ENTRY)}` : `${label}: ${s.name}`,
    href: s.href,
  };
}

/** Grupuje wpisy (najnowsze pierwsze) w serie i opisuje je. */
export function humanize(entries: readonly AuditLike[], d: Dictionaries, limit = 10): HumanEntry[] {
  const out: HumanEntry[] = [];
  let i = 0;
  while (i < entries.length && out.length < limit) {
    const head = entries[i] as AuditLike;
    let j = i + 1;
    while (j < entries.length) {
      const next = entries[j] as AuditLike;
      const prev = entries[j - 1] as AuditLike;
      const sameSeries =
        next.action === head.action &&
        next.actor_id === head.actor_id &&
        Date.parse(prev.at) - Date.parse(next.at) <= SERIES_GAP_MS;
      if (!sameSeries) break;
      j += 1;
    }
    const n = j - i;
    const last = entries[j - 1] as AuditLike;
    const { text, href } = describe(head, n, d);
    out.push({
      key: head.id,
      kind: kindOf(head.action, head.entity),
      actor: head.actor_label ?? ROLE_ACTOR[head.actor_role] ?? head.actor_role,
      text,
      href: n > 1 && head.entity === "media" ? "/media" : href,
      at: head.at,
      firstAt: last.at,
      count: n,
    });
    i = j;
  }
  return out;
}
