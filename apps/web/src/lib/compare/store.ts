"use client";
// F-130 (docs/02 §1.2 `taktyl.compare.v1`): porownanie = kategoria + do 4 ID produktow jednej kategorii.
// Wynik dodania jest jawny (added / exists / full / other_category), zeby UI pokazalo komunikat z propozycja wyczyszczenia.
import { useSyncExternalStore } from "react";
import { createPersistedStore } from "../account/persisted-store";

export const COMPARE_KEY = "taktyl.compare.v1";
export const COMPARE_MAX = 4;
const ID = /^[a-z0-9-]{2,60}$/;

export interface CompareState {
  v: 1;
  category: string | null;
  ids: readonly string[];
}
const EMPTY: CompareState = { v: 1, category: null, ids: [] };

function parse(raw: unknown): CompareState {
  if (!raw || typeof raw !== "object") return EMPTY;
  const o = raw as { category?: unknown; ids?: unknown };
  if (typeof o.category !== "string" || !Array.isArray(o.ids)) return EMPTY;
  const ids = [...new Set(o.ids.filter((s): s is string => typeof s === "string" && ID.test(s)))];
  if (ids.length === 0) return EMPTY;
  return { v: 1, category: o.category, ids: ids.slice(0, COMPARE_MAX) };
}

export const compareStore = createPersistedStore(COMPARE_KEY, parse, EMPTY);

export type CompareAddResult =
  | { status: "added"; count: number }
  | { status: "exists" }
  | { status: "full" }
  | { status: "other_category"; current: string };

export const compare = {
  state: (): CompareState => compareStore.get(),
  add(id: string, category: string): CompareAddResult {
    const cur = compareStore.get();
    if (!ID.test(id)) return { status: "full" };
    if (cur.category !== null && cur.category !== category) {
      return { status: "other_category", current: cur.category };
    }
    if (cur.ids.includes(id)) return { status: "exists" };
    if (cur.ids.length >= COMPARE_MAX) return { status: "full" };
    const ids = [...cur.ids, id];
    compareStore.set({ v: 1, category, ids });
    return { status: "added", count: ids.length };
  },
  remove(id: string): void {
    const cur = compareStore.get();
    const ids = cur.ids.filter((x) => x !== id);
    if (ids.length === cur.ids.length) return;
    compareStore.set(ids.length === 0 ? EMPTY : { v: 1, category: cur.category, ids });
  },
  clear(): void {
    compareStore.set(EMPTY);
  },
  /** Zastepuje porownanie jednym produktem (po zgodzie na wyczyszczenie przy innej kategorii). */
  replaceWith(id: string, category: string): void {
    compareStore.set({ v: 1, category, ids: [id] });
  },
};

export function useCompareState(): CompareState {
  return useSyncExternalStore(compareStore.subscribe, compareStore.get, compareStore.getServer);
}

export function useIsCompared(id: string): boolean {
  return useCompareState().ids.includes(id);
}

/** Nazwa kategorii w komunikatach ("W porownaniu sa klawiatury"). */
export const CATEGORY_PLURAL: Record<string, string> = {
  klawiatury: "klawiatury",
  myszki: "myszki",
  podkladki: "podkładki",
};
