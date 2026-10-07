// F-150...F-157 (TAKTYL-39, TAKTYL-40): atrapa `POST /cart/quote` liczona domena (`allocateDiscount`, `setDiscountAmount`),
// zgodna z docs/16 §6.1 i S12-S16. Ceny katalogowe z data/products.json (grosze), stany mozna zmienic na test.
import type { QuoteResponse } from "@taktyl/contracts";
import { allocateDiscount, setDiscountAmount } from "@taktyl/domain";
import { vi } from "vitest";

export const CATALOG: Record<string, { name: string; price: number; stock: number }> = {
  "K-BZL75-GRF-PRG": { name: "Bazalt 75", price: 74900, stock: 24 },
  "K-BZL75-GRF-SLZ": { name: "Bazalt 75", price: 74900, stock: 24 },
  "M-PST-GRF": { name: "Pustułka", price: 39900, stock: 10 },
  "P-SZR-XL-GRF": { name: "Szron", price: 18900, stock: 35 },
  "P-TFL-M-GRF": { name: "Tafla", price: 6900, stock: 33 },
  "M-WRB-GRF": { name: "Wróbel", price: 12900, stock: 12 },
};
export const THRESHOLD = 29900;
export const SET_PERCENT = 10;
export const PROGRAMISTA = ["K-BZL75-GRF-PRG", "M-PST-GRF", "P-SZR-XL-GRF"] as const;

type Body = {
  items: (
    | { type: "item"; sku: string; qty: number }
    | { type: "set"; id: string; qty: number; skus: string[] }
  )[];
  coupon?: string | null;
  shipping_method?: string | null;
};

const SHIPPING: Record<string, number> = { automat: 1299, kurier: 1699, odbior: 0 };

export function fakeQuote(body: Body, catalog = CATALOG): QuoteResponse {
  const lines: QuoteResponse["lines"] = [];
  const problems: QuoteResponse["problems"] = [];
  const demand = new Map<string, number>();
  for (const l of body.items) {
    const skus = l.type === "set" ? l.skus : [l.sku];
    for (const s of skus) demand.set(s, (demand.get(s) ?? 0) + l.qty);
  }
  for (const [sku, qty] of demand) {
    const c = catalog[sku];
    if (!c) problems.push({ sku, code: "unknown_sku" });
    else if (qty > c.stock) problems.push({ sku, code: "out_of_stock", available_qty: c.stock });
  }
  const short = new Set(problems.map((p) => p.sku));
  let products = 0;
  let setDiscount = 0;
  let eligible = 0;
  for (const l of body.items) {
    if (l.type === "set") {
      const prices = l.skus.map((s) => catalog[s]!.price);
      const sum = prices.reduce((a, b) => a + b, 0);
      const disc = setDiscountAmount(sum, SET_PERCENT);
      const shares = allocateDiscount(prices, disc);
      lines.push({
        type: "set",
        id: l.id,
        qty: l.qty,
        items: l.skus.map((s, i) => ({
          sku: s,
          name: catalog[s]!.name,
          price_gr: prices[i]!,
          set_discount_gr: shares[i]!,
          stock: catalog[s]!.stock,
          available: !short.has(s),
        })),
        subtotal_gr: sum * l.qty,
        set_discount_gr: disc * l.qty,
        total_gr: (sum - disc) * l.qty,
      });
      products += sum * l.qty;
      setDiscount += disc * l.qty;
    } else {
      const c = catalog[l.sku]!;
      lines.push({
        type: "item",
        sku: l.sku,
        name: c.name,
        qty: l.qty,
        price_gr: c.price,
        coupon_discount_gr: 0,
        stock: c.stock,
        available: !short.has(l.sku),
      });
      products += c.price * l.qty;
      eligible += c.price * l.qty;
    }
  }
  const code = (body.coupon ?? "").trim().toUpperCase();
  let couponDiscount = 0;
  let coupon: QuoteResponse["coupon"] = null;
  if (code === "TAKTYL10") {
    if (eligible === 0) coupon = { code, applied: false, message_code: "coupon_not_for_sets" };
    else {
      couponDiscount = setDiscountAmount(eligible, 10);
      const items = lines.filter((l) => l.type === "item");
      const parts = allocateDiscount(
        items.map((l) => l.price_gr * l.qty),
        couponDiscount,
      );
      items.forEach((l, i) => {
        if (l.type === "item") l.coupon_discount_gr = parts[i]!;
      });
      coupon = {
        code,
        applied: true,
        message_code: lines.some((l) => l.type === "set")
          ? "coupon_applies_outside_sets"
          : "coupon_applied",
      };
    }
  } else if (code === "DOSTAWA0")
    coupon = { code, applied: true, message_code: "coupon_free_shipping" };
  else if (code) coupon = { code, applied: false, message_code: "coupon_unknown" };
  const after = products - setDiscount - couponDiscount;
  const free = code === "DOSTAWA0" || after >= THRESHOLD;
  const ship = body.shipping_method ? (free ? 0 : (SHIPPING[body.shipping_method] ?? 0)) : 0;
  return {
    currency: "PLN",
    lines,
    summary: {
      products_gr: products,
      set_discount_gr: setDiscount,
      coupon_discount_gr: couponDiscount,
      shipping_from_gr: 1299,
      total_gr: after + ship,
      free_shipping_remaining_gr: free ? 0 : THRESHOLD - after,
    },
    coupon,
    problems,
  };
}

/** Atrapa fetch dla `/api/cart/quote` (i opcjonalnie innych adresow przez `extra`). */
export function stubQuoteFetch(
  opts: {
    catalog?: typeof CATALOG;
    fail?: () => boolean;
    delayMs?: number;
    extra?: (url: string, init?: RequestInit) => Response | Promise<Response> | undefined;
  } = {},
) {
  const calls: Body[] = [];
  const fn = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    const other = opts.extra?.(url, init);
    if (other) return other;
    if (url.endsWith("/api/cart/quote")) {
      if (opts.delayMs) await new Promise((r) => setTimeout(r, opts.delayMs));
      if (opts.fail?.()) throw new TypeError("offline");
      const body = JSON.parse(String(init?.body)) as Body;
      calls.push(body);
      return Response.json(fakeQuote(body, opts.catalog));
    }
    return new Response("{}", { status: 404 });
  });
  vi.stubGlobal("fetch", fn);
  return { fn, calls };
}
