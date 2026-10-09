"use client";
// F-250, F-255 (ADR-0011): rama sceny 3D: wykrycie WebGL, stan ladowania, przyciski obrotu (obsluga bez myszy)
// i komunikat zastepczy, gdy podglad 3D jest niedostepny. Wybor czesci dziala niezaleznie od sceny.
import type { ConfiguratorData } from "@taktyl/contracts";
import dynamic from "next/dynamic";
import { useEffect, useRef, useState, type Ref } from "react";
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
}: {
  title: string;
  data: ConfiguratorData;
  items: StageItem[];
  handleRef?: Ref<StageHandle>;
}) {
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [canRender, setCanRender] = useState(true);
  const own = useRef<StageHandle>(null);
  useEffect(() => setCanRender(webglAvailable()), []);

  const setRefs = (h: StageHandle | null) => {
    own.current = h;
    if (typeof handleRef === "function") handleRef(h);
    else if (handleRef) (handleRef as { current: StageHandle | null }).current = h;
  };

  return (
    <div className="konfigurator__scena" role="group" aria-label={title}>
      {canRender && state !== "error" ? (
        <Stage data={data} items={items} handleRef={setRefs} onStatus={setState} />
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
      {state === "ready" ? (
        <div className="konfigurator__widok" role="group" aria-label="Obracanie modelu">
          <button
            type="button"
            className="przycisk-tekstowy"
            onClick={() => own.current?.rotate(-30)}
          >
            Obróć w lewo
          </button>
          <button
            type="button"
            className="przycisk-tekstowy"
            onClick={() => own.current?.rotate(30)}
          >
            Obróć w prawo
          </button>
          <button
            type="button"
            className="przycisk-tekstowy"
            onClick={() => own.current?.view("front")}
          >
            Widok z przodu
          </button>
          <button
            type="button"
            className="przycisk-tekstowy"
            onClick={() => own.current?.view("top")}
          >
            Widok z góry
          </button>
        </div>
      ) : null}
    </div>
  );
}
