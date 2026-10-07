"use client";
// F-045, F-132, A-10 (docs/02 §1.2 `taktyl.wishlist.v1`): ulubione = lista SKU w localStorage. Jeden magazyn dla
// serca na karcie listingu, na karcie produktu i dla strony /ulubione, wiec stan jest spojny w calym serwisie.
import { useSyncExternalStore } from "react";
import { createPersistedStore } from "../account/persisted-store";

export const WISHLIST_KEY = "taktyl.wishlist.v1";
export const WISHLIST_MAX = 60;
const SKU = /^[A-Za-z0-9-]{3,40}$/;

export interface WishlistState {
  v: 1;
  skus: readonly string[];
}
const EMPTY: WishlistState = { v: 1, skus: [] };

function parse(raw: unknown): WishlistState {
  const list = raw && typeof raw === "object" ? (raw as { skus?: unknown }).skus : null;
  if (!Array.isArray(list)) return EMPTY;
  const skus = [...new Set(list.filter((s): s is string => typeof s === "string" && SKU.test(s)))];
  return { v: 1, skus: skus.slice(0, WISHLIST_MAX) };
}

export const wishlistStore = createPersistedStore(WISHLIST_KEY, parse, EMPTY);

export const wishlist = {
  skus: (): readonly string[] => wishlistStore.get().skus,
  /** Dodaje SKU na koniec; false, gdy juz jest albo lista jest pelna. */
  add(sku: string): boolean {
    const cur = wishlistStore.get().skus;
    if (cur.includes(sku) || cur.length >= WISHLIST_MAX || !SKU.test(sku)) return false;
    wishlistStore.set({ v: 1, skus: [...cur, sku] });
    return true;
  },
  /** Usuwa wszystkie podane SKU (np. wszystkie warianty jednego modelu). */
  remove(skus: readonly string[]): void {
    const cur = wishlistStore.get().skus;
    const next = cur.filter((s) => !skus.includes(s));
    if (next.length !== cur.length) wishlistStore.set({ v: 1, skus: next });
  },
};

export function useWishlistSkus(): readonly string[] {
  return useSyncExternalStore(
    wishlistStore.subscribe,
    () => wishlistStore.get().skus,
    () => wishlistStore.getServer().skus,
  );
}

/** Serce jest wcisniete, gdy na liscie jest ktorykolwiek wariant modelu (karta pokazuje wariant domyslny, strona wybrany). */
export function useIsFavorite(productSkus: readonly string[]): boolean {
  const skus = useWishlistSkus();
  return productSkus.some((s) => skus.includes(s));
}
