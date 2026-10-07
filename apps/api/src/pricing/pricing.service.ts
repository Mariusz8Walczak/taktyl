// B-214 (docs/17 par. 5, ADR-0005): serwis cen - lowest_30d z price_history. Zadnego recznego pola.
import { Inject, Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service.js";
import { computePromotion, type PriceRow } from "@taktyl/domain";

@Injectable()
export class PricingService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  /** Okno promocji z ustawien sklepu (domyslnie 30 dni). */
  async promoWindowDays(): Promise<number> {
    const s = await this.prisma.shopSettings.findFirst({ select: { promoWindowDays: true } });
    return s?.promoWindowDays ?? 30;
  }

  /** SKU -> lowest_30d w groszach (tylko SKU w promocji). `skus` puste = wszystkie. */
  async lowest30dBySku(now: Date, skus?: readonly string[]): Promise<Map<string, number>> {
    const [windowDays, rows] = await Promise.all([
      this.promoWindowDays(),
      this.prisma.priceHistory.findMany({
        where: skus && skus.length > 0 ? { sku: { in: [...skus] } } : {},
        select: { sku: true, priceGr: true, validFrom: true, validTo: true },
        orderBy: [{ sku: "asc" }, { validFrom: "asc" }],
      }),
    ]);
    const bySku = new Map<string, PriceRow[]>();
    for (const r of rows) {
      const list = bySku.get(r.sku) ?? [];
      list.push({ priceGr: r.priceGr, validFrom: r.validFrom, validTo: r.validTo });
      bySku.set(r.sku, list);
    }
    const out = new Map<string, number>();
    for (const [sku, list] of bySku) {
      const info = computePromotion(list, now, windowDays);
      if (info.lowest30dGr !== null) out.set(sku, info.lowest30dGr);
    }
    return out;
  }
}
