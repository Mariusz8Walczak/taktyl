"use client";
// Stan serwera: TanStack Query. Bez ponowien przy 4xx (blad uzytkownika), jedno przy bledzie sieci/5xx.
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState, type ReactNode } from "react";
import { ApiError } from "./api/client";

export function makeQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 15_000,
        refetchOnWindowFocus: false,
        retry: (count, err) => !(err instanceof ApiError && err.status < 500) && count < 1,
      },
      mutations: { retry: false },
    },
  });
}

export function QueryProvider({ children, client }: { children: ReactNode; client?: QueryClient }) {
  const [qc] = useState(() => client ?? makeQueryClient());
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}
