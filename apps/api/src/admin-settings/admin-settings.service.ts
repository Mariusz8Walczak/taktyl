// B-400..B-408 (docs/15 par. 10, docs/16 par. 3.5, docs/17 par. 3.2, docs/14 par. 6): ustawienia sklepu w backpanelu.
// GET: pelne ustawienia razem z kodami i wylaczonymi pozycjami; PATCH (owner, If-Match): walidacja zakresow i spojnosci,
// audyt przed -> po (tylko zmienione sekcje) i znaczniki rewalidacji w jednej transakcji.
import { Inject, Injectable } from "@nestjs/common";
import type { Prisma } from "../prisma/client.js";
import type {
  adminSettingsSchema,
  ProblemFieldError,
  settingsPatchSchema,
} from "@taktyl/contracts";
import type { z } from "zod";
import { type AuditContext, AuditService } from "../audit/audit.service.js";
import { validationFailed } from "../common/app-exception.js";
import { BrandGuard } from "../common/brand-guard.js";
import { CLOCK, type Clock } from "../common/clock.js";
import { preconditionFailed } from "../common/if-match.js";
import { OutboxService } from "../outbox/outbox.service.js";
import { PrismaService } from "../prisma/prisma.service.js";
import {
  codeErrors,
  companyErrors,
  demoLabelErrors,
  pickupErrors,
  setDiscountErrors,
  shippingMethodErrors,
} from "./settings-rules.js";

type Patch = z.output<typeof settingsPatchSchema>;
type AdminSettings = z.input<typeof adminSettingsSchema>;

const dup = <T>(items: readonly T[], key: (i: T) => string): string[] => {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const i of items) {
    const k = key(i);
    if (seen.has(k)) out.push(k);
    seen.add(k);
  }
  return out;
};

