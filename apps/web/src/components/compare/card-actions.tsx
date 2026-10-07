"use client";
// F-045, F-130, F-132 (wzorzec: akcje karty `product-style-0X`, docs/08 §3): "Dodaj do ulubionych" i "Porownaj" na karcie
// listingu. Wyspa kliencka w serwerowej karcie; elementy za odnosnikiem karty (kolejnosc DOM), cel >= 44 px. Kod przyciskow
// (magazyny, toast, pomiar) jest doladowywany po hydratacji (React.lazy), zeby nie powiekszac JS stron tresciowych
// (budzet docs/12 §4); miejsce na przyciski zarezerwowane w CSS (.karta__akcje, min-height), wiec bez skoku ukladu.
import { Suspense, lazy, useEffect, useState } from "react";
import type { CardActionsProps } from "./card-actions-impl";

const Impl = lazy(() => import("./card-actions-impl"));

export type { CardActionsProps };

export function CardActions(props: CardActionsProps) {
  const [ready, setReady] = useState(false);
  useEffect(() => setReady(true), []);
  return (
    <div className="karta__akcje">
      {ready ? (
        <Suspense fallback={null}>
          <Impl {...props} />
        </Suspense>
      ) : null}
    </div>
  );
}
