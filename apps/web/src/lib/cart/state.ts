// F-150...F-154 (docs/03 §7): czyste operacje na stanie koszyka (bez I/O, bez Reacta), latwe do przetestowania.
// Kazda operacja zwraca nowy stan; operacje z "Cofnij" zwracaja tez rekord potrzebny do cofniecia.
import {
  CART_VERSION,
  EMPTY_CART,
  MAX_ITEM_QTY,
  MAX_SET_QTY,
  SET_SIZE,
  lineKey,
  type CartItemLine,
  type CartLine,
  type CartSetLine,
  type CartState,
} from "./types";

const SKU_LOOSE = /^[KMP]-[A-Z0-9]+(?:-[A-Z0-9]+){1,3}$/;
const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n));

function validQty(q: unknown, max: number): number | null {
  return typeof q === "number" && Number.isInteger(q) && q >= 1 ? Math.min(q, max) : null;
}

function parseLine(raw: unknown): CartLine | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  if (r.type === "item") {
    const qty = validQty(r.qty, MAX_ITEM_QTY);
    return typeof r.sku === "string" && SKU_LOOSE.test(r.sku) && qty
      ? { type: "item", sku: r.sku, qty }
      : null;
  }
  if (r.type === "set") {
    const qty = validQty(r.qty, MAX_SET_QTY);
    const items = Array.isArray(r.items)
      ? r.items.flatMap((i) => {
          const sku = i && typeof i === "object" ? (i as { sku?: unknown }).sku : undefined;
          return typeof sku === "string" && SKU_LOOSE.test(sku) ? [{ sku }] : [];
        })
      : [];
    if (typeof r.id !== "string" || !r.id || !qty || items.length !== SET_SIZE) return null;
    return {
      type: "set",
      id: r.id.slice(0, 64),
      qty,
      name: typeof r.name === "string" && r.name ? r.name : "Twój set",
      preset_id: typeof r.preset_id === "string" ? r.preset_id : null,
      profile: typeof r.profile === "string" ? r.profile : null,
      items,
    };
  }
  return null;
}

/**
 * Odczyt zapisu z `taktyl.cart.v1`. Przyjmuje: aktualny format `{ v: 1, lines, code }`, format tymczasowego adaptera
 * `{ lines, code }` (bez `v`; migracja: ten sam ksztalt pozycji) i goly zapis tablicowy. Nieznana wersja i uszkodzone
 * pozycje sa odrzucane: nic nieczytelnego nie zrywa strony (docs/11 pulapka 10).
 */
export function parseCart(raw: string | null): CartState {
  if (!raw) return EMPTY_CART;
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return EMPTY_CART;
  }
  const obj =
    data && typeof data === "object" && !Array.isArray(data)
      ? (data as Record<string, unknown>)
      : null;
  if (obj && typeof obj.v === "number" && obj.v !== CART_VERSION) return EMPTY_CART;
  const rawLines = Array.isArray(data) ? data : obj && Array.isArray(obj.lines) ? obj.lines : [];
  const lines = rawLines.flatMap((l: unknown) => {
    const p = parseLine(l);
    return p ? [p] : [];
  });
  const code =
    obj && typeof obj.code === "string" && obj.code.trim() ? obj.code.trim().toUpperCase() : null;
  if (lines.length === 0 && !code) return EMPTY_CART;
  return { v: CART_VERSION, lines, code };
}

export function serializeCart(state: CartState): string {
  return JSON.stringify({ v: CART_VERSION, lines: state.lines, code: state.code });
}

const withLines = (s: CartState, lines: CartLine[]): CartState => ({ ...s, lines });

export function addItem(s: CartState, sku: string, qty: number): CartState {
  if (!Number.isInteger(qty) || qty < 1) return s;
  const i = s.lines.findIndex((l) => l.type === "item" && l.sku === sku);
  if (i >= 0) {
    const cur = s.lines[i] as CartItemLine;
    const next = s.lines.slice();
    next[i] = { ...cur, qty: Math.min(MAX_ITEM_QTY, cur.qty + qty) };
    return withLines(s, next);
  }
  return withLines(s, [...s.lines, { type: "item", sku, qty: Math.min(MAX_ITEM_QTY, qty) }]);
}

export interface NewSet {
  skus: readonly string[];
  profile?: string | null;
  presetId?: string | null;
  name?: string;
  qty?: number;
  /** Edycja (`?edytuj=`): grupa o tym id jest zastapiona w tym samym miejscu, z zachowana iloscia. */
  replaceId?: string;
  /** Do testow: stabilny identyfikator. */
  id?: string;
}

