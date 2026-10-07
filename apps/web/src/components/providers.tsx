"use client";
// F-241, wzorzec: powiadomienia toast (wlasny, docs/08). Dostawca z @taktyl/ui podpiety globalnie w layoucie.
// F-150: punkt montowania szuflady koszyka (doladowywana przy pierwszym otwarciu).
// F-042/F-043, F-010 (TAKTYL-59): hosty "Szybko dodaj" i skrotow klawiszowych (male, panele ladowane leniwie).
import { ToastProvider } from "@taktyl/ui";
import type { ReactNode } from "react";
import { CartDrawerHost } from "./cart/cart-drawer-host";
import { QuickAddHost } from "./listing/quick-add-host";
import { ShortcutsHost } from "./shortcuts/shortcuts-host";
import "../styles/skroty.css";
import { CompareBarHost } from "./compare/compare-bar-host";

export function Providers({ children }: { children: ReactNode }) {
  return (
    <ToastProvider>
      {children}
      <CartDrawerHost />
      <QuickAddHost />
      <ShortcutsHost />
      {/* F-130: pasek porownania */}
      <CompareBarHost />
    </ToastProvider>
  );
}
