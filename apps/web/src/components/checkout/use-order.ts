"use client";
// F-177...F-179 (ADR-0007, docs/17 §order_token): odczyt zamowienia z `order_token` zapisanego w tej przegladarce.
// Token nie trafia do adresu ani do pomiaru. Brak tokenu albo 404 = "nie znaleziono w tej przegladarce".
import type { OrderDetail } from "@taktyl/contracts";
import { useCallback, useEffect, useState } from "react";
import { fetchOrder } from "../../lib/cart/order-client";
import { getOrderToken } from "../../lib/cart/order-session";

export type OrderLoad =
  | { state: "loading" }
  | { state: "missing" }
  | { state: "error" }
  | { state: "ready"; order: OrderDetail };

export const ORDER_NUMBER_RE = /^TK-\d{6}-[A-Z0-9]{4}$/;

export function useOrder(number: string | null): {
  load: OrderLoad;
  token: string | null;
  reload: () => void;
} {
  const [load, setLoad] = useState<OrderLoad>({ state: "loading" });
  const [token, setToken] = useState<string | null>(null);
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    let alive = true;
    if (!number || !ORDER_NUMBER_RE.test(number)) {
      setLoad({ state: "missing" });
      return undefined;
    }
    const t = getOrderToken(number);
    setToken(t);
    if (!t) {
      setLoad({ state: "missing" });
      return undefined;
    }
    setLoad({ state: "loading" });
    void fetchOrder(number, t).then((res) => {
      if (!alive) return;
      if (res.ok) setLoad({ state: "ready", order: res.data });
      else setLoad({ state: res.kind === "not_found" ? "missing" : "error" });
    });
    return () => {
      alive = false;
    };
  }, [number, nonce]);

  return { load, token, reload: useCallback(() => setNonce((n) => n + 1), []) };
}
