"use client";
// F-241, wzorzec: powiadomienia toast (wlasny, docs/08). Dostawca z @taktyl/ui podpiety globalnie w layoucie.
// TAKTYL-84: hosty (szuflada koszyka F-150, "Szybko dodaj" F-042/F-043, skroty klawiszowe F-010, pasek porownania F-130)
// to jeden leniwy modul (global-hosts.tsx), dociagany zaraz po hydracji. Zadne z nich nie jest potrzebne do pierwszego
// malowania, a w bazie JS strony zajmowaly ok. 3 kB gzip i dokladaly zadanie do pierwszego widoku.
import { ToastProvider } from "@taktyl/ui";
import { Suspense, lazy, useEffect, useState } from "react";
import type { ReactNode } from "react";

const GlobalHosts = lazy(() => import("./global-hosts"));

function DeferredHosts() {
  const [ready, setReady] = useState(false);
  useEffect(() => setReady(true), []);
  if (!ready) return null;
  return (
    <Suspense fallback={null}>
      <GlobalHosts />
    </Suspense>
  );
}

export function Providers({ children }: { children: ReactNode }) {
  return (
    <ToastProvider>
      {children}
      <DeferredHosts />
    </ToastProvider>
  );
}
