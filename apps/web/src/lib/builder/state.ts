// F-108, F-112, F-100 (docs/03 §1, §8): stan kreatora <-> adres (?profil=&dlon=&k=&m=&p=&krok=) i taktyl.set.v1.
// Czyste funkcje; odczyt i zapis storage przez safe-storage (try/catch, zapas w pamieci, docs/11 pulapka 10).
import type { EntryPoint } from "../track-events";
import { readItem, writeItem } from "../storage/safe-storage";
import type { BuilderModel } from "./catalog";
import {
  EMPTY_STATE,
  HAND_MAX_CM,
  HAND_MIN_CM,
  SET_STORAGE_KEY,
  SLOT_CATEGORY,
  SLOT_LABEL,
  SLOT_STEP,
  SLOTS,
  STEPS,
  slotCount,
  type SetState,
  type SlotKey,
  type StepId,
} from "./types";

const ENTRY_POINTS: readonly EntryPoint[] = [
  "hero",
  "nav",
  "pdp",
  "pdp_complete",
  "preset",
  "share_link",
  "guide",
  "account",
];

export interface ParsedUrl {
  state: SetState;
  entry: EntryPoint;
  /** Komunikaty o pominietych pozycjach: "Czesc setu jest juz niedostepna: ...". */
  notices: string[];
  /** Czy adres przynosi jakikolwiek wybor (profil, dlon, SKU albo preset). */
  hasSet: boolean;
}

function parseHand(raw: string | null): number | null {
  if (raw === null || !/^\d{2}(?:\.\d)?$/.test(raw)) return null;
  const n = Number(raw);
  return n >= HAND_MIN_CM && n <= HAND_MAX_CM ? n : null;
}

/** Pierwszy pusty krok produktu; komplet = podsumowanie (docs/03 §1: "na nastepnym pustym kroku"). */
export function firstEmptyStep(s: Pick<SetState, SlotKey>): StepId {
  const empty = SLOTS.find((k) => s[k] === null);
  return empty ? SLOT_STEP[empty] : "podsumowanie";
}

export function missingNotice(slots: readonly SlotKey[]): string {
  const names = slots.map((s) => SLOT_LABEL[s].nom).join(", ");
  return `Część setu jest już niedostępna: ${names}. Wybierz zamiennik.`;
}

/** F-108: odtwarza stan z adresu; nieznany SKU jest pomijany z komunikatem (docs/03 §8). */
export function parseSearch(search: string | URLSearchParams, model: BuilderModel): ParsedUrl {
  const sp = typeof search === "string" ? new URLSearchParams(search) : search;
  const state: SetState = { ...EMPTY_STATE };
  const missing: SlotKey[] = [];

  const profile = sp.get("profil");
  if (profile !== null && model.rules.profiles[profile]) state.profile = profile;
  state.handCm = parseHand(sp.get("dlon"));

  const presetId = sp.get("preset");
  const preset = presetId === null ? undefined : model.presets.find((p) => p.id === presetId);
  let fromPreset = false;
  if (preset) {
    fromPreset = true;
    state.presetId = preset.id;
    state.profile = preset.profile;
    for (const sku of preset.skus) {
      const found = model.bySku.get(sku);
      if (!found) continue;
      const slot = SLOTS.find((s) => SLOT_CATEGORY[s] === found.product.category);
      if (slot) state[slot] = sku;
    }
    for (const slot of SLOTS) if (state[slot] === null) missing.push(slot);
  } else {
    for (const slot of SLOTS) {
      const sku = sp.get(slot);
      if (sku === null || sku === "") continue;
      const found = model.bySku.get(sku);
      if (found && found.product.category === SLOT_CATEGORY[slot]) state[slot] = sku;
      else missing.push(slot);
    }
  }

  const edit = sp.get("edytuj");
  if (edit !== null && /^[\w-]{1,64}$/.test(edit)) state.editId = edit;

  const hasSet = ["profil", "dlon", "k", "m", "p", "preset"].some((n) => sp.has(n));
  const krok = sp.get("krok");
  if (krok !== null && (STEPS as readonly string[]).includes(krok)) {
    state.step = krok as StepId;
  } else if (fromPreset) {
    state.step = "podsumowanie";
  } else if (slotCount(state) > 0) {
    state.step = firstEmptyStep(state);
  } else if (state.profile !== null) {
    state.step = "klawiatura";
  }

  const wejscie = sp.get("wejscie");
  const count = slotCount(state);
  let entry: EntryPoint;
  if (wejscie !== null && (ENTRY_POINTS as readonly string[]).includes(wejscie)) {
    entry = wejscie as EntryPoint;
  } else if (fromPreset) {
    entry = "preset";
  } else if (count >= 2 || (count >= 1 && state.profile !== null)) {
    entry = "share_link";
  } else if (count === 1) {
    entry = "pdp";
  } else if (state.profile !== null) {
    entry = "guide";
  } else {
    entry = "nav";
  }

  return { state, entry, notices: missing.length > 0 ? [missingNotice(missing)] : [], hasSet };
}

