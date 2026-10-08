"use client";
// F-010, A-17 (docs/08 §6), TAKTYL-67: punkt montowania skrotow klawiszowych w kazdej stronie. Caly nasluch
// (klawisze, prefs, menu kategorii, pomiar skrotow, panel ?pomiar) to osobny modul shortcuts-controller.tsx, dociagany
// zaraz po hydracji, zeby nie liczyc sie do bazy JS stron (budzet docs/12 §4). Do czasu zaladowania (kilka ms) skroty
// nie reaguja, a klawisze dzialaja jak zwykle w przegladarce.
import { Suspense, lazy, useEffect, useState } from "react";

const Controller = lazy(() => import("./shortcuts-controller"));

export function ShortcutsHost() {
  const [ready, setReady] = useState(false);
  useEffect(() => setReady(true), []);
  if (!ready) return null;
  return (
    <Suspense fallback={null}>
      <Controller />
    </Suspense>
  );
}
