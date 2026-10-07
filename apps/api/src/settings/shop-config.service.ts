// F-152, F-153, F-155, F-065 (B-215): konfiguracja sklepu z bazy jako ShopConfig domeny (kwoty w groszach).
import { Inject, Injectable } from "@nestjs/common";
import type { ShopConfig } from "@taktyl/domain";
import { PrismaService } from "../prisma/prisma.service.js";

@Injectable()
export class ShopConfigService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async load(now: Date): Promise<ShopConfig> {
    const [settings, methods, codes] = await Promise.all([
      this.prisma.shopSettings.findFirstOrThrow(),
      this.prisma.shippingMethod.findMany({
        where: { active: true },
        orderBy: { position: "asc" },
      }),
      this.prisma.discountCode.findMany({ where: { active: true } }),
    ]);
    return {
      timeZone: settings.timezone,
      freeShippingThreshold: settings.freeShippingThresholdGr,
      setDiscount: {
        percent: settings.setDiscountPercent,
        requiresCategories: settings.setDiscountCategories,
      },
      shippingMethods: methods.map((m) => ({
        id: m.id,
        label: m.label,
        price: m.priceGr,
        etaBusinessDays: m.etaBusinessDays,
      })),
      dispatchCutoffHour: settings.dispatchCutoffHour,
      codes: codes
        .filter(
          (c) =>
            (c.validFrom === null || c.validFrom <= now) &&
            (c.validTo === null || c.validTo >= now),
        )
        .map((c) => ({
          code: c.code,
          type: c.type as "percent" | "free_shipping",
          value: c.value ?? 0,
        })),
    };
  }
}
