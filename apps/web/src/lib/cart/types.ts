// F-150, F-154 (ADR-0007, docs/03 §7): format koszyka w przegladarce. BEZ CEN (docs/11 pulapka 20): ceny przychodza
// z `POST /cart/quote` przy kazdym wyswietleniu. Typy odpowiedzi API sa tylko typami (import type), zod nie wchodzi do paczki.
import type { QuoteResponse } from "@taktyl/contracts";

export const CART_VERSION = 1;
/** Ilosc pozycji (contracts: qtySchema 1-10) i grupy setu (docs/03 §7: 1-5). */
export const MAX_ITEM_QTY = 10;
export const MAX_SET_QTY = 5;
export const SET_SIZE = 3;

export interface CartItemLine {
  type: "item";
  sku: string;
  qty: number;
}

export interface CartSetLine {
  type: "set";
  id: string;
  qty: number;
  name: string;
  preset_id: string | null;
  profile: string | null;
  items: { sku: string }[];
}

export type CartLine = CartItemLine | CartSetLine;

export interface CartState {
  v: typeof CART_VERSION;
  lines: CartLine[];
  /** Kod rabatowy wpisany przez klienta (wielkie litery); wynik oceny daje quote. */
  code: string | null;
}

export type Quote = QuoteResponse;
export type QuoteLineOf<T extends "item" | "set"> = Extract<Quote["lines"][number], { type: T }>;

export const EMPTY_CART: CartState = Object.freeze({
  v: CART_VERSION,
  lines: [],
  code: null,
}) as CartState;

/** Klucz pozycji: SKU dla pozycji, id dla grupy setu. */
export const lineKey = (l: CartLine): string => (l.type === "item" ? l.sku : l.id);

export type CategoryId = "klawiatury" | "myszki" | "podkladki";

/** Kategoria z prefiksu SKU (docs/04 §3.1): K, M, P. */
export function categoryOfSku(sku: string): CategoryId {
  return sku.startsWith("K") ? "klawiatury" : sku.startsWith("M") ? "myszki" : "podkladki";
}

/** Parametr kreatora dla kategorii (docs/03 §8). */
export const BUILDER_PARAM = { klawiatury: "k", myszki: "m", podkladki: "p" } as const;
export const BUILDER_STEP = {
  klawiatury: "klawiatura",
  myszki: "myszka",
  podkladki: "podkladka",
} as const;
