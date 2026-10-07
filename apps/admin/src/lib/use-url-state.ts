"use client";
// docs/15 §7.1, B-101, B-201: filtry, sortowanie i strona w adresie (do udostepnienia i powrotu Wstecz).
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback } from "react";

export function useUrlState() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  const get = useCallback((key: string): string => params.get(key) ?? "", [params]);

  /** Ustawia klucze (pusta wartosc usuwa klucz); zmiana filtra zeruje numer strony. */
  const set = useCallback(
    (patch: Record<string, string | undefined>, keepPage = false) => {
      const next = new URLSearchParams(params.toString());
      for (const [k, v] of Object.entries(patch)) {
        if (v === undefined || v === "") next.delete(k);
        else next.set(k, v);
      }
      if (!keepPage && !("page" in patch)) next.delete("page");
      const qs = next.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [params, pathname, router],
  );

  const clear = useCallback(() => router.replace(pathname, { scroll: false }), [pathname, router]);
  return { get, set, clear, hasAny: params.toString() !== "" };
}
