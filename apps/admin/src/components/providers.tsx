"use client";
// Dostawcy backpanelu: toast (@taktyl/ui), stan serwera (TanStack Query), sesja (B-001, B-002).
import { ToastProvider } from "@taktyl/ui";
import type { ReactNode } from "react";
import { AuthProvider } from "../lib/auth/session";
import { QueryProvider } from "../lib/query";

export function Providers({ children }: { children: ReactNode }) {
  return (
    <QueryProvider>
      <ToastProvider>
        <AuthProvider>{children}</AuthProvider>
      </ToastProvider>
    </QueryProvider>
  );
}
