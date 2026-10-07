// F-002 (ADR-0007): licznik koszyka z `taktyl.cart.v1`. TYLKO odczyt liczby sztuk (set = 1); logika koszyka
// (dodawanie, ilosci, wycena) przychodzi w TAKTYL-39. Format: tablica pozycji albo obiekt z polem `lines`/`items`,
// pozycja `{ type: "item" | "set", qty }` zgodnie z contracts/public/cart.ts. Nic nieczytelnego nie zrywa strony.
import { useSyncExternalStore } from "react";
import { readItem } from "../storage/safe-storage";

export const CART_STORAGE_KEY = "taktyl.cart.v1";
/** Zdarzenie na `window` dla zmian w tej samej karcie (zdarzenie `storage` przychodzi tylko z innych kart). */
export const CART_CHANGED_EVENT = "taktyl:cart-changed";

/** Liczba sztuk w koszyku; pozycja `set` (3 produkty w grupie) liczy sie jako `qty` setow, nie 3. */
export function parseCartCount(raw: string | null): number {
  if (!raw) return 0;
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return 0;
  }
  const lines = Array.isArray(data)
    ? data
    : data && typeof data === "object"
      ? ((data as Record<string, unknown>).lines ?? (data as Record<string, unknown>).items)
      : null;
  if (!Array.isArray(lines)) return 0;
  let total = 0;
  for (const line of lines) {
    const qty =
      line && typeof line === "object" ? (line as Record<string, unknown>).qty : undefined;
    if (typeof qty === "number" && Number.isInteger(qty) && qty > 0) total += qty;
  }
  return total;
}

function subscribe(onChange: () => void): () => void {
  const onStorage = (e: StorageEvent) => {
    if (e.key === null || e.key === CART_STORAGE_KEY) onChange();
  };
  window.addEventListener("storage", onStorage);
  window.addEventListener(CART_CHANGED_EVENT, onChange);
  return () => {
    window.removeEventListener("storage", onStorage);
    window.removeEventListener(CART_CHANGED_EVENT, onChange);
  };
}

const getSnapshot = () => parseCartCount(readItem("local", CART_STORAGE_KEY));
const getServerSnapshot = () => 0;

/** Licznik na ikonie koszyka. SSR i pierwsze malowanie: 0 (bez liczby), po hydracji wartosc z przegladarki. */
export function useCartCount(): number {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
