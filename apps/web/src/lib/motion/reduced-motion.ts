"use client";
// docs/07 §1: prefers-reduced-motion: reduce -> stany koncowe od razu. Wspolne dla animujKwote, A-02 i A-16.
import { useSyncExternalStore } from "react";

const QUERY = "(prefers-reduced-motion: reduce)";

/** True, gdy uzytkownik wylaczyl ruch. Bez matchMedia (SSR, stare silniki) traktujemy jak brak preferencji. */
export function prefersReducedMotion(): boolean {
  try {
    return typeof window !== "undefined" && window.matchMedia?.(QUERY).matches === true;
  } catch {
    return false;
  }
}

function subscribe(onChange: () => void): () => void {
  let mq: MediaQueryList | undefined;
  try {
    mq = window.matchMedia?.(QUERY);
  } catch {
    mq = undefined;
  }
  mq?.addEventListener?.("change", onChange);
  return () => mq?.removeEventListener?.("change", onChange);
}

/** Reaguje na zmiane preferencji w trakcie sesji; po stronie serwera false. */
export function useReducedMotion(): boolean {
  return useSyncExternalStore(subscribe, prefersReducedMotion, () => false);
}

/**
 * Czas animacji z tokenu (np. `--d-l`) w ms. Brak tokenu (test, brak CSS) albo 0 ms (reduced-motion zeruje tokeny w
 * tokens.css) daje 0 = bez animacji. Czasy w JS pochodza wylacznie z tokenow, nie z liczb wpisanych w kodzie.
 */
export function tokenMs(name: string): number {
  try {
    const raw = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
    const m = /^(-?\d*\.?\d+)(ms|s)$/.exec(raw);
    if (!m) return 0;
    const v = Number(m[1]);
    return m[2] === "s" ? v * 1000 : v;
  } catch {
    return 0;
  }
}
