// F-150...F-157, F-024 (docs/16 par. 6.1, ADR-0007): wycena koszyka po stronie serwera.
// Ceny wylacznie z bazy; arytmetyka rabatu setu, kodow i progu dostawy wylacznie z @taktyl/domain (quoteCart).
import { Inject, Injectable } from "@nestjs/common";
import {
  quoteResponseSchema,
  type CartLine,
  type QuoteProblem,
  type QuoteResponse,
} from "@taktyl/contracts";
import {
  quoteCart,
  type CartEntry,
  type CartQuote,
  type ShopConfig,
  type SkuIndex,
} from "@taktyl/domain";
import { CatalogLoader } from "../catalog/catalog.loader.js";
import { CLOCK, type Clock } from "../common/clock.js";
import { respond } from "../common/zod.pipe.js";
import { ShopConfigService } from "../settings/shop-config.service.js";

export interface QuoteInput {
  items: readonly CartLine[];
  coupon?: string | null | undefined;
  shippingMethod?: string | null | undefined;
}

/** Wynik wewnetrzny: odpowiedz kontraktu + wynik domeny (dla zamowien). */
export interface QuoteComputation {
  response: QuoteResponse;
  quote: CartQuote;
  /** Pozycje, ktore weszly do wyceny (bez linii z nieznanym SKU), z indeksem linii w zadaniu. */
  entries: { entry: CartEntry; sourceIndex: number }[];
  index: SkuIndex;
  config: ShopConfig;
  now: Date;
  /** SKU z brakiem towaru: zapotrzebowanie zsumowane po wszystkich liniach przekracza stan. */
  shortages: { sku: string; availableQty: number }[];
  /** Linie zadania z nieznanym SKU (`items[n]`). */
  unknown: { sku: string; sourceIndex: number }[];
}

/** F-153: komunikat kodu dla klienta (tekst sklada klient). */
function couponMessage(
  status: CartQuote["codeStatus"],
  codeType: string | undefined,
  hasSets: boolean,
): { applied: boolean; message: string } {
  if (status === "unknown") return { applied: false, message: "coupon_unknown" };
  if (status === "sets-only") return { applied: false, message: "coupon_not_for_sets" };
  if (codeType === "free_shipping") return { applied: true, message: "coupon_free_shipping" };
  return { applied: true, message: hasSets ? "coupon_applies_outside_sets" : "coupon_applied" };
}

@Injectable()
export class CartQuoteService {
  constructor(
    @Inject(CatalogLoader) private readonly loader: CatalogLoader,
    @Inject(ShopConfigService) private readonly shop: ShopConfigService,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  async quote(input: QuoteInput): Promise<QuoteResponse> {
    return (await this.compute(input)).response;
  }

  async compute(input: QuoteInput): Promise<QuoteComputation> {
    const now = this.clock();
    const [snap, config] = await Promise.all([this.loader.load(), this.shop.load(now)]);
    const { index } = snap;

    // Linie z nieznanym SKU nie wchodza do wyceny (problem unknown_sku, nie blad HTTP).
    const entries: QuoteComputation["entries"] = [];
    const unknown: QuoteComputation["unknown"] = [];
    input.items.forEach((line, sourceIndex) => {
      const skus = line.type === "set" ? line.skus : [line.sku];
      const missing = skus.filter((s) => !index.has(s));
      if (missing.length > 0) {
        for (const sku of missing) unknown.push({ sku, sourceIndex });
        return;
      }
      entries.push({
        sourceIndex,
        entry:
          line.type === "set"
            ? { type: "set", id: line.id, qty: line.qty, items: line.skus.map((sku) => ({ sku })) }
            : { type: "item", sku: line.sku, qty: line.qty },
      });
    });

    const quote = quoteCart({
      entries: entries.map((e) => e.entry),
      index,
      config,
      code: input.coupon ?? null,
      shippingMethodId: input.shippingMethod ?? null,
    });

    // Zapotrzebowanie zsumowane po wszystkich liniach: ten sam SKU w secie i osobno liczy sie razem.
    const demand = new Map<string, number>();
    for (const { entry } of entries) {
      for (const sku of entry.type === "set" ? entry.items.map((i) => i.sku) : [entry.sku]) {
        demand.set(sku, (demand.get(sku) ?? 0) + entry.qty);
      }
    }
    const shortages: QuoteComputation["shortages"] = [];
    for (const [sku, qty] of demand) {
      const stock = index.get(sku)?.variant.stock ?? 0;
      if (qty > stock) shortages.push({ sku, availableQty: stock });
    }
    const short = new Set(shortages.map((s) => s.sku));
    const problems: QuoteProblem[] = [
      ...unknown.map((u): QuoteProblem => ({ sku: u.sku, code: "unknown_sku" })),
      ...shortages.map((s): QuoteProblem => ({
        sku: s.sku,
        code: "out_of_stock",
        available_qty: s.availableQty,
      })),
    ];

    const nameOf = (sku: string): string => index.get(sku)?.product.name ?? sku;
    const stockOf = (sku: string): number => index.get(sku)?.variant.stock ?? 0;
    const lines = quote.lines.map((l) => {
      if (l.type === "set") {
        return {
          type: "set" as const,
          id: l.key,
          qty: l.qty,
          items: l.items.map((i) => ({
            sku: i.sku,
            name: nameOf(i.sku),
            price_gr: i.price,
            set_discount_gr: i.discount,
            stock: stockOf(i.sku),
            available: !short.has(i.sku),
          })),
          subtotal_gr: l.value,
          set_discount_gr: l.setDiscount,
          total_gr: l.total,
        };
      }
      return {
        type: "item" as const,
        sku: l.key,
        name: nameOf(l.key),
        qty: l.qty,
        price_gr: (l.items[0] as { price: number }).price,
        coupon_discount_gr: l.codeDiscount,
        stock: stockOf(l.key),
        available: !short.has(l.key),
      };
    });

    const code = (input.coupon ?? "").trim().toUpperCase();
    const codeType = config.codes.find((c) => c.code === code)?.type;
    const message = couponMessage(
      quote.codeStatus,
      codeType,
      quote.lines.some((l) => l.type === "set"),
    );
    // "od X": najtansza platna dostawa (odbior osobisty za 0 zl nie jest ceną wysylki; docs/16 par. 6.1: 12,99 zl).
    const paid = config.shippingMethods.map((m) => m.price).filter((p) => p > 0);
    const cheapest = Math.min(...paid);

    const response = respond(quoteResponseSchema, {
      currency: "PLN",
      lines,
      summary: {
        products_gr: quote.productsValue,
        set_discount_gr: quote.setDiscount,
        coupon_discount_gr: quote.codeDiscount,
        shipping_from_gr: Number.isFinite(cheapest) ? cheapest : 0,
        total_gr: quote.total,
        free_shipping_remaining_gr: quote.freeShippingRemaining,
      },
      coupon:
        quote.codeStatus === "none"
          ? null
          : { code, applied: message.applied, message_code: message.message },
      problems,
    });
    return { response, quote, entries, index, config, now, shortages, unknown };
  }
}
