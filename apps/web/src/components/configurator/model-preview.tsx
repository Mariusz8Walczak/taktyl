"use client";
// F-250, F-060 (audyt P0-3, ADR-0011 pkt 7): podglad 3D z renderem jako zastepstwem. Do aktywacji (klikniecie
// "Obróć w 3D" albo najechanie kursorem przy pointer: fine) widac tylko render z manifestu (LCP, zero JS three.js);
// potem dynamic import sceny i modelu GLB, a render znika dopiero, gdy scena jest gotowa. Bez WebGL albo przy bledzie
// zostaje render z komunikatem. Ruch: brak (obrot tylko na dzialanie klienta: przeciagniecie albo przyciski).
// Wzorzec: galeria `product-detail` (docs/08 §3) z wlasnym slajdem; scena = SceneView konfiguratora.
import type { Configuration } from "@taktyl/domain";
import dynamic from "next/dynamic";
import { useCallback, useState, type ReactNode } from "react";
import "../../styles/podglad-3d.css";

const Scene = dynamic(() => import("./model-preview-scene"), { ssr: false });

type Status = "idle" | "loading" | "ready" | "error";

export function ModelPreview({
  modelId,
  title,
  placeholder,
  parts,
  loadOnHover = false,
  className,
}: {
  modelId: string;
  /** Nazwa grupy dla czytnika ("Podgląd 3D: Łupek 65"). */
  title: string;
  /** Render produktu (ProductImage) pokazywany do czasu gotowosci sceny. */
  placeholder: ReactNode;
  parts?: Configuration["parts"];
  /** Glowna: model laduje sie po najechaniu kursorem (tylko mysz), nie tylko po kliknieciu. */
  loadOnHover?: boolean;
  className?: string;
}) {
  const [status, setStatus] = useState<Status>("idle");
  const onStatus = useCallback((s: "loading" | "ready" | "error") => setStatus(s), []);
  const activate = () => setStatus((s) => (s === "idle" ? "loading" : s));

  return (
    <div
      className={["podglad-3d", className].filter(Boolean).join(" ")}
      data-stan={status}
      onPointerEnter={(e) => {
        if (loadOnHover && e.pointerType === "mouse") activate();
      }}
    >
      {status !== "idle" && status !== "error" ? (
        <div className="podglad-3d__scena">
          <Scene modelId={modelId} title={title} parts={parts} onStatus={onStatus} />
        </div>
      ) : null}
      {status !== "ready" ? (
        <div className="podglad-3d__render">
          {placeholder}
          <div className="podglad-3d__akcja">
            {status === "idle" ? (
              <button type="button" className="tk-btn tk-btn--poboczny" onClick={activate}>
                Obróć w 3D
              </button>
            ) : null}
            {status === "loading" ? (
              <p className="podglad-3d__stan" role="status">
                Ładuję model 3D…
              </p>
            ) : null}
            {status === "error" ? (
              <p className="podglad-3d__stan" role="status">
                Podgląd 3D jest teraz niedostępny. Zdjęcie pokazuje produkt w wybranym kolorze.
              </p>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
