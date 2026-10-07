"use client";
// F-100...F-113, F-108, F-109 (docs/03): stan kreatora setu - wybor, adres (replaceState przy wyborze, pushState przy
// zmianie kroku), taktyl.set.v1, zdarzenia pomiaru (docs/10) i dodanie grupy setu do koszyka.
// Zdarzenia leca z akcji uzytkownika (nie z efektow), wiec nie dubluja sie w StrictMode ani przy wczytaniu adresu.
import type { Suggestion } from "@taktyl/domain";
import { useToast } from "@taktyl/ui";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { addSet } from "../../lib/cart-adapter";
import { readItem, writeItem } from "../../lib/storage/safe-storage";
import { track } from "../../lib/track";
import { buildSetItems, grToZl, itemsDiscount, itemsValue } from "../../lib/track-items";
import {
  entryOf,
  variantText,
  type BuilderModel,
  type BuilderProduct,
} from "../../lib/builder/catalog";
import { analyze, type Analysis, type PadKind } from "../../lib/builder/fit";
import { pickVariant, retargetSwitch } from "../../lib/builder/select";
import {
  formatStoredDate,
  hasContent,
  parseSearch,
  readStored,
  sameSelection,
  toSearchParams,
  writeStored,
} from "../../lib/builder/state";
import {
  CATEGORY_SLOT,
  SLOT_TRACK_STEP,
  SLOTS,
  START_SESSION_KEY,
  STEPS,
  slotCount,
  type SetState,
  type SlotKey,
  type StepId,
} from "../../lib/builder/types";

export const headingId = (step: StepId): string => `kreator-naglowek-${step}`;

export interface PendingSet {
  state: SetState;
  /** "7 października 2026" */
  dateLabel: string;
}

export interface BuilderApi {
  model: BuilderModel;
  state: SetState;
  analysis: Analysis;
  padKind: PadKind;
  setPadKind: (k: PadKind) => void;
  notices: string[];
  pending: PendingSet | null;
  /** Komunikat statusu (np. "Link skopiowany"). */
  message: string | null;
  /** Pole z zaznaczonym linkiem, gdy schowek jest niedostepny (F-109). */
  fallbackLink: string | null;
  busy: boolean;
  justCompleted: boolean;
  clearCompleted: () => void;
  setProfile: (id: string) => void;
  skipProfile: () => void;
  setHand: (cm: number | null) => void;
  selectProduct: (slot: SlotKey, product: BuilderProduct) => void;
  selectVariant: (slot: SlotKey, sku: string, dim: "color" | "switch" | "size") => void;
  applySuggestion: (s: Suggestion) => void;
  goStep: (step: StepId) => void;
  next: () => void;
  loadPreset: (id: string) => void;
  loadPending: () => void;
  dismissPending: () => void;
  copyLink: () => Promise<void>;
  addToCart: () => Promise<void>;
}

type UrlMode = "replace" | "push";

/** Zmiana SKU zdejmuje znacznik gotowego setu (preset_id w koszyku tylko dla niezmienionego skladu). */
function withSelection(prev: SetState, patch: Partial<SetState>): SetState {
  const next = { ...prev, ...patch };
  const changed = SLOTS.some((s) => next[s] !== prev[s]);
  return changed ? { ...next, presetId: null } : next;
}

function writeUrl(s: SetState, mode: UrlMode): void {
  try {
    const url = new URL(window.location.href);
    url.search = toSearchParams(s).toString();
    if (mode === "push") window.history.pushState(window.history.state, "", url);
    else window.history.replaceState(window.history.state, "", url);
  } catch {
    /* adres jest dodatkiem, kreator dziala bez niego */
  }
}