@Injectable()
export class AdminSettingsService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(AuditService) private readonly audit: AuditService,
    @Inject(OutboxService) private readonly outbox: OutboxService,
    @Inject(BrandGuard) private readonly brands: BrandGuard,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  /** B-400..B-408: pelny odczyt (rowniez nieaktywne metody, kody z logika, punkty odbioru). */
  async get(
    client: Prisma.TransactionClient | PrismaService = this.prisma,
  ): Promise<AdminSettings> {
    const [s, shipping, payments, codes, points] = await Promise.all([
      client.shopSettings.findFirstOrThrow(),
      client.shippingMethod.findMany({ orderBy: { position: "asc" } }),
      client.paymentMethod.findMany({ orderBy: { position: "asc" } }),
      client.discountCode.findMany({ orderBy: { code: "asc" } }),
      client.pickupPoint.findMany({ orderBy: { id: "asc" } }),
    ]);
    return {
      currency: "PLN",
      locale: "pl-PL",
      timezone: "Europe/Warsaw",
      free_shipping_threshold_gr: s.freeShippingThresholdGr,
      set_discount: {
        percent: s.setDiscountPercent,
        categories: s.setDiscountCategories as AdminSettings["set_discount"]["categories"],
      },
      dispatch_cutoff_hour: s.dispatchCutoffHour,
      shipping_methods: shipping.map((m) => ({
        id: m.id as "automat" | "kurier" | "odbior",
        label: m.label,
        price_gr: m.priceGr,
        eta_business_days: m.etaBusinessDays,
        fields: m.fields as AdminSettings["shipping_methods"][number]["fields"],
        address: m.address,
        active: m.active,
      })),
      payment_methods: payments.map((p) => ({
        id: p.id as "blik" | "karta" | "przelew-online" | "przelew",
        label: p.label,
        active: p.active,
      })),
      discount_codes: codes.map((c) => ({
        code: c.code,
        type: c.type as "percent" | "free_shipping",
        value: c.value,
        scope: c.scope,
        label: c.label,
        active: c.active,
        valid_from: c.validFrom?.toISOString() ?? null,
        valid_to: c.validTo?.toISOString() ?? null,
      })),
      pickup_points: points.map((p) => ({
        id: p.id,
        city: p.city,
        label: p.label,
        active: p.active,
      })),
      returns_days: s.returnsDays,
      statutory_withdrawal_days: s.statutoryWithdrawalDays,
      payment_simulation: true,
      demo: {
        label: s.demoLabel,
        email_domain: "taktyl.example",
        phone: s.demoPhone,
      },
      company: s.company as Record<string, string>,
      version: s.version,
      updated_at: s.updatedAt.toISOString(),
    };
  }

  /** Teksty widoczne dla klienta nie moga zawierac nazw prawdziwych marek (regula 5; lista z env). */
  private brandErrors(path: string, text: string): ProblemFieldError[] {
    const found = this.brands.find(text);
    return found.length === 0
      ? []
      : [
          {
            path,
            code: "real_brand",
            message: 'W demonstracji uzywamy opisowych nazw, np. "Kurier".',
          },
        ];
  }

  /** B-400...B-408: zapis pod blokada wiersza, kontrola wersji (If-Match), walidacja calosci, audyt i outbox. */
  async patch(body: Patch, version: number, ctx: AuditContext): Promise<AdminSettings> {
    await this.audit.withAudit(ctx, async (tx, audit) => {
      const locked = await tx.$queryRaw<{ version: number }[]>`
        SELECT version FROM shop_settings FOR UPDATE`;
      if (!locked[0]) throw new Error("Brak wiersza ustawien sklepu");
      if (locked[0].version !== version) throw preconditionFailed();
      const before = await this.get(tx);

      const errors: ProblemFieldError[] = [];
      const beforeSections: Record<string, unknown> = {};
      const afterSections: Record<string, unknown> = {};
      const changed = (key: string, from: unknown, to: unknown): boolean => {
        if (JSON.stringify(from) === JSON.stringify(to)) return false;
        beforeSections[key] = from;
        afterSections[key] = to;
        return true;
      };
      const data: Prisma.ShopSettingsUpdateInput = {};
      const writes: Array<() => Promise<unknown>> = [];
      let setDiscountChanged = false;

      if (body.set_discount) {
        errors.push(...setDiscountErrors(body.set_discount.categories));
        const next = {
          percent: body.set_discount.percent,
          categories: [...body.set_discount.categories].sort(),
        };
        const prev = {
          percent: before.set_discount.percent,
          categories: [...before.set_discount.categories].sort(),
        };
        if (changed("set_discount", prev, next)) {
          setDiscountChanged = true;
          data.setDiscountPercent = next.percent;
          data.setDiscountCategories = next.categories;
        }
      }
      if (body.free_shipping_threshold_gr !== undefined) {
        if (
          changed(
            "free_shipping_threshold_gr",
            before.free_shipping_threshold_gr,
            body.free_shipping_threshold_gr,
          )
        ) {
          data.freeShippingThresholdGr = body.free_shipping_threshold_gr;
        }
      }
      if (body.dispatch_cutoff_hour !== undefined) {
        if (
          changed("dispatch_cutoff_hour", before.dispatch_cutoff_hour, body.dispatch_cutoff_hour)
        ) {
          data.dispatchCutoffHour = body.dispatch_cutoff_hour;
        }
      }
      if (body.demo) {
        errors.push(
          ...demoLabelErrors(body.demo.label),
          ...this.brandErrors("demo.label", body.demo.label),
        );
        if (changed("demo", { label: before.demo.label }, { label: body.demo.label.trim() })) {
          data.demoLabel = body.demo.label.trim();
        }
      }
      if (body.company) {
        errors.push(...companyErrors(body.company));
        for (const [k, v] of Object.entries(body.company))
          errors.push(...this.brandErrors(`company.${k}`, v));
        if (changed("company", before.company, body.company)) data.company = body.company;
      }

      if (body.shipping_methods) {
        const items = body.shipping_methods;
        for (const id of dup(items, (m) => m.id)) {
          errors.push({
            path: "shipping_methods",
            code: "duplicate",
            message: `Metoda ${id} wystepuje dwa razy.`,
          });
        }
        items.forEach((m, i) => {
          errors.push(
            ...shippingMethodErrors(i, m),
            ...this.brandErrors(`shipping_methods[${i}].label`, m.label),
          );
          if (m.address)
            errors.push(...this.brandErrors(`shipping_methods[${i}].address`, m.address));
        });
        const merged = before.shipping_methods.map(
          (cur) => items.find((m) => m.id === cur.id) ?? cur,
        );
        if (!merged.some((m) => m.active)) {
          errors.push({
            path: "shipping_methods",
            code: "no_active_method",
            message: "Co najmniej jedna metoda dostawy musi byc aktywna.",
          });
        }
        const normalized = items.map((m) => ({ ...m, label: m.label.trim() }));
        const fromRows = normalized.map(
          (m) => before.shipping_methods.find((c) => c.id === m.id) ?? null,
        );
        if (changed("shipping_methods", fromRows, normalized)) {
          const position = before.shipping_methods.length;
          normalized.forEach((m, i) => {
            writes.push(() =>
              tx.shippingMethod.upsert({
                where: { id: m.id },
                update: {
                  label: m.label,
                  priceGr: m.price_gr,
                  etaBusinessDays: m.eta_business_days,
                  fields: m.fields,
                  address: m.address,
                  active: m.active,
                },
                create: {
                  id: m.id,
                  label: m.label,
                  priceGr: m.price_gr,
                  etaBusinessDays: m.eta_business_days,
                  fields: m.fields,
                  address: m.address,
                  active: m.active,
                  position: position + i + 1,
                },
              }),
            );
          });
        }
      }

      if (body.payment_methods) {
        const items = body.payment_methods;
        for (const id of dup(items, (m) => m.id)) {
          errors.push({
            path: "payment_methods",
            code: "duplicate",
            message: `Metoda ${id} wystepuje dwa razy.`,
          });
        }
        items.forEach((m, i) =>
          errors.push(...this.brandErrors(`payment_methods[${i}].label`, m.label)),
        );
        const known = new Set(before.payment_methods.map((p) => p.id));
        items.forEach((m, i) => {
          if (!known.has(m.id))
            errors.push({
              path: `payment_methods[${i}].id`,
              code: "unknown",
              message: "Nieznana metoda platnosci.",
            });
        });
        const merged = before.payment_methods.map(
          (cur) => items.find((m) => m.id === cur.id) ?? cur,
        );
        if (!merged.some((m) => m.active)) {
          errors.push({
            path: "payment_methods",
            code: "no_active_method",
            message: "Co najmniej jedna metoda platnosci musi byc aktywna.",
          });
        }
        const normalized = items.map((m) => ({ ...m, label: m.label.trim() }));
        const fromRows = normalized.map(
          (m) => before.payment_methods.find((c) => c.id === m.id) ?? null,
        );
        if (changed("payment_methods", fromRows, normalized)) {
          for (const m of normalized) {
            writes.push(() =>
              tx.paymentMethod.updateMany({
                where: { id: m.id },
                data: { label: m.label, active: m.active },
              }),
            );
          }
        }
      }

      if (body.discount_codes) {
        const items = body.discount_codes;
        for (const code of dup(items, (c) => c.code)) {
          errors.push({
            path: "discount_codes",
            code: "duplicate_code",
            message: `Kod ${code} juz istnieje.`,
          });
        }
        items.forEach((c, i) => {
          errors.push(
            ...codeErrors(i, c),
            ...this.brandErrors(`discount_codes[${i}].label`, c.label),
          );
        });
        if (changed("discount_codes", before.discount_codes, items)) {
          writes.push(async () => {
            await tx.discountCode.deleteMany({
              where: { code: { notIn: items.map((c) => c.code) } },
            });
            for (const c of items) {
              const row = {
                type: c.type,
                value: c.value,
                scope: c.scope,
                label: c.label,
                active: c.active,
                validFrom: c.valid_from ? new Date(c.valid_from) : null,
                validTo: c.valid_to ? new Date(c.valid_to) : null,
              };
              await tx.discountCode.upsert({
                where: { code: c.code },
                update: row,
                create: { code: c.code, ...row },
              });
            }
          });
        }
      }

      if (body.pickup_points) {
        const items = body.pickup_points;
        for (const id of dup(items, (p) => p.id)) {
          errors.push({
            path: "pickup_points",
            code: "duplicate",
            message: `Punkt ${id} wystepuje dwa razy.`,
          });
        }
        items.forEach((p, i) =>
          errors.push(
            ...pickupErrors(i, p),
            ...this.brandErrors(`pickup_points[${i}].label`, p.label),
          ),
        );
        const normalized = items.map((p) => ({
          id: p.id,
          city: p.city.trim(),
          label: p.label.trim(),
          active: p.active,
        }));
        if (changed("pickup_points", before.pickup_points, normalized)) {
          writes.push(async () => {
            await tx.pickupPoint.deleteMany({
              where: { id: { notIn: normalized.map((p) => p.id) } },
            });
            for (const p of normalized) {
              await tx.pickupPoint.upsert({
                where: { id: p.id },
                update: { city: p.city, label: p.label, active: p.active },
                create: p,
              });
            }
          });
        }
      }

      if (errors.length > 0) throw validationFailed(errors);
      if (Object.keys(afterSections).length === 0) return;

      for (const write of writes) await write();
      await tx.shopSettings.updateMany({
        data: {
          ...(data as Prisma.ShopSettingsUpdateManyMutationInput),
          version: { increment: 1 },
          updatedAt: this.clock(),
        },
      });
      const auditId = await audit({
        action: "settings.update",
        entity: "settings",
        entityId: "default",
        before: beforeSections,
        after: afterSections,
      });
      // docs/14 par. 6: ustawienia -> `shop-settings`; rabat setu zmienia ceny gotowych setow -> `presets` i `catalog` (docs/15 par. 10.1).
      await this.outbox.enqueueTags(
        tx,
        setDiscountChanged ? ["shop-settings", "presets", "catalog"] : ["shop-settings"],
        auditId,
      );
    });
    return this.get();
  }
}
