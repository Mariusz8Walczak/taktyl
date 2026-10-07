"use client";
// A-16 (docs/07 §3.4, docs/11 pulapka 30): klasa `is-komplet` zdejmowana po `animationend` z animationName === "obieg".
// Zdarzenie babelkuje z dzieci (wyniki, linia rabatu tez sie animuja), wiec bez sprawdzenia nazwy klasa znikalaby po
// pierwszej krotszej animacji. Zapas czasowy obejmuje prefers-reduced-motion i brak @property (zdarzenie nie nadejdzie).
import { useCallback, useEffect } from "react";
import type { AnimationEvent } from "react";

export const COMPLETE_ANIMATION = "obieg";
/** Dluzszy niz --d-scena (900 ms). */
export const COMPLETE_FALLBACK_MS = 1500;

export function isCompleteAnimationEnd(animationName: string): boolean {
  return animationName === COMPLETE_ANIMATION;
}

export function useCompleteRing(active: boolean, clear: () => void): (e: AnimationEvent) => void {
  useEffect(() => {
    if (!active) return undefined;
    const t = setTimeout(clear, COMPLETE_FALLBACK_MS);
    return () => clearTimeout(t);
  }, [active, clear]);
  return useCallback(
    (e: AnimationEvent) => {
      if (isCompleteAnimationEnd(e.animationName)) clear();
    },
    [clear],
  );
}
