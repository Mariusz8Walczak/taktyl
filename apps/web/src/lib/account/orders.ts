"use client";
// F-201, F-202 (docs/02 §1.2 `taktyl.orders.v1`, docs/16 §2 `GET /v1/orders/{number}`): zamowienia tej przegladarki
// = numer + `order_token` + data zapisu (bez danych adresowych, cen i danych kontaktowych). Zapis robi kasa
// (lib/cart/order-session.ts); tu tylko odczyt i odswiezanie statusu z API.
import type { OrderDetail } from "@taktyl/contracts";
import { createPersistedStore } from "./persisted-store";

export const ORDERS_KEY = "taktyl.orders.v1";

export interface StoredOrderRef {
  number: string;
  token: string;
  at: string;
}
interface OrdersState {
  orders: readonly StoredOrderRef[];
}
const EMPTY: OrdersState = { orders: [] };

export const ordersStore = createPersistedStore<OrdersState>(
  ORDERS_KEY,
  (raw) => {
    const list = raw && typeof raw === "object" ? (raw as { orders?: unknown }).orders : null;
    if (!Array.isArray(list)) return EMPTY;
    const orders = list.flatMap((o): StoredOrderRef[] => {
      const x = o as Partial<StoredOrderRef> | null;
      return x && typeof x.number === "string" && typeof x.token === "string"
        ? [{ number: x.number, token: x.token, at: typeof x.at === "string" ? x.at : "" }]
        : [];
    });
    // najnowsze pierwsze
    return { orders: orders.reverse() };
  },
  EMPTY,
);

export const ORDER_STATUS_LABEL: Record<OrderDetail["status"], string> = {
  pending_payment: "Czeka na płatność",
  payment_failed: "Płatność nieudana",
  paid: "Opłacone",
  processing: "W realizacji",
  shipped: "Wysłane",
  delivered: "Dostarczone",
  cancelled: "Anulowane",
};

/** Wartosc pozycji po rabatach (grosze). */
export function lineTotalGr(i: OrderDetail["items"][number]): number {
  return i.unit_price_gr * i.qty - i.set_discount_gr - i.coupon_discount_gr;
}

/** Data i godzina po polsku w strefie sklepu (regula 7). */
export function formatDateTime(iso: string, timeZone: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return new Intl.DateTimeFormat("pl-PL", {
    dateStyle: "long",
    timeStyle: "short",
    timeZone,
  }).format(d);
}