export function useBuilder(model: BuilderModel, initialSearch: string): BuilderApi {
  const initial = useMemo(() => parseSearch(initialSearch, model), [initialSearch, model]);
  const [state, setStateRaw] = useState<SetState>(initial.state);
  const stateRef = useRef<SetState>(initial.state);
  const [notices, setNotices] = useState<string[]>(initial.notices);
  const [pending, setPending] = useState<PendingSet | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [fallbackLink, setFallbackLink] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [justCompleted, setJustCompleted] = useState(false);
  const [padKind, setPadKind] = useState<PadKind>(() => {
    const p = entryOf(model, initial.state.p);
    return p?.product.attributes.sizes?.[p.variant.size ?? ""]?.type ?? "biurko";
  });
  const focusRequested = useRef(false);
  const { toast } = useToast();

  const analysis = useMemo(() => analyze(model, state), [model, state]);

  const setState = useCallback((next: SetState) => {
    stateRef.current = next;
    setStateRaw(next);
  }, []);

  /** Wspolny zapis zmiany: stan, adres, taktyl.set.v1 i zdarzenia wynikajace z roznicy (fit_warning, set_complete). */
  const commit = useCallback(
    (next: SetState, mode: UrlMode, opts: { silent?: boolean } = {}) => {
      const prev = stateRef.current;
      setState(next);
      writeUrl(next, mode);
      writeStored(next);
      const nextPad = entryOf(model, next.p);
      const padType = nextPad?.product.attributes.sizes?.[nextPad.variant.size ?? ""]?.type;
      if (padType && next.p !== prev.p) setPadKind(padType);
      if (slotCount(next) < 3) setJustCompleted(false);
      if (opts.silent) return;

      const a0 = analyze(model, prev);
      const a1 = analyze(model, next);
      const before = new Set(a0.report.results.filter((r) => r.level === "uwaga").map((r) => r.id));
      const skus = SLOTS.flatMap((s) => (next[s] ? [next[s] as string] : []));
      for (const r of a1.report.results) {
        if (r.level === "uwaga" && !before.has(r.id)) {
          track("set_fit_warning", {
            rule: r.id,
            profile: next.profile ?? "no_profile",
            item_ids: skus,
          });
        }
      }
      if (slotCount(prev) === 2 && slotCount(next) === 3) {
        track("set_complete", {
          value: grToZl(a1.price.total),
          discount: grToZl(a1.price.discount),
          profile: next.profile ?? "no_profile",
          warnings: a1.report.warnings,
        });
        setJustCompleted(true); // A-16: hak klasy is-komplet (animacja w TAKTYL-36)
      }
    },
    [model, setState],
  );

  // ---- start: set_builder_start (raz w sesji), przywrocenie z taktyl.set.v1, "niedokonczony set" ----
  useEffect(() => {
    const stored = readStored();
    const storedHasSet = stored !== null && hasContent(stored.state);
    if (!initial.hasSet && storedHasSet && stored) {
      const restored: SetState = { ...stored.state };
      setState(restored);
      writeUrl(restored, "replace");
    } else {
      if (initial.hasSet) writeUrl(initial.state, "replace");
      if (initial.hasSet && storedHasSet && stored && !sameSelection(stored.state, initial.state)) {
        setPending({ state: stored.state, dateLabel: formatStoredDate(stored.updatedAt) });
      }
    }
    if (readItem("session", START_SESSION_KEY) === null) {
      writeItem("session", START_SESSION_KEY, "1");
      track("set_builder_start", { entry_point: initial.entry });
    }
    // jednorazowo przy montowaniu
  }, []);

  // Wstecz cofa krok (docs/03 §8): z adresu bierzemy tylko krok, wybory zostaja.
  useEffect(() => {
    const onPop = () => {
      const parsed = parseSearch(window.location.search, model);
      setState({ ...stateRef.current, step: parsed.state.step });
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, [model, setState]);

  // Fokus na naglowek kroku po "Dalej" i kliknieciu w pasek kroków (docs/03 §9).
  useEffect(() => {
    if (!focusRequested.current) return;
    focusRequested.current = false;
    document.getElementById(headingId(state.step))?.focus();
  }, [state.step]);

  const goStep = useCallback(
    (step: StepId) => {
      const prev = stateRef.current;
      if (step === prev.step) return;
      focusRequested.current = true;
      commit({ ...prev, step }, "push", { silent: true });
    },
    [commit],
  );

  const next = useCallback(() => {
    const i = STEPS.indexOf(stateRef.current.step);
    const target = STEPS[Math.min(STEPS.length - 1, i + 1)];
    if (target) goStep(target);
  }, [goStep]);

  const setProfile = useCallback(
    (id: string) => {
      const prev = stateRef.current;
      if (prev.profile === id || !model.rules.profiles[id]) return;
      let k = prev.k;
      if (!prev.switchByUser) k = retargetSwitch(model, entryOf(model, prev.k), id);
      commit(withSelection(prev, { profile: id, k }), "replace");
      track("set_profile_select", { profile: id, hand_cm: prev.handCm });
    },
    [commit, model],
  );

  const skipProfile = useCallback(() => {
    const prev = stateRef.current;
    focusRequested.current = true;
    commit({ ...prev, profile: null, step: "klawiatura" }, "push", { silent: true });
  }, [commit]);

  const setHand = useCallback(
    (cm: number | null) => {
      const prev = stateRef.current;
      if (prev.handCm === cm) return;
      commit({ ...prev, handCm: cm }, "replace");
      if (prev.profile !== null)
        track("set_profile_select", { profile: prev.profile, hand_cm: cm });
    },
    [commit],
  );

  const selectProduct = useCallback(
    (slot: SlotKey, product: BuilderProduct) => {
      const prev = stateRef.current;
      const current = entryOf(model, prev[slot]);
      if (current?.product.id === product.id) return;
      const variant = pickVariant(model, prev, slot, product, padKind);
      commit(withSelection(prev, { [slot]: variant.sku }), "replace");
      track("set_step_complete", {
        step: SLOT_TRACK_STEP[slot],
        item_id: variant.sku,
        item_name: product.name,
      });
    },
    [commit, model, padKind],
  );

  const selectVariant = useCallback(
    (slot: SlotKey, sku: string, dim: "color" | "switch" | "size") => {
      const prev = stateRef.current;
      if (prev[slot] === sku) return;
      const patch: Partial<SetState> = { [slot]: sku };
      if (slot === "k" && dim === "switch") patch.switchByUser = true;
      commit(withSelection(prev, patch), "replace");
    },
    [commit],
  );

  const applySuggestion = useCallback(
    (s: Suggestion) => {
      const prev = stateRef.current;
      const target = model.bySku.get(s.sku);
      if (!target) return;
      const slot = CATEGORY_SLOT[target.product.category];
      const from = prev[slot];
      commit(withSelection(prev, { [slot]: s.sku }), "replace");
      track("set_suggestion_apply", {
        rule: s.ruleId,
        from_item_id: from ?? "",
        to_item_id: s.sku,
        value_delta: grToZl(s.priceDelta),
      });
    },
    [commit, model],
  );

  const loadPreset = useCallback(
    (id: string) => {
      const parsed = parseSearch(new URLSearchParams({ preset: id }), model);
      const prev = stateRef.current;
      if (parsed.state.presetId === null) return;
      focusRequested.current = true;
      setNotices(parsed.notices);
      commit({ ...parsed.state, handCm: prev.handCm, step: "podsumowanie" }, "push", {
        silent: true,
      });
    },
    [commit, model],
  );

  const loadPending = useCallback(() => {
    if (!pending) return;
    setPending(null);
    setNotices([]);
    commit({ ...pending.state }, "replace", { silent: true });
  }, [commit, pending]);

  const dismissPending = useCallback(() => setPending(null), []);

  const copyLink = useCallback(async () => {
    const url = new URL(window.location.href);
    url.search = toSearchParams(stateRef.current).toString();
    const link = url.toString();
    try {
      if (!navigator.clipboard?.writeText) throw new Error("brak schowka");
      await navigator.clipboard.writeText(link);
      setFallbackLink(null);
      setMessage("Link skopiowany");
      track("set_share", { method: "clipboard" });
    } catch {
      // F-109: bez schowka - pole z zaznaczonym linkiem
      setFallbackLink(link);
      setMessage("Nie udało się skopiować automatycznie. Skopiuj link z pola poniżej.");
      track("set_share", { method: "fallback" });
    }
  }, []);

  const addToCart = useCallback(async () => {
    const s = stateRef.current;
    const a = analyze(model, s);
    const { k, m, p } = a.entries;
    if (busy || !k || !m || !p || a.soldOut.length > 0) return;
    setBusy(true);
    try {
      const skus = [k.variant.sku, m.variant.sku, p.variant.sku];
      const preset =
        s.presetId === null ? undefined : model.presets.find((x) => x.id === s.presetId);
      const presetId =
        preset && preset.skus.length === 3 && preset.skus.every((x, i) => x === skus[i])
          ? preset.id
          : null;
      const res = await addSet({
        skus,
        profile: s.profile,
        presetId,
        name: presetId && preset ? preset.name : "Twój set",
        ...(s.editId ? { replaceId: s.editId } : {}),
      });
      if (!res.ok) {
        toast({ message: "Nie udało się dodać setu do koszyka. Spróbuj ponownie." });
        return;
      }
      toast({ message: "Dodano set do koszyka" });
      const lines = [k, m, p].map((e, i) => {
        const bp = model.byId.get(e.product.id) as BuilderProduct;
        const bv = bp.variants.find((v) => v.sku === e.variant.sku) ?? bp.variants[0];
        return {
          sku: e.variant.sku,
          name: e.product.name,
          category: e.product.category,
          ...(bv ? { variant: variantText(model, bp, bv) } : {}),
          priceGr: e.variant.price,
          listId: "kreator-setu",
          listName: "Kreator setu",
          index: i,
        };
      });
      const items = buildSetItems(
        lines,
        a.price.discount,
        `Rabat za set ${model.setDiscount.percent}%`,
      );
      track("add_to_cart", { items, currency: "PLN", value: itemsValue(items) });
      track("set_add_to_cart", {
        value: itemsValue(items),
        discount: itemsDiscount(items),
        profile: s.profile ?? "no_profile",
        ...(presetId ? { preset_id: presetId } : {}),
        warnings: a.report.warnings,
      });
    } finally {
      setBusy(false);
    }
  }, [busy, model, toast]);

  return {
    model,
    state,
    analysis,
    padKind,
    setPadKind,
    notices,
    pending,
    message,
    fallbackLink,
    busy,
    justCompleted,
    clearCompleted: () => setJustCompleted(false),
    setProfile,
    skipProfile,
    setHand,
    selectProduct,
    selectVariant,
    applySuggestion,
    goStep,
    next,
    loadPreset,
    loadPending,
    dismissPending,
    copyLink,
    addToCart,
  };
}
