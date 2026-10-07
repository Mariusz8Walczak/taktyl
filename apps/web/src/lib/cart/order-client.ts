"use client";
// F-170...F-179 (docs/16 §6.2-§6.3): wywolania zamowien i symulacji platnosci przez `/api/orders*` (ten sam host).
// Kazda odpowiedz API jest mapowana na maly, jawny wynik; nic nie jest polykane po cichu.
import type { OrderCreated, OrderDetail, ProblemFieldError } from "@taktyl/contracts";

export type OrderFailureKind =
  | "network"
  | "out_of_stock"
  | "price_changed"
  | "validation"
  | "rate_limited"
  | "not_found"
  | "conflict"
  | "server";

export interface OrderFailure {
  ok: false;
  kind: OrderFailureKind;
  status: number | null;
  errors: ProblemFieldError[];
}
export type OrderResult<T> = { ok: true; data: T } | OrderFailure;

async function call<T>(
  path: string,
  init: { method: "GET" | "POST"; body?: string; token?: string; key?: string },
  isOk: (x: unknown) => x is T,
): Promise<OrderResult<T>> {
  const headers: Record<string, string> = { accept: "application/json" };
  if (init.body) headers["content-type"] = "application/json";
  if (init.token) headers["x-order-token"] = init.token;
  if (init.key) headers["idempotency-key"] = init.key;
  let res: Response;
  try {
    res = await fetch(path, { method: init.method, body: init.body, headers, cache: "no-store" });
  } catch {
    return { ok: false, kind: "network", status: null, errors: [] };
  }
  let json: unknown = null;
  try {
    json = await res.json();
  } catch {
    /* odpowiedz bez JSON-a: zostaje sam status */
  }
  if (res.ok) {
    return isOk(json)
      ? { ok: true, data: json }
      : { ok: false, kind: "server", status: res.status, errors: [] };
  }
  const p = (json ?? {}) as { code?: string; errors?: ProblemFieldError[] };
  const errors = Array.isArray(p.errors) ? p.errors : [];
  let kind: OrderFailureKind = "server";
  if (res.status === 429) kind = "rate_limited";
  else if (res.status === 404 || res.status === 401) kind = "not_found";
  else if (p.code === "out_of_stock") kind = "out_of_stock";
  else if (p.code === "price_changed") kind = "price_changed";
  else if (res.status === 400 || res.status === 422) kind = "validation";
  else if (res.status === 409) kind = "conflict";
  return { ok: false, kind, status: res.status, errors };
}

const isCreated = (x: unknown): x is OrderCreated =>
  Boolean(x) &&
  typeof (x as OrderCreated).number === "string" &&
  typeof (x as OrderCreated).order_token === "string";
const isDetail = (x: unknown): x is OrderDetail =>
  Boolean(x) &&
  typeof (x as OrderDetail).number === "string" &&
  Array.isArray((x as OrderDetail).items);
export interface SimulateResult {
  status: "paid" | "payment_failed";
  transaction_id: string;
}
const isSim = (x: unknown): x is SimulateResult =>
  Boolean(x) && typeof (x as { status?: unknown }).status === "string";

export const createOrder = (body: unknown, key: string) =>
  call("/api/orders", { method: "POST", body: JSON.stringify(body), key }, isCreated);

export const fetchOrder = (number: string, token: string) =>
  call(`/api/orders/${encodeURIComponent(number)}`, { method: "GET", token }, isDetail);

export const simulatePayment = (number: string, token: string, outcome: "paid" | "failed") =>
  call(
    `/api/orders/${encodeURIComponent(number)}/payment`,
    { method: "POST", body: JSON.stringify({ outcome }), token },
    isSim,
  );

/** SKU z komunikatow `409 out_of_stock` ("K-BZL75-GRF-PRG: dostepne 0"). */
export function skusFromStockErrors(errors: readonly ProblemFieldError[]): string[] {
  const out = new Set<string>();
  for (const e of errors) {
    const m = /^([A-Z0-9-]+):/.exec(e.message);
    if (m?.[1]) out.add(m[1]);
  }
  return [...out];
}
