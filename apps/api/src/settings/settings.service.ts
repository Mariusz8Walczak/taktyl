// F-001, F-009, F-073, F-153, F-065, F-172, F-101 (docs/16 par. 2): ustawienia publiczne, termin wysylki, punkty odbioru, reguly.
import { Inject, Injectable } from "@nestjs/common";
import {
  pickupPointsResponseSchema,
  publicShopSettingsSchema,
  rulesSchema,
  shippingEstimateResponseSchema,
  type PublicShopSettings,
} from "@taktyl/contracts";
import { computeDispatch, normalizeSearchText } from "@taktyl/domain";
import type { z } from "zod";
import { notFound } from "../common/app-exception.js";
import { CLOCK, type Clock } from "../common/clock.js";
import { respond } from "../common/zod.pipe.js";
import { PrismaService } from "../prisma/prisma.service.js";

@Injectable()
export class SettingsService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  async shopSettings(): Promise<PublicShopSettings> {
    const [s, shipping, payments, codes, points] = await Promise.all([
      this.prisma.shopSettings.findFirstOrThrow(),
      this.prisma.shippingMethod.findMany({
        where: { active: true },
        orderBy: { position: "asc" },
      }),
      this.prisma.paymentMethod.findMany({ where: { active: true }, orderBy: { position: "asc" } }),
      this.prisma.discountCode.findMany({ where: { active: true }, orderBy: { code: "asc" } }),
      this.prisma.pickupPoint.findMany({ where: { active: true }, orderBy: { id: "asc" } }),
    ]);
    return respond(publicShopSettingsSchema, {
      currency: s.currency,
      locale: s.locale,
      timezone: s.timezone,
      free_shipping_threshold_gr: s.freeShippingThresholdGr,
      set_discount: { percent: s.setDiscountPercent, categories: s.setDiscountCategories },
      dispatch_cutoff_hour: s.dispatchCutoffHour,
      shipping_methods: shipping.map((m) => ({
        id: m.id,
        label: m.label,
        price_gr: m.priceGr,
        eta_business_days: m.etaBusinessDays,
        fields: m.fields,
        address: m.address,
      })),
      payment_methods: payments.map((p) => ({ id: p.id, label: p.label })),
      // Kody: tylko etykiety, bez logiki (docs/16 par. 2).
      discount_codes: codes.map((c) => ({ code: c.code, label: c.label })),
      pickup_points: points.map((p) => ({ id: p.id, city: p.city, label: p.label })),
      returns_days: s.returnsDays,
      statutory_withdrawal_days: s.statutoryWithdrawalDays,
      payment_simulation: s.paymentSimulation,
      demo: { label: s.demoLabel, email_domain: s.demoEmailDomain, phone: s.demoPhone },
      company: s.company,
    });
  }

  /** F-065: termin liczy domena w strefie z ustawien (zegar wstrzykiwany). */
  async shippingEstimate(
    methodId: string,
  ): Promise<z.output<typeof shippingEstimateResponseSchema>> {
    const [s, method] = await Promise.all([
      this.prisma.shopSettings.findFirstOrThrow(),
      this.prisma.shippingMethod.findFirst({ where: { id: methodId, active: true } }),
    ]);
    if (!method) throw notFound("Nieznana metoda dostawy.");
    const now = this.clock();
    const info = computeDispatch(now, {
      cutoffHour: s.dispatchCutoffHour,
      timeZone: s.timezone,
      etaBusinessDays: method.etaBusinessDays,
    });
    return respond(shippingEstimateResponseSchema, {
      method: method.id,
      dispatch_date: info.dispatchIso,
      delivery_date: info.deliveryIso,
      dispatches_today: info.shipsToday,
      computed_at: now.toISOString(),
    });
  }

  /** F-172: `?city=` bez rozrozniania wielkosci liter i polskich znakow (ta sama normalizacja co wyszukiwanie). */
  async pickupPoints(city?: string): Promise<z.output<typeof pickupPointsResponseSchema>> {
    const points = await this.prisma.pickupPoint.findMany({
      where: { active: true },
      orderBy: { id: "asc" },
    });
    const wanted = city === undefined ? null : normalizeSearchText(city.trim());
    return respond(pickupPointsResponseSchema, {
      items: points
        .filter((p) => wanted === null || normalizeSearchText(p.city) === wanted)
        .map((p) => ({ id: p.id, city: p.city, label: p.label })),
    });
  }

  /** F-101, F-104: reguly dopasowania z bazy (rules.json). */
  async rules(): Promise<z.output<typeof rulesSchema>> {
    const r = await this.prisma.ruleSettings.findFirstOrThrow();
    return respond(rulesSchema, {
      units: r.units,
      profiles: r.profiles,
      no_profile: r.noProfile,
      gap_keyboard_mouse_mm: r.gapKeyboardMouseMm,
      edge_margin_mm: r.edgeMarginMm,
      checks: r.checks,
    });
  }
}
