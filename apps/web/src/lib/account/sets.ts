"use client";
// F-114, F-203 (docs/02 §1.2 `taktyl.sets.v1`, docs/03 zapisane sety): zapisane sety = nazwa + SKU + profil + data,
// bez cen (ceny liczy kreator i koszyk z API). Maksymalnie 10. Operacje zwracaja jawny wynik, zeby UI pokazalo komunikat.
import { createPersistedStore } from "./persisted-store";

export const SETS_KEY = "taktyl.sets.v1";
export const SETS_MAX = 10;
export const SET_NAME_MAX = 40;
const SKU = /^[A-Za-z0-9-]{3,40}$/;

export interface SavedSet {
  id: string;
  name: string;
  k: string | null;
  m: string | null;
  p: string | null;
  profile: string | null;
  handCm: number | null;
  at: string;
}
interface SetsState {
  v: 1;
  sets: readonly SavedSet[];
}
const EMPTY: SetsState = { v: 1, sets: [] };

export function cleanSetName(name: unknown): string {
  return typeof name === "string" ? name.replace(/\s+/g, " ").trim().slice(0, SET_NAME_MAX) : "";
}
const sku = (x: unknown): string | null => (typeof x === "string" && SKU.test(x) ? x : null);

export const setsStore = createPersistedStore<SetsState>(
  SETS_KEY,
  (raw) => {
    const list = raw && typeof raw === "object" ? (raw as { sets?: unknown }).sets : null;
    if (!Array.isArray(list)) return EMPTY;
    const sets = list.flatMap((o): SavedSet[] => {
      const x = (o ?? {}) as Record<string, unknown>;
      const name = cleanSetName(x.name);
      const id = typeof x.id === "string" && /^[\w-]{1,64}$/.test(x.id) ? x.id : null;
      if (!name || !id) return [];
      const hand = typeof x.handCm === "number" && Number.isFinite(x.handCm) ? x.handCm : null;
      return [
        {
          id,
          name,
          k: sku(x.k),
          m: sku(x.m),
          p: sku(x.p),
          profile: typeof x.profile === "string" ? x.profile.slice(0, 40) : null,
          handCm: hand,
          at: typeof x.at === "string" ? x.at : "",
        },
      ];
    });
    return { v: 1, sets: sets.slice(0, SETS_MAX) };
  },
  EMPTY,
);

export type SaveSetResult =
  { ok: true; set: SavedSet } | { ok: false; reason: "limit" | "name" | "empty" };

let counter = 0;
function newId(now: number): string {
  counter += 1;
  return `s${now.toString(36)}${counter.toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

export const savedSets = {
  list: (): readonly SavedSet[] => setsStore.get().sets,
  save(
    input: Pick<SavedSet, "k" | "m" | "p" | "profile" | "handCm"> & { name: string },
    now: Date = new Date(),
  ): SaveSetResult {
    const name = cleanSetName(input.name);
    if (!name) return { ok: false, reason: "name" };
    if (!input.k && !input.m && !input.p) return { ok: false, reason: "empty" };
    const cur = setsStore.get().sets;
    if (cur.length >= SETS_MAX) return { ok: false, reason: "limit" };
    const set: SavedSet = {
      id: newId(now.getTime()),
      name,
      k: input.k,
      m: input.m,
      p: input.p,
      profile: input.profile,
      handCm: input.handCm,
      at: now.toISOString(),
    };
    setsStore.set({ v: 1, sets: [set, ...cur] });
    return { ok: true, set };
  },
  rename(id: string, name: string): boolean {
    const clean = cleanSetName(name);
    if (!clean) return false;
    const cur = setsStore.get().sets;
    if (!cur.some((s) => s.id === id)) return false;
    setsStore.set({ v: 1, sets: cur.map((s) => (s.id === id ? { ...s, name: clean } : s)) });
    return true;
  },
  /** Usuwa set; zwraca usuniety set i jego miejsce, zeby "Cofnij" przywrocilo go w tym samym miejscu. */
  remove(id: string): { set: SavedSet; index: number } | null {
    const cur = setsStore.get().sets;
    const index = cur.findIndex((s) => s.id === id);
    const set = cur[index];
    if (!set) return null;
    setsStore.set({ v: 1, sets: cur.filter((s) => s.id !== id) });
    return { set, index };
  },
  restore(set: SavedSet, index: number): boolean {
    const cur = setsStore.get().sets;
    if (cur.length >= SETS_MAX || cur.some((s) => s.id === set.id)) return false;
    const next = [...cur];
    next.splice(Math.min(index, next.length), 0, set);
    setsStore.set({ v: 1, sets: next });
    return true;
  },
};

/** Adres kreatora z zapisanym setem (docs/03 §1; `wejscie=account` daje set_builder_start entry_point `account`). */
export function builderHref(s: SavedSet): string {
  const q = new URLSearchParams();
  if (s.profile) q.set("profil", s.profile);
  if (s.handCm !== null) q.set("dlon", String(s.handCm));
  if (s.k) q.set("k", s.k);
  if (s.m) q.set("m", s.m);
  if (s.p) q.set("p", s.p);
  q.set("wejscie", "account");
  return `/zbuduj-set?${q.toString()}`;
}
