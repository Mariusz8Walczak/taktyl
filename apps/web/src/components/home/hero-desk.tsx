"use client";
// F-106, A-02 (hak) (docs/05 §2 pkt 3, docs/07 §3.2): podglad biurka w pierwszym ekranie - DeskStage z gotowym setem
// "Programista". Wzorzec: wlasny uklad na siatce szablonu (docs/08 §6). Haka animacji dostarcza klasa `scena-start`,
// dodawana RAZ NA SESJE (sessionStorage w try/catch), gdy IntersectionObserver zgloszy widocznosc podgladu; sam ruch
// (CSS) robi TAKTYL-36. Elementy sa widoczne od pierwszej klatki (zero opacity:0 na LCP), bez JS tez.
import { DeskStage, type DeskStageProps } from "@taktyl/ui";
import { useEffect, useRef } from "react";
import { MEDIA_BASE_URL } from "../../lib/catalog/images";
import { readItem, writeItem } from "../../lib/storage/safe-storage";

/** Klucz sesji: animacja startowa gra raz na sesje (docs/07 §3.2). */
export const SCENE_SESSION_KEY = "taktyl.scena.v1";
export const SCENE_CLASS = "scena-start";

export type HeroDeskData = Pick<
  DeskStageProps,
  "keyboard" | "mouse" | "pad" | "zoneMm" | "gapMm" | "marginMm" | "result"
>;

export function HeroDesk({ data }: { data: HeroDeskData }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    if (readItem("session", SCENE_SESSION_KEY) !== null) return;
    const io = new IntersectionObserver((entries) => {
      if (!entries.some((e) => e.isIntersecting)) return;
      io.disconnect();
      writeItem("session", SCENE_SESSION_KEY, "1");
      el.classList.add(SCENE_CLASS);
    });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <div ref={ref} className="hero__scena-ramka" data-testid="hero-scena">
      <DeskStage className="hero__scena" baseUrl={MEDIA_BASE_URL} priority {...data} />
    </div>
  );
}
