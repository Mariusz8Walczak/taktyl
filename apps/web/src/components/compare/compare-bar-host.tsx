"use client";
// F-130: punkt montowania paska porownania dla calego serwisu. Sam pasek jest doladowywany (React.lazy) dopiero, gdy w
// porownaniu jest produkt, zeby nie powiekszac JS stron tresciowych (budzet docs/12 §4); host zna tylko maly magazyn.
import { Suspense, lazy } from "react";
import { useHydrated } from "../../lib/account/persisted-store";
import { useCompareState } from "../../lib/compare/store";

const Bar = lazy(() => import("./compare-bar").then((m) => ({ default: m.CompareBar })));

export function CompareBarHost() {
  const { ids } = useCompareState();
  const hydrated = useHydrated();
  if (!hydrated || ids.length === 0) return null;
  return (
    <Suspense fallback={null}>
      <Bar />
    </Suspense>
  );
}