export function addSet(
  s: CartState,
  input: NewSet,
  now: number = Date.now(),
): { state: CartState; id: string } | null {
  const skus = [...input.skus];
  if (skus.length !== SET_SIZE || !skus.every((x) => SKU_LOOSE.test(x))) return null;
  const items = skus.map((sku) => ({ sku }));
  const base = {
    name: input.name?.trim() || "Twój set",
    preset_id: input.presetId ?? null,
    profile: input.profile ?? null,
    items,
  };
  if (input.replaceId) {
    const i = s.lines.findIndex((l) => l.type === "set" && l.id === input.replaceId);
    if (i >= 0) {
      const old = s.lines[i] as CartSetLine;
      const next = s.lines.slice();
      next[i] = { type: "set", id: old.id, qty: old.qty, ...base };
      return { state: withLines(s, next), id: old.id };
    }
  }
  const sorted = [...skus].sort().join("|");
  const same = s.lines.findIndex(
    (l) =>
      l.type === "set" &&
      l.items
        .map((x) => x.sku)
        .sort()
        .join("|") === sorted,
  );
  if (same >= 0) {
    const cur = s.lines[same] as CartSetLine;
    const next = s.lines.slice();
    next[same] = { ...cur, qty: Math.min(MAX_SET_QTY, cur.qty + (input.qty ?? 1)) };
    return { state: withLines(s, next), id: cur.id };
  }
  const id = input.id ?? `set-${now}`;
  const line: CartSetLine = {
    type: "set",
    id,
    qty: clamp(input.qty ?? 1, 1, MAX_SET_QTY),
    ...base,
  };
  return { state: withLines(s, [...s.lines, line]), id };
}

/** Zmiana ilosci: pozycja 1-10, grupa 1-5. */
export function setQty(s: CartState, key: string, qty: number): CartState {
  if (!Number.isInteger(qty)) return s;
  return withLines(
    s,
    s.lines.map((l) =>
      lineKey(l) === key
        ? { ...l, qty: clamp(qty, 1, l.type === "set" ? MAX_SET_QTY : MAX_ITEM_QTY) }
        : l,
    ),
  );
}

export interface RemovedLine {
  line: CartLine;
  index: number;
}

export function removeLine(
  s: CartState,
  key: string,
): { state: CartState; removed: RemovedLine | null } {
  const index = s.lines.findIndex((l) => lineKey(l) === key);
  if (index < 0) return { state: s, removed: null };
  return {
    state: withLines(
      s,
      s.lines.filter((_, i) => i !== index),
    ),
    removed: { line: s.lines[index] as CartLine, index },
  };
}

/** Cofniecie usuniecia pozycji lub grupy: wraca na dawne miejsce (albo dolicza, gdy SKU dodano w miedzyczasie). */
export function restoreLine(s: CartState, removed: RemovedLine): CartState {
  const { line, index } = removed;
  if (line.type === "item") {
    if (s.lines.some((l) => l.type === "item" && l.sku === line.sku))
      return addItem(s, line.sku, line.qty);
  } else if (s.lines.some((l) => l.type === "set" && l.id === line.id)) {
    return s;
  }
  const next = s.lines.slice();
  next.splice(Math.min(index, next.length), 0, line);
  return withLines(s, next);
}

export interface SplitRecord {
  group: CartSetLine;
  index: number;
  /** SKU, ktore weszly do koszyka jako zwykle pozycje (z iloscia grupy). */
  created: string[];
  removedSku: string;
}

/**
 * F-154: usuniecie jednego elementu setu rozbija grupe na zwykle pozycje (z iloscia grupy); usuwany element znika,
 * rabat setu znika razem z grupa.
 */
export function removeFromSet(
  s: CartState,
  setId: string,
  sku: string,
): { state: CartState; record: SplitRecord } | null {
  const index = s.lines.findIndex((l) => l.type === "set" && l.id === setId);
  if (index < 0) return null;
  const group = s.lines[index] as CartSetLine;
  if (!group.items.some((i) => i.sku === sku)) return null;
  const created = group.items.map((i) => i.sku).filter((x) => x !== sku);
  const lines = s.lines.filter((_, i) => i !== index);
  let at = Math.min(index, lines.length);
  for (const c of created) {
    const j = lines.findIndex((l) => l.type === "item" && l.sku === c);
    if (j >= 0) {
      const cur = lines[j] as CartItemLine;
      lines[j] = { ...cur, qty: Math.min(MAX_ITEM_QTY, cur.qty + group.qty) };
    } else {
      lines.splice(at, 0, { type: "item", sku: c, qty: Math.min(MAX_ITEM_QTY, group.qty) });
      at += 1;
    }
  }
  return {
    state: withLines(s, lines),
    record: { group, index, created, removedSku: sku },
  };
}

/** Cofnij rozbicie: pozycje powstale z grupy sa pomniejszane o jej ilosc, grupa wraca na swoje miejsce. */
export function undoSplit(s: CartState, rec: SplitRecord): CartState {
  const lines: CartLine[] = [];
  for (const l of s.lines) {
    if (l.type === "item" && rec.created.includes(l.sku)) {
      const left = l.qty - rec.group.qty;
      if (left >= 1) lines.push({ ...l, qty: left });
    } else lines.push(l);
  }
  lines.splice(Math.min(rec.index, lines.length), 0, rec.group);
  return withLines(s, lines);
}

export function clearCart(): CartState {
  return EMPTY_CART;
}

export function applyCode(s: CartState, code: string | null): CartState {
  const c = code?.trim().toUpperCase() || null;
  return s.code === c ? s : { ...s, code: c };
}

/** Licznik w naglowku: sztuki (set = 1, wiec grupa liczy sie jako jej ilosc). */
export function countUnits(s: CartState): number {
  return s.lines.reduce((n, l) => n + l.qty, 0);
}
