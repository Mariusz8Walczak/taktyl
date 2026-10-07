"use client";
// F-150...F-154, F-002 (ADR-0007): magazyn koszyka nad `taktyl.cart.v1` (React useSyncExternalStore). Odczyt i zapis
// przez safe-storage: try/catch i zapas w pamieci, wiec koszyk dziala nawet przy wyjatku localStorage (docs/12 §2).
// Synchronizacja kart: zdarzenie `storage`; ta sama karta: `taktyl:cart-changed` (licznik w naglowku slucha obu).
import { useSyncExternalStore } from "react";
import { readItem, removeItem, writeItem } from "../storage/safe-storage";
import { CART_CHANGED_EVENT, CART_STORAGE_KEY } from "./count";
import * as ops from "./state";
import { EMPTY_CART, type CartState } from "./types";

let cache: { raw: string | null; state: CartState } = { raw: null, state: EMPTY_CART };

/** Biezacy stan; ta sama referencja, dopoki zapis sie nie zmieni (wymog useSyncExternalStore). */
export function getCart(): CartState {
  const raw = readItem("local", CART_STORAGE_KEY);
  if (raw !== cache.raw) cache = { raw, state: ops.parseCart(raw) };
  return cache.state;
}

function commit(next: CartState): void {
  if (next.lines.length === 0 && !next.code) removeItem("local", CART_STORAGE_KEY);
  else writeItem("local", CART_STORAGE_KEY, ops.serializeCart(next));
  if (typeof window !== "undefined") window.dispatchEvent(new Event(CART_CHANGED_EVENT));
}

function update(fn: (s: CartState) => CartState): CartState {
  const prev = getCart();
  const next = fn(prev);
  if (next !== prev) commit(next);
  return next;
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

/** Stan koszyka w komponencie. SSR i pierwsze malowanie: pusty (jak licznik w naglowku), potem odczyt z przegladarki. */
export function useCart(): CartState {
  return useSyncExternalStore(subscribe, getCart, () => EMPTY_CART);
}

/** Operacje na koszyku (czyste reduktory ze state.ts, zapis i powiadomienie tutaj). */
export const cartStore = {
  addItem: (sku: string, qty: number) => update((s) => ops.addItem(s, sku, qty)),
  addSet(input: ops.NewSet): { id: string } | null {
    const res = ops.addSet(getCart(), input);
    if (!res) return null;
    commit(res.state);
    return { id: res.id };
  },
  setQty: (key: string, qty: number) => update((s) => ops.setQty(s, key, qty)),
  remove(key: string): ops.RemovedLine | null {
    const res = ops.removeLine(getCart(), key);
    if (res.removed) commit(res.state);
    return res.removed;
  },
  restore: (removed: ops.RemovedLine) => update((s) => ops.restoreLine(s, removed)),
  removeFromSet(setId: string, sku: string): ops.SplitRecord | null {
    const res = ops.removeFromSet(getCart(), setId, sku);
    if (!res) return null;
    commit(res.state);
    return res.record;
  },
  undoSplit: (rec: ops.SplitRecord) => update((s) => ops.undoSplit(s, rec)),
  clear: () => update(() => ops.clearCart()),
  applyCode: (code: string | null) => update((s) => ops.applyCode(s, code)),
};
