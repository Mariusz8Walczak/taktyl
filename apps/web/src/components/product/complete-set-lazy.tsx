"use client";
// F-069 (docs/12 §4: karta produktu <= 150 kB JS): blok "Dokoncz set" jest widoczny od razu jako statyczny HTML z
// serwera, a jego interaktywna wersja (reguly, cena, koszyk, ~10 kB) ladowana jest dynamicznym importem dopiero, gdy
// sekcja zbliza sie do widoku albo klient jej dotknie. Ten wrapper jest maly i nie zalezy od domeny ani koszyka.
import { useEffect, useRef, useState, type ComponentType, type ReactNode } from "react";
import type { CompleteSetProps } from "../../lib/builder/complete-view";

/** Ile przed widokiem zaczynamy ladowac interaktywny blok (okno przegladarki x 1,5). */
const PRELOAD_MARGIN = "150%";

export function CompleteSetLazy({
  props,
  children,
}: {
  props: CompleteSetProps;
  /** Statyczny widok z serwera (ten sam uklad co wersja interaktywna). */
  children: ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [Block, setBlock] = useState<ComponentType<CompleteSetProps> | null>(null);
  const [wanted, setWanted] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (wanted || !el) return;
    if (typeof IntersectionObserver === "undefined") {
      setWanted(true);
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setWanted(true);
          io.disconnect();
        }
      },
      { rootMargin: PRELOAD_MARGIN },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [wanted]);

  useEffect(() => {
    if (!wanted) return;
    let alive = true;
    void import("./complete-set-block").then((m) => {
      if (alive) setBlock(() => m.CompleteSetBlock);
    });
    return () => {
      alive = false;
    };
  }, [wanted]);

  if (Block) return <Block {...props} />;
  return (
    <div ref={ref} onPointerEnter={() => setWanted(true)} onFocusCapture={() => setWanted(true)}>
      {children}
    </div>
  );
}