/** F-108: parametry adresu; krok zawsze, gdy cos wybrano (link do setu odtwarza ten sam krok, S21). */
export function toSearchParams(s: SetState): URLSearchParams {
  const sp = new URLSearchParams();
  if (s.profile !== null) sp.set("profil", s.profile);
  if (s.handCm !== null) sp.set("dlon", String(s.handCm));
  for (const slot of SLOTS) {
    const sku = s[slot];
    if (sku !== null) sp.set(slot, sku);
  }
  if (s.step !== "do-czego" || sp.size > 0) sp.set("krok", s.step);
  if (s.editId !== null) sp.set("edytuj", s.editId);
  return sp;
}

export function sameSelection(a: SetState, b: SetState): boolean {
  return (
    a.profile === b.profile && a.handCm === b.handCm && a.k === b.k && a.m === b.m && a.p === b.p
  );
}

export function hasContent(s: SetState): boolean {
  return s.profile !== null || s.handCm !== null || slotCount(s) > 0;
}

// ---- taktyl.set.v1 ----

export interface StoredSet {
  state: SetState;
  updatedAt: string;
}

function str(v: unknown): string | null {
  return typeof v === "string" && v !== "" ? v : null;
}

export function readStored(): StoredSet | null {
  try {
    const raw: unknown = JSON.parse(readItem("local", SET_STORAGE_KEY) ?? "null");
    if (!raw || typeof raw !== "object") return null;
    const o = raw as Record<string, unknown>;
    const step = STEPS.find((x) => x === o.step) ?? "do-czego";
    const hand = typeof o.hand_cm === "number" ? o.hand_cm : null;
    const state: SetState = {
      profile: str(o.profile),
      handCm: hand !== null && hand >= HAND_MIN_CM && hand <= HAND_MAX_CM ? hand : null,
      k: str(o.k),
      m: str(o.m),
      p: str(o.p),
      step,
      switchByUser: o.switch_set_by_user === true,
      presetId: str(o.preset_id),
      editId: null,
    };
    return { state, updatedAt: str(o.updated_at) ?? new Date(0).toISOString() };
  } catch {
    return null; // uszkodzony zapis nie psuje kreatora
  }
}

export function writeStored(s: SetState, now: Date = new Date()): void {
  try {
    writeItem(
      "local",
      SET_STORAGE_KEY,
      JSON.stringify({
        profile: s.profile,
        hand_cm: s.handCm,
        k: s.k,
        m: s.m,
        p: s.p,
        switch_set_by_user: s.switchByUser,
        step: s.step,
        preset_id: s.presetId,
        updated_at: now.toISOString(),
      }),
    );
  } catch {
    /* zapis jest dodatkiem */
  }
}

/** Data niedokonczonego setu po polsku, w strefie Europe/Warsaw (regula 7). */
export function formatStoredDate(iso: string): string {
  return new Intl.DateTimeFormat("pl-PL", { dateStyle: "long", timeZone: "Europe/Warsaw" }).format(
    new Date(iso),
  );
}
