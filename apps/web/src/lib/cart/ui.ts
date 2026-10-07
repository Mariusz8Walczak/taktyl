"use client";
// F-150, A-03: stan interfejsu koszyka (szuflada otwarta, chwilowe "Dodano" przycisku). Osobny, maly modul: laduje sie
// w ukladzie na kazdej stronie (CartDrawerHost), wiec nie wciaga logiki koszyka ani wyceny (budzet JS, docs/12 §4).
import { useEffect, useState, useSyncExternalStore } from "react";

interface UiState {
  open: boolean;
  /** Znacznik czasu ostatniego dodania (ms), do chwilowej etykiety "Dodano". */
  addedAt: number;
}
let ui: UiState = { open: false, addedAt: 0 };
const uiListeners = new Set<() => void>();
const setUi = (patch: Partial<UiState>) => {
  ui = { ...ui, ...patch };
  uiListeners.forEach((l) => l());
};
const subscribeUi = (cb: () => void) => {
  uiListeners.add(cb);
  return () => void uiListeners.delete(cb);
};

export const cartUi = {
  open: () => setUi({ open: true }),
  close: () => setUi({ open: false }),
  markAdded: () => setUi({ addedAt: Date.now() }),
  get: () => ui,
  reset: () => {
    ui = { open: false, addedAt: 0 };
    uiListeners.forEach((l) => l());
  },
};

export function useCartDrawerOpen(): boolean {
  return useSyncExternalStore(
    subscribeUi,
    () => ui.open,
    () => false,
  );
}

/** Etykieta "Dodano" (A-03) przez 1,2 s po dodaniu, bez zmiany sygnatury `addToCart`. */
export const ADDED_LABEL_MS = 1200;
export function useRecentlyAdded(ms: number = ADDED_LABEL_MS): boolean {
  const addedAt = useSyncExternalStore(
    subscribeUi,
    () => ui.addedAt,
    () => 0,
  );
  return useAddedWindow(addedAt, ms);
}

function useAddedWindow(addedAt: number, ms: number): boolean {
  const [now, setNow] = useState(0);
  useEffect(() => {
    if (!addedAt) return undefined;
    setNow(Date.now());
    const t = setTimeout(() => setNow(addedAt + ms), Math.max(0, addedAt + ms - Date.now()));
    return () => clearTimeout(t);
  }, [addedAt, ms]);
  return addedAt > 0 && now > 0 && now < addedAt + ms;
}
