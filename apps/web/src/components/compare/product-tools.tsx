"use client";
// F-045, F-130, F-132 (docs/05 §4 pkt 9; wzorzec: `product-detail`, docs/08 §3): "Dodaj do ulubionych" i "Porownaj" w
// kolumnie zakupu karty produktu. Kod przyciskow doladowywany po hydratacji (budzet JS, docs/12 §4); miejsce zarezerwowane w CSS.
import { Suspense, lazy, useEffect, useState } from "react";

const Impl = lazy(() => import("./product-tools-impl"));

export function ProductTools() {
  const [ready, setReady] = useState(false);
  useEffect(() => setReady(true), []);
  return (
    <div className="zakup__narzedzia">
      {ready ? (
        <Suspense fallback={null}>
          <Impl />
        </Suspense>
      ) : null}
    </div>
  );
}
