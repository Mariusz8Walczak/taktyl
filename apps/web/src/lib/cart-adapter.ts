// F-066, F-150 (ADR-0007, docs/03 §7): cienki adapter koszyka dla karty produktu. Pelna logike koszyka (szuflada,
// ilosci, grupy setow, wycena `POST /cart/quote`) robi TAKTYL-39 i ona zastapi cialo `addToCart`; sygnatura zostaje.
// TODO(TAKTYL-39): zastapic zapis w localStorage wspolnym modulem koszyka i otworzyc szuflade (A-03).
// Do tego czasu adapter zapisuje MINIMALNY format z docs/03 §7 w `taktyl.cart.v1`: `{ lines: [{ type: "item", sku,
// qty }], code: null }`. Ceny NIE sa zapisywane (docs/11 pulapka 20). Odczyt i zapis w try/catch z zapasem w pamieci.
import { CART_CHANGED_EVENT, CART_STORAGE_KEY } from "./cart/count";
import { readItem, writeItem } from "./storage/safe-storage";

export interface AddToCartInput {
  sku: string;
  qty: number;
}

export interface AddToCartResult {
  /** true dopiero po zapisaniu pozycji; toast "Dodano do koszyka" i zdarzenie `add_to_cart` tylko wtedy. */
  ok: boolean;
}

/** Maks. ilosc jednej pozycji w koszyku (contracts: qtySchema 1-10). */
const MAX_QTY = 10;

interface StoredLine {
  type?: unknown;
  sku?: unknown;
  qty?: unknown;
  [key: string]: unknown;
}

function readLines(): { lines: StoredLine[]; rest: Record<string, unknown> } {
  try {
    const parsed: unknown = JSON.parse(readItem("local", CART_STORAGE_KEY) ?? "null");
    if (Array.isArray(parsed)) return { lines: parsed as StoredLine[], rest: {} };
    if (parsed && typeof parsed === "object") {
      const { lines, ...rest } = parsed as Record<string, unknown>;
      return { lines: Array.isArray(lines) ? (lines as StoredLine[]) : [], rest };
    }
  } catch {
    /* uszkodzony zapis: zaczynamy od pustego koszyka */
  }
  return { lines: [], rest: { code: null } };
}

export async function addToCart({ sku, qty }: AddToCartInput): Promise<AddToCartResult> {
  if (typeof window === "undefined" || !Number.isInteger(qty) || qty < 1) return { ok: false };
  try {
    const { lines, rest } = readLines();
    const existing = lines.find((l) => l.type === "item" && l.sku === sku);
    if (existing) {
      existing.qty = Math.min(MAX_QTY, (typeof existing.qty === "number" ? existing.qty : 0) + qty);
    } else {
      lines.push({ type: "item", sku, qty: Math.min(MAX_QTY, qty) });
    }
    writeItem("local", CART_STORAGE_KEY, JSON.stringify({ ...rest, lines }));
    window.dispatchEvent(new Event(CART_CHANGED_EVENT));
    return { ok: true };
  } catch {
    return { ok: false };
  }
}
