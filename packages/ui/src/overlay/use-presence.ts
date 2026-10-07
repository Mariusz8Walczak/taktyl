import { useLayoutEffect, useState } from "react";
import type { AnimationEvent, RefObject } from "react";

/** Zapas na animationend, gdy zdarzenie nie nadejdzie (wiecej niz najdluzszy --d-l = 300 ms). */
export const ANIM_FALLBACK_MS = 400;

function hasAnimation(el: HTMLElement | null): boolean {
  if (!el) return false;
  const name = getComputedStyle(el).animationName;
  return Boolean(name) && name !== "none";
}

/**
 * Obecnosc elementu z animacja wyjscia (A-12, A-15):
 *  - visible: element ma byc w drzewie (otwarty albo jeszcze znika),
 *  - closing: trwa animacja zamykania (data-stan="zamykanie"),
 *  - animating: flaga data-anim dla will-change (tylko na czas animacji),
 *  - onAnimationEnd: podpinac do animowanego elementu; reaguje tylko na jego wlasna animacje
 *    (zdarzenia z potomkow bablkuja, docs/11 pkt 30).
 * Bez CSS albo przy prefers-reduced-motion (animation: none) element znika natychmiast.
 */
export function usePresence(open: boolean, ref: RefObject<HTMLElement | null>) {
  const [prevOpen, setPrevOpen] = useState(open);
  const [closing, setClosing] = useState(false);
  const [animating, setAnimating] = useState(false);

  if (open !== prevOpen) {
    setPrevOpen(open);
    setClosing(!open);
  }

  useLayoutEffect(() => {
    if (closing && !hasAnimation(ref.current)) {
      setClosing(false);
      setAnimating(false);
      return;
    }
    if (!open && !closing) return undefined;
    setAnimating(true);
    const t = setTimeout(() => {
      setAnimating(false);
      setClosing(false);
    }, ANIM_FALLBACK_MS);
    return () => clearTimeout(t);
  }, [open, closing, ref]);

  const onAnimationEnd = (e: AnimationEvent<HTMLElement>) => {
    if (e.target !== e.currentTarget) return;
    setAnimating(false);
    if (closing) setClosing(false);
  };

  return { visible: open || closing, closing, animating, onAnimationEnd };
}
