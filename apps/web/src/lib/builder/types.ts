// F-100, F-108 (docs/03 §2, §8): typy stanu kreatora setu. Stan to czyste dane; zadnej logiki DOM.
import type { CategoryId } from "@taktyl/domain";

export type StepId = "do-czego" | "klawiatura" | "myszka" | "podkladka" | "podsumowanie";
export const STEPS: readonly StepId[] = [
  "do-czego",
  "klawiatura",
  "myszka",
  "podkladka",
  "podsumowanie",
];

export type SlotKey = "k" | "m" | "p";
export const SLOTS: readonly SlotKey[] = ["k", "m", "p"];
export const SLOT_CATEGORY: Record<SlotKey, CategoryId> = {
  k: "klawiatury",
  m: "myszki",
  p: "podkladki",
};
export const CATEGORY_SLOT: Record<CategoryId, SlotKey> = {
  klawiatury: "k",
  myszki: "m",
  podkladki: "p",
};
export const SLOT_STEP: Record<SlotKey, StepId> = {
  k: "klawiatura",
  m: "myszka",
  p: "podkladka",
};
export const STEP_SLOT: Partial<Record<StepId, SlotKey>> = {
  klawiatura: "k",
  myszka: "m",
  podkladka: "p",
};
/** Wartosci parametru `step` w set_step_complete (docs/10). */
export const SLOT_TRACK_STEP = { k: "klawiatura", m: "myszka", p: "podkladka" } as const;

/** Nazwy kategorii w liczbie pojedynczej (komunikaty, przyciski). */
export const SLOT_LABEL: Record<SlotKey, { nom: string; acc: string }> = {
  k: { nom: "klawiatura", acc: "klawiaturę" },
  m: { nom: "myszka", acc: "myszkę" },
  p: { nom: "podkładka", acc: "podkładkę" },
};

export const STEP_LABEL: Record<StepId, string> = {
  "do-czego": "Do czego?",
  klawiatura: "Klawiatura",
  myszka: "Myszka",
  podkladka: "Podkładka",
  podsumowanie: "Podsumowanie",
};

/** taktyl.set.v1 (docs/03 §8) rozszerzony o presetId (nie trafia do adresu). */
export interface SetState {
  profile: string | null;
  handCm: number | null;
  k: string | null;
  m: string | null;
  p: string | null;
  step: StepId;
  switchByUser: boolean;
  presetId: string | null;
  /** Id grupy setu w koszyku edytowanej w kreatorze (`?edytuj=`, TAKTYL-39); zapis ja zastepuje. */
  editId: string | null;
}

export const EMPTY_STATE: SetState = {
  profile: null,
  handCm: null,
  k: null,
  m: null,
  p: null,
  step: "do-czego",
  switchByUser: false,
  presetId: null,
  editId: null,
};

export const HAND_MIN_CM = 12;
export const HAND_MAX_CM = 25;
export const HAND_STEP_CM = 0.5;

export const SET_STORAGE_KEY = "taktyl.set.v1";
export const START_SESSION_KEY = "taktyl.set.start.v1";

export function slotCount(s: Pick<SetState, SlotKey>): number {
  return SLOTS.filter((k) => s[k] !== null).length;
}
