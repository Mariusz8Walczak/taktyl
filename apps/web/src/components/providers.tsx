"use client";
// F-241, wzorzec: powiadomienia toast (wlasny, docs/08). Dostawca z @taktyl/ui podpiety globalnie w layoucie.
import { ToastProvider } from "@taktyl/ui";
import type { ReactNode } from "react";

export function Providers({ children }: { children: ReactNode }) {
  return <ToastProvider>{children}</ToastProvider>;
}
