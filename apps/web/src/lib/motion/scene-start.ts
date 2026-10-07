"use client";
// A-02 (docs/07 §3.2): klasa `scena-start` dodawana raz na sesje, gdy IntersectionObserver zgłosi widocznosc podgladu.
// sessionStorage zawsze w try/catch (docs/11 pulapka 10) - wspolny modul storage ma zapas w pamieci.
import { useCallback, useEffect, useRef, useState } from "react";
import type { AnimationEvent, RefObject } from "react";
import { readItem, writeItem } from "../storage/safe-storage";
import { prefersReducedMotion } from "./reduced-motion";

export const SCENE_SESSION_KEY = "taktyl.scena.v1";
/** Zapas na zdjecie klasy, gdy animationend nie nadejdzie (reduced-motion, brak CSS): sciana --d-scena + opoznienia. */
export const SCENE_FALLBACK_MS = 1500;
/** Animacja konczaca sekwencje A-02 (strefa i plakietka); po niej klasa schodzi (will-change tylko na czas animacji). */
export const SCENE_LAST_ANIMATION = "tk-pojawienie";

export function sceneAlreadyPlayed(): boolean {
  return readItem("session", SCENE_SESSION_KEY) !== null;
}
export function markScenePlayed(): void {
  writeItem("session", SCENE_SESSION_KEY, "1");
}

export interface SceneStart<T extends HTMLElement> {
  ref: RefObject<T | null>;
  /** True na czas sekwencji: dodaj klase `scena-start` do kontenera. */
  active: boolean;
  onAnimationEnd: (e: AnimationEvent<HTMLElement>) => void;
}

/**
 * Raz na sesje: gdy podglad jest w widoku, `active` = true. Przy prefers-reduced-motion sekwencji nie ma (stan koncowy
 * od razu), ale sesja jest oznaczana, zeby przelaczenie preferencji w trakcie sesji nie odtworzylo sceny.
 */
export function useSceneStart<T extends HTMLElement = HTMLDivElement>(): SceneStart<T> {
  const ref = useRef<T | null>(null);
  const [active, setActive] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el || sceneAlreadyPlayed()) return undefined;
    if (prefersReducedMotion()) {
      markScenePlayed();
      return undefined;
    }
    const start = () => {
      markScenePlayed();
      setActive(true);
    };
    if (typeof IntersectionObserver === "undefined") {
      start();
      return undefined;
    }
    const io = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting)) {
        io.disconnect();
        start();
      }
    });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    if (!active) return undefined;
    const t = setTimeout(() => setActive(false), SCENE_FALLBACK_MS);
    return () => clearTimeout(t);
  }, [active]);

  const onAnimationEnd = useCallback((e: AnimationEvent<HTMLElement>) => {
    // zdarzenie babelkuje z dzieci: zdejmujemy klase dopiero po ostatniej animacji sekwencji
    if (e.animationName === SCENE_LAST_ANIMATION) setActive(false);
  }, []);

  return { ref, active, onAnimationEnd };
}
