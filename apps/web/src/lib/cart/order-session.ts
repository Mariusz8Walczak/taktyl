"use client";
// F-180 (docs/02 §1.2 `taktyl.orders.v1`, ADR-0007): zamowienia tej przegladarki = numer + `order_token` (klucz do
// `GET /orders/{n}`). Zadnych danych osobowych ani cen. Klucz idempotencji zamowienia zyje w sessionStorage na probe.
import { readItem, removeItem, writeItem } from "../storage/safe-storage";

const ORDERS_KEY = "taktyl.orders.v1";
const IDEM_KEY = "taktyl.checkout.idem.v1";
const MAX_ORDERS = 10;

export interface StoredOrder {
  number: string;
  token: string;
  at: string;
}

function readOrders(): StoredOrder[] {
  try {
    const parsed: unknown = JSON.parse(readItem("local", ORDERS_KEY) ?? "null");
    const list =
      parsed && typeof parsed === "object" ? (parsed as { orders?: unknown }).orders : null;
    if (!Array.isArray(list)) return [];
    return list.filter(
      (o): o is StoredOrder =>
        Boolean(o) &&
        typeof (o as StoredOrder).number === "string" &&
        typeof (o as StoredOrder).token === "string",
    );
  } catch {
    return [];
  }
}

export function saveOrderToken(number: string, token: string, now: Date = new Date()): void {
  const rest = readOrders().filter((o) => o.number !== number);
  const orders = [...rest, { number, token, at: now.toISOString() }].slice(-MAX_ORDERS);
  writeItem("local", ORDERS_KEY, JSON.stringify({ v: 1, orders }));
}

export function getOrderToken(number: string): string | null {
  return readOrders().find((o) => o.number === number)?.token ?? null;
}

function uuid(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  const b = new Uint8Array(16);
  crypto.getRandomValues(b);
  b[6] = ((b[6] as number) & 0x0f) | 0x40;
  b[8] = ((b[8] as number) & 0x3f) | 0x80;
  const h = [...b].map((x) => x.toString(16).padStart(2, "0")).join("");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

/** Klucz `Idempotency-Key` biezacej proby; ta sama proba (np. ponowienie po bledzie sieci) = ten sam klucz. */
export function getIdempotencyKey(): string {
  const existing = readItem("session", IDEM_KEY);
  if (existing) return existing;
  const key = uuid();
  writeItem("session", IDEM_KEY, key);
  return key;
}

/** Po jednoznacznej odpowiedzi (sukces albo odrzucenie przez serwer) kolejna proba dostaje nowy klucz. */
export function clearIdempotencyKey(): void {
  removeItem("session", IDEM_KEY);
}
