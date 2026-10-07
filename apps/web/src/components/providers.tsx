"use client";
// F-241, wzorzec: powiadomienia toast (wlasny, docs/08). Dostawca z @taktyl/ui podpiety globalnie w layoucie.
// F-150: punkt montowania szuflady koszyka (doladowywana przy pierwszym otwarciu).
import { ToastProvider } from "@taktyl/ui";
import type { ReactNode } from "react";
import { CartDrawerHost } from "./cart/cart-drawer-host";

export function Providers({ children }: { children: ReactNode }) {
  return (
    <ToastProvider>
      {children}
      <CartDrawerHost />
    </ToastProvider>
  );
}
