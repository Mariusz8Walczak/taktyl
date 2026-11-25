"use client";
// F-250, F-255 (ADR-0011): rama sceny 3D: wykrycie WebGL, stan ladowania, przyciski obrotu (obsluga bez myszy)
// i komunikat zastepczy, gdy podglad 3D jest niedostepny. Wybor czesci dziala niezaleznie od sceny.
// F-257: klikniecie czesci na modelu przekazywane rodzicowi (`onPick`), ktory otwiera jej sekcje i ustawia fokus (`revealPart`).
import type { ConfiguratorData } from "@taktyl/contracts";
import dynamic from "next/dynamic";
import { useEffect, useRef, useState, type Ref } from "react";
import "../../styles/podglad-3d.css";
import type { StageHandle, StageItem } from "./stage";

const Stage = dynamic(() => import("./stage"), { ssr: false });

function webglAvailable(): boolean {
  try {
    const c = document.createElement("canvas");
    return Boolean(c.getContext("webgl2") ?? c.getContext("webgl"));
  } catch {
    return false;
  }
}

export function SceneView({
  title,
  data,
  items,
  handleRef,
  className,
  onStatus,
  onPick,
}: {
  title: string;
  data: ConfiguratorData;
  items: StageItem[];
  handleRef?: Ref<StageHandle>;
  /** Modyfikator ramy, np. "konfigurator__scena--kwadrat" (galeria karty, glowna). */
  className?: string;
  /** Stan sceny dla rodzica (podglad z renderem jako zastepstwem zdejmuje render po "ready"). */
  onStatus?: (s: "loading" | "ready" | "error") => void;
  /** Klikniecie czesci modelu (konfigurator otwiera jej sekcje). */
  onPick?: (partId: string, itemKey: string) => void;
}) {
  const [state, setStateRaw] = useState<"loading" | "ready" | "error">("loading");
  const setState = (s: "loading" | "ready" | "error") => {
    setStateRaw(s);
    onStatus?.(s);
  };
  const [canRender, setCanRender] = useState(true);
  const own = useRef<StageHandle>(null);
  useEffect(() => {
    const ok = webglAvailable();
    setCanRender(ok);
    if (!ok) onStatus?.("error");
    // raz na zamontowanie (onStatus rodzica nie restartuje wykrycia WebGL)
  }, []);

  const setRefs = (h: StageHandle | null) => {
    own.current = h;
    if (typeof handleRef === "function") handleRef(h);
    else if (handleRef) (handleRef as { current: StageHandle | null }).current = h;
  };

  return (
    <div
      className={className ? `konfigurator__scena ${className}` : "konfigurator__scena"}
      role="group"
      aria-label={title}
    >
      {canRender && state !== "error" ? (
        <Stage
          data={data}
          items={items}
          handleRef={setRefs}
          onStatus={setState}
          {...(onPick ? { onPick } : {})}
        />
      ) : (
        <p className="konfigurator__brak-3d" role="status">
          Podgląd 3D jest niedostępny w tej przeglądarce. Wybór kolorów obok działa, a cena i kod
          zestawienia poniżej zawsze się aktualizują.
        </p>
      )}
      {state === "loading" && canRender ? (
        <p className="konfigurator__laduje" role="status">
          Ładuję model…
        </p>
      ) : null}
      {canRender && state !== "error" ? (
        <div className="konfigurator__widok" role="group" aria-label="Obracanie modelu">
          <button
            type="button"
            className="przycisk-tekstowy"
            disabled={state !== "ready"}
            onClick={() => own.current?.rotate(-30)}
          >
            Obróć w lewo
          </button>
          <button
            type="button"
            className="przycisk-tekstowy"
            disabled={state !== "ready"}
            onClick={() => own.current?.rotate(30)}
          >
            Obróć w prawo
          </button>
          <button
            type="button"
            className="przycisk-tekstowy"
            disabled={state !== "ready"}
            onClick={() => own.current?.view("front")}
          >
            Widok z przodu
          </button>
          <button
            type="button"
            className="przycisk-tekstowy"
            disabled={state !== "ready"}
            onClick={() => own.current?.view("top")}
          >
            Widok z góry
          </button>
        </div>
      ) : null}
    </div>
  );
}
