"use client";
// F-201, F-202, F-203: odczyt magazynow konta w komponentach (useSyncExternalStore, spojny miedzy kartami).
import { useSyncExternalStore } from "react";
import { ordersStore, type StoredOrderRef } from "./orders";
import { setsStore, type SavedSet } from "./sets";

export function useSavedSets(): readonly SavedSet[] {
  return useSyncExternalStore(
    setsStore.subscribe,
    () => setsStore.get().sets,
    () => setsStore.getServer().sets,
  );
}

export function useStoredOrders(): readonly StoredOrderRef[] {
  return useSyncExternalStore(
    ordersStore.subscribe,
    () => ordersStore.get().orders,
    () => ordersStore.getServer().orders,
  );
}

export { useHydrated } from "./persisted-store";
