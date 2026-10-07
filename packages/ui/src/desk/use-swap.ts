// A-06 (docs/07 §2): zmiana elementu setu w DeskStage - stary znika (opacity + translateY), nowy wchodzi dopiero po
// img.decode() (translateY + opacity). Hook zarzadza warstwami; sam ruch jest w css/scena.css (tylko transform i opacity).
import { useCallback, useEffect, useRef, useState } from "react";
import type { AnimationEvent } from "react";

export type SwapPhase = "idle" | "czeka" | "wejscie" | "wyjscie";

/** Migawka elementu: klucz tozsamosci (np. wpis manifestu), dane i prostokat w plotnie (potrzebny warstwie wychodzacej). */
export interface SwapSnapshot<T, R> {
  key: string;
  item: T;
  rect: R;
}

export interface SwapLayer<T, R> extends SwapSnapshot<T, R> {
  /** Unikalny klucz Reacta (wychodzaca warstwa tego samego klucza nie koliduje z biezaca). */
  reactKey: string;
  phase: SwapPhase;
  ref: (node: HTMLElement | null) => void;
  onAnimationEnd: (e: AnimationEvent<HTMLElement>) => void;
}

/** Zapas na decode(), gdy obraz nie nadejdzie (leniwe ladowanie, blad): nowy element i tak wchodzi. */
export const DECODE_MAX_MS = 1000;
/** Zapas na animationend (dluzszy niz najdluzszy czas z tokenow, --d-l = 300 ms). */
export const SWAP_FALLBACK_MS = 600;

export function prefersReducedMotion(): boolean {
  try {
    return (
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches === true
    );
  } catch {
    return false;
  }
}

interface State<T, R> {
  liveKey: string | null;
  leaving: { id: number; snap: SwapSnapshot<T, R> }[];
  phases: Record<string, "czeka" | "wejscie">;
}

/**
 * Zwraca warstwy do wyrenderowania: najpierw wychodzace, na koncu biezaca. Pierwszy render i prefers-reduced-motion:
 * bez ruchu (stan koncowy od razu, nic nie znika z opoznieniem).
 */
export function useSwapLayers<T, R>(current: SwapSnapshot<T, R> | null): SwapLayer<T, R>[] {
  const currentKey = current?.key ?? null;
  const [state, setState] = useState<State<T, R>>({ liveKey: currentKey, leaving: [], phases: {} });
  const last = useRef<SwapSnapshot<T, R> | null>(current);
  const nodes = useRef(new Map<string, HTMLElement>());
  const seq = useRef(0);

  // Zmiana tozsamosci wykrywana w trakcie renderu (bez klatki, w ktorej stary element zniknalby bez animacji).
  if (state.liveKey !== currentKey) {
    const reduced = prefersReducedMotion();
    const prev = last.current;
    const next: State<T, R> = { liveKey: currentKey, leaving: state.leaving, phases: state.phases };
    if (prev && prev.key === state.liveKey && !reduced) {
      next.leaving = [...state.leaving, { id: ++seq.current, snap: prev }];
    }
    if (currentKey && !reduced) next.phases = { ...state.phases, [currentKey]: "czeka" };
    setState(next);
  }

  useEffect(() => {
    last.current = current;
  });

  const phase = currentKey ? state.phases[currentKey] : undefined;

  // Nowy element: czekamy na img.decode() (z zapasem czasowym), potem wchodzi.
  useEffect(() => {
    if (!currentKey || phase !== "czeka") return undefined;
    let cancelled = false;
    const go = () => {
      if (!cancelled) setState((s) => ({ ...s, phases: { ...s.phases, [currentKey]: "wejscie" } }));
    };
    const img = nodes.current.get(currentKey)?.querySelector("img");
    if (img && typeof img.decode === "function") {
      const timer = setTimeout(go, DECODE_MAX_MS);
      img
        .decode()
        .catch(() => undefined)
        .then(() => {
          clearTimeout(timer);
          go();
        });
      return () => {
        cancelled = true;
        clearTimeout(timer);
      };
    }
    go();
    return () => {
      cancelled = true;
    };
  }, [currentKey, phase]);

  // Zapas: bez animationend (brak CSS, animation: none) warstwy porzadkujemy po czasie.
  const exiting = state.leaving.length > 0 && phase !== "czeka";
  useEffect(() => {
    if (!exiting) return undefined;
    const t = setTimeout(() => setState((s) => ({ ...s, leaving: [] })), SWAP_FALLBACK_MS);
    return () => clearTimeout(t);
  }, [exiting, state.leaving]);
  useEffect(() => {
    if (phase !== "wejscie" || !currentKey) return undefined;
    const t = setTimeout(() => setState((s) => dropPhase(s, currentKey)), SWAP_FALLBACK_MS);
    return () => clearTimeout(t);
  }, [phase, currentKey]);

  const setRef = useCallback(
    (key: string) => (node: HTMLElement | null) => {
      if (node) nodes.current.set(key, node);
      else nodes.current.delete(key);
    },
    [],
  );

  const layers: SwapLayer<T, R>[] = state.leaving.map(({ id, snap }) => ({
    ...snap,
    reactKey: `${snap.key}~wyjscie~${id}`,
    phase: exiting || !current ? "wyjscie" : "idle",
    ref: () => undefined,
    onAnimationEnd: (e) => {
      if (e.target !== e.currentTarget) return;
      setState((s) => ({ ...s, leaving: s.leaving.filter((l) => l.id !== id) }));
    },
  }));
  if (current) {
    layers.push({
      ...current,
      reactKey: current.key,
      phase: phase ?? "idle",
      ref: setRef(current.key),
      onAnimationEnd: (e) => {
        if (e.target !== e.currentTarget) return;
        setState((s) => dropPhase(s, current.key, "wejscie"));
      },
    });
  }
  return layers;
}

function dropPhase<T, R>(s: State<T, R>, key: string, only?: "wejscie"): State<T, R> {
  const p = s.phases[key];
  if (!p || (only && p !== only)) return s;
  const phases = { ...s.phases };
  delete phases[key];
  return { ...s, phases };
}
