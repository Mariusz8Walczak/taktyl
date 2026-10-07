"use client";
// F-130, F-132, F-201, F-203 (docs/02 §1.2): maly magazyn stanu w localStorage dla `useSyncExternalStore`.
// Odczyt i zapis przez safe-storage (try/catch, zapas w pamieci; docs/11 pulapka 10). Zmiana w innej karcie
// przychodzi zdarzeniem `storage`, zmiana w tej karcie przez wlasny nasluch, wiec stan jest spojny w calym serwisie.
import { useSyncExternalStore } from "react";
import { readItem, writeItem } from "../storage/safe-storage";

export interface PersistedStore<T> {
  /** Biezacy stan (ta sama referencja, dopoki zapisany tekst sie nie zmieni). */
  get: () => T;
  /** Stan dla renderowania serwerowego i pierwszego malowania po stronie klienta. */
  getServer: () => T;
  set: (value: T) => void;
  subscribe: (listener: () => void) => () => void;
}

export function createPersistedStore<T>(
  key: string,
  parse: (raw: unknown) => T,
  empty: T,
): PersistedStore<T> {
  let rawCache: string | null | undefined;
  let valueCache: T = empty;
  const listeners = new Set<() => void>();
  let attached = false;

  const onStorage = (e: StorageEvent) => {
    if (e.key === key || e.key === null) listeners.forEach((l) => l());
  };

  const get = (): T => {
    const raw = readItem("local", key);
    if (raw === rawCache) return valueCache;
    rawCache = raw;
    if (raw === null) {
      valueCache = empty;
    } else {
      try {
        valueCache = parse(JSON.parse(raw));
      } catch {
        valueCache = empty;
      }
    }
    return valueCache;
  };

  return {
    get,
    getServer: () => empty,
    set(value) {
      writeItem("local", key, JSON.stringify(value));
      listeners.forEach((l) => l());
    },
    subscribe(listener) {
      listeners.add(listener);
      if (!attached && typeof window !== "undefined") {
        window.addEventListener("storage", onStorage);
        attached = true;
      }
      return () => {
        listeners.delete(listener);
        if (listeners.size === 0 && attached) {
          window.removeEventListener("storage", onStorage);
          attached = false;
        }
      };
    },
  };
}

/** Prawda dopiero po hydratacji: strony z danymi z przegladarki pokazuja do tego czasu stan wczytywania. */
const noopSubscribe = () => () => {};
export const hydratedSnapshot = {
  client: () => true,
  server: () => false,
  subscribe: noopSubscribe,
};

export function useHydrated(): boolean {
  return useSyncExternalStore(
    hydratedSnapshot.subscribe,
    hydratedSnapshot.client,
    hydratedSnapshot.server,
  );
}
