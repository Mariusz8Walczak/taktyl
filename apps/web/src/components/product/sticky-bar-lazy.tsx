"use client";
// F-068 (docs/12 §4, TAKTYL-59 priorytet 0): przyklejony pasek zakupu pojawia sie dopiero po przewinieciu strony, wiec
// jego kod (cena, przycisk, obserwator) laduje sie dynamicznym importem przy pierwszym przewinieciu, dotyku lub
// klawiszu, a nie w paczce karty produktu. Wzorzec: `product-detail` (docs/08 §3).
import { lazy, Suspense, useEffect, useState } from "react";

const loadBar = () => import("./sticky-bar").then((m) => ({ default: m.StickyBar }));
const StickyBar = lazy(loadBar);

const WAKE_EVENTS = ["scroll", "pointerdown", "keydown", "touchstart"] as const;

export function StickyBarLazy() {
  const [wanted, setWanted] = useState(false);

  useEffect(() => {
    if (wanted) return;
    const wake = () => setWanted(true);
    for (const name of WAKE_EVENTS)
      window.addEventListener(name, wake, { once: true, passive: true });
    return () => {
      for (const name of WAKE_EVENTS) window.removeEventListener(name, wake);
    };
  }, [wanted]);

  if (!wanted) return null;
  return (
    <Suspense fallback={null}>
      <StickyBar />
    </Suspense>
  );
}
