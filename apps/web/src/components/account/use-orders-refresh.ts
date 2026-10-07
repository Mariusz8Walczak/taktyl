"use client";
// F-201, F-202 (docs/16 §2 `GET /v1/orders/{number}` z `X-Order-Token`): odswiezenie statusu zamowien zapisanych w tej
// przegladarce. Kazde zamowienie ma wlasny wynik: brak tokenu / 401 / 404 daje "missing" (komunikat, nie awaria listy).
import type { OrderDetail } from "@taktyl/contracts";
import { useEffect, useState } from "react";
import type { StoredOrderRef } from "../../lib/account/orders";
import { fetchOrder } from "../../lib/cart/order-client";

export type OrderRowState =
  | { state: "loading" }
  | { state: "ready"; order: OrderDetail }
  | { state: "missing" }
  | { state: "error" };

export function useOrdersRefresh(refs: readonly StoredOrderRef[]): Record<string, OrderRowState> {
  const [rows, setRows] = useState<Record<string, OrderRowState>>({});
  const key = refs.map((r) => `${r.number}:${r.token}`).join("|");

  useEffect(() => {
    let alive = true;
    for (const ref of refs) {
      if (!ref.token) {
        setRows((prev) => ({ ...prev, [ref.number]: { state: "missing" } }));
        continue;
      }
      void fetchOrder(ref.number, ref.token).then((res) => {
        if (!alive) return;
        const next: OrderRowState = res.ok
          ? { state: "ready", order: res.data }
          : { state: res.kind === "not_found" ? "missing" : "error" };
        setRows((prev) => ({ ...prev, [ref.number]: next }));
      });
    }
    return () => {
      alive = false;
    };
    // `key` zastepuje liste (zmiana skladu lub tokenu odswieza)
  }, [key]);

  return rows;
}
