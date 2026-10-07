"use client";
// B-001, B-002, B-009 (ADM-001): sesja backpanelu. Stan sesji (uzytkownik, rola) pochodzi z GET /auth/me; ciasteczko jest
// HttpOnly, wiec JS go nie widzi. Token CSRF zyje tylko w pamieci (client.ts). Wygasniecie sesji (401) przenosi na logowanie
// z komunikatem i powrotem na ta sama strone (?next=).
import type { SessionResponse } from "@taktyl/contracts";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { usePathname, useRouter } from "next/navigation";
import { createContext, useCallback, useContext, useEffect, useMemo, type ReactNode } from "react";
import { ApiError, setCsrfToken, UNAUTHORIZED_EVENT } from "../api/client";
import { authApi } from "../api/endpoints";

export const SESSION_KEY = ["session"] as const;

interface AuthContextValue {
  session: SessionResponse | null;
  loading: boolean;
  logout: () => Promise<void>;
}
const AuthContext = createContext<AuthContextValue | null>(null);

/** Bezpieczny adres powrotu: tylko sciezka wewnetrzna (bez //, bez schematu). */
export function safeNext(next: string | null | undefined): string {
  if (!next || !next.startsWith("/") || next.startsWith("//") || next.startsWith("/logowanie"))
    return "/";
  return next;
}

export function loginUrl(next: string, reason?: "wygasla" | "wylogowano"): string {
  const p = new URLSearchParams();
  if (next && next !== "/") p.set("next", next);
  if (reason) p.set("powod", reason);
  const qs = p.toString();
  return qs ? `/logowanie?${qs}` : "/logowanie";
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const qc = useQueryClient();
  const router = useRouter();
  const pathname = usePathname();

  const query = useQuery({
    queryKey: SESSION_KEY,
    queryFn: async () => {
      try {
        return await authApi.me();
      } catch (e) {
        if (e instanceof ApiError && e.status === 401) return null;
        throw e;
      }
    },
    staleTime: 60_000,
    retry: false,
  });

  // B-002: 401 z dowolnego zapytania w trakcie pracy = wygasla sesja.
  useEffect(() => {
    const onUnauthorized = (e: Event) => {
      if (window.location.pathname.startsWith("/logowanie")) return;
      const code = (e as CustomEvent<string | null>).detail;
      setCsrfToken(null);
      qc.setQueryData(SESSION_KEY, null);
      qc.removeQueries({ predicate: (q) => q.queryKey[0] !== "session" });
      router.replace(
        loginUrl(
          window.location.pathname + window.location.search,
          code === "no_session" ? undefined : "wygasla",
        ),
      );
    };
    window.addEventListener(UNAUTHORIZED_EVENT, onUnauthorized);
    return () => window.removeEventListener(UNAUTHORIZED_EVENT, onUnauthorized);
  }, [qc, router]);

  // Ochrona tras: brak sesji = przekierowanie na logowanie (zapas dla proxy.ts, ktore robi to przed renderem).
  useEffect(() => {
    if (!query.isPending && query.data === null && !pathname.startsWith("/logowanie")) {
      router.replace(loginUrl(pathname));
    }
  }, [query.isPending, query.data, pathname, router]);

  const logout = useCallback(async () => {
    try {
      await authApi.logout();
    } finally {
      setCsrfToken(null);
      qc.clear();
      qc.setQueryData(SESSION_KEY, null);
      router.replace(loginUrl("/", "wylogowano"));
    }
  }, [qc, router]);

  const value = useMemo<AuthContextValue>(
    () => ({ session: query.data ?? null, loading: query.isPending, logout }),
    [query.data, query.isPending, logout],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth wymaga AuthProvider");
  return ctx;
}
