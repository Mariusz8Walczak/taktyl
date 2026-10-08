"use client";
// F-042, F-043 (TAKTYL-59; wzorzec: "Quick Add" szablonu, docs/08 §3): globalny punkt wejscia "Szybko dodaj".
// Karty listingu (serwerowe) niosa tylko <button data-szybko-dodaj>; ten host nasluchuje klikniec (delegacja), a panel
// wyboru wariantu (Dialog z @taktyl/ui, pobranie wariantow, picker) laduje sie dynamicznym importem dopiero po
// pierwszym kliknieciu albo najechaniu/fokusie na przycisk, wiec nie wchodzi do budzetu JS strony (docs/12 §4).
import { Suspense, lazy, useEffect, useRef, useState } from "react";

const loadPanel = () => import("./quick-add-panel");
const QuickAddPanel = lazy(loadPanel);

export interface QuickAddTarget {
  slug: string;
  category: string;
  sku: string;
  /** Element wywolujacy: tu wraca fokus po zamknieciu panelu. */
  trigger: HTMLElement;
}

const SELECTOR = "[data-szybko-dodaj]";

function targetOf(el: Element | null): QuickAddTarget | null {
  const btn = el?.closest<HTMLElement>(SELECTOR);
  const { slug, category, sku } = btn?.dataset ?? {};
  return btn && slug && category && sku ? { slug, category, sku, trigger: btn } : null;
}

export function QuickAddHost() {
  const [target, setTarget] = useState<QuickAddTarget | null>(null);
  const [open, setOpen] = useState(false);
  const [used, setUsed] = useState(false);
  const returnRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      const t = targetOf(e.target instanceof Element ? e.target : null);
      if (!t) return;
      e.preventDefault();
      returnRef.current = t.trigger;
      setTarget(t);
      setUsed(true);
      setOpen(true);
    };
    // rozgrzewka: kod panelu zaczyna sie ladowac, gdy klient celuje w przycisk
    const warm = (e: Event) => {
      if (e.target instanceof Element && e.target.closest(SELECTOR)) void loadPanel();
    };
    document.addEventListener("click", onClick);
    document.addEventListener("pointerover", warm, { passive: true });
    document.addEventListener("focusin", warm);
    return () => {
      document.removeEventListener("click", onClick);
      document.removeEventListener("pointerover", warm);
      document.removeEventListener("focusin", warm);
    };
  }, []);

  if (!used || !target) return null;
  return (
    <Suspense fallback={null}>
      <QuickAddPanel
        target={target}
        open={open}
        onClose={() => setOpen(false)}
        returnFocusRef={returnRef}
      />
    </Suspense>
  );
}
