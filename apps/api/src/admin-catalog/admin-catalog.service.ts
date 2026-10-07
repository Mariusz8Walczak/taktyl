// B-100...B-111, B-113 (docs/15 par. 7, docs/16 par. 3.2, docs/17 par. 3.3, par. 5, docs/14 par. 6): katalog w backpanelu.
// Lista z filtrami, szczegoly, PATCH produktu, tworzenie produktu i wariantu, zmiana ceny (nowy wiersz price_history, nigdy
// UPDATE historii), stan z ruchem magazynowym, archiwizacja, twarde usuwanie bez zamowien. Kazda mutacja: wpis audit_log
// (przed -> po) i wiersz outbox ze znacznikami z docs/14 par. 6 w TEJ SAMEJ transakcji; wspolbieznosc przez If-Match.
import { Inject, Injectable } from "@nestjs/common";
import { Prisma } from "../prisma/client.js";
import type {
  adminProductListQuerySchema,
  CategoryId,
  ProblemFieldError,
  productCreateSchema,
  productPatchSchema,
  Role,
  setPriceRequestSchema,
  setStockRequestSchema,
  variantCreateSchema,
  variantPatchSchema,
} from "@taktyl/contracts";
import { normalizeSearchText } from "@taktyl/domain";
import type { z } from "zod";
import { type AuditContext, AuditService } from "../audit/audit.service.js";
import { AppException, notFound, validationFailed } from "../common/app-exception.js";
import { CLOCK, type Clock } from "../common/clock.js";
import { preconditionFailed } from "../common/if-match.js";
import { maskEmail } from "../common/pii-mask.js";
import { OutboxService, stockTags } from "../outbox/outbox.service.js";
import { priceTags, productCreatedTags, productTags, reviewTags } from "../outbox/tags.js";
import { computePromotion, type PriceRow } from "../pricing/lowest30d.js";
import { PricingService } from "../pricing/pricing.service.js";
import { PrismaService } from "../prisma/prisma.service.js";
import {
  changedFields,
  gpsrErrors,
  LOW_STOCK_MAX,
  mergeAttributes,
  optionsErrors,
  productIdErrors,
  skuErrors,
  variantShapeErrors,
} from "./product-rules.js";

type ListQuery = z.output<typeof adminProductListQuerySchema>;
type ProductCreate = z.output<typeof productCreateSchema>;
type ProductPatch = z.output<typeof productPatchSchema>;
type VariantCreate = z.output<typeof variantCreateSchema>;
type VariantPatch = z.output<typeof variantPatchSchema>;
type PriceBody = z.output<typeof setPriceRequestSchema>;
type StockBody = z.output<typeof setStockRequestSchema>;

export interface Warning {
  code: "in_presets" | "default_variant_out_of_stock";
  message: string;
  details?: string[];
}

const DAY_MS = 86_400_000;

/** Sortowanie listy: klucze z docs/15 par. 7.1 (naglowki kolumn). */
const LIST_SORT = [
  "name",
  "category",
  "variant_count",
  "from_price_gr",
  "total_stock",
  "status",
  "updated_at",
] as const;

const isUniqueViolation = (e: unknown): boolean =>
  e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002";

const conflict = (path: string, code: string, message: string): AppException =>
  new AppException(409, "conflict", message, [{ path, code, message }]);

type ProductWithRelations = Prisma.ProductGetPayload<{
  include: { variants: true; images: true };
}>;

@Injectable()
export class AdminCatalogService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(AuditService) private readonly audit: AuditService,
    @Inject(OutboxService) private readonly outbox: OutboxService,
    @Inject(PricingService) private readonly pricing: PricingService,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  // ------------------------------------------------------------------ odczyt

  /** B-100, B-101: lista z filtrami (kategoria, status, brak zdjec, niski stan, promocja) i szukaniem po nazwie lub SKU. */
  async list(query: ListQuery) {
    const sortMatch = /^(-)?([a-z_]+)$/.exec(query.sort);
    const key = sortMatch?.[2] as (typeof LIST_SORT)[number] | undefined;
    if (!sortMatch || !key || !LIST_SORT.includes(key)) {
      throw validationFailed(
        [{ path: "sort", code: "invalid_sort", message: `Dozwolone: ${LIST_SORT.join(", ")}.` }],
        400,
      );
    }
    const now = this.clock();
    const [products, lowest, missing] = await Promise.all([
      this.prisma.product.findMany({
        where: {
          ...(query.category ? { categoryId: query.category } : {}),
          ...(query.status ? { status: query.status } : {}),
        },
        include: { variants: true },
      }),
      this.pricing.lowest30dBySku(now),
      this.prisma.productImage.groupBy({
        by: ["productId"],
        where: { status: "brak" },
        _count: { _all: true },
      }),
    ]);
    const missingBy = new Map(missing.map((m) => [m.productId, m._count._all]));
    const wanted = query.q ? normalizeSearchText(query.q.trim()) : null;

    const rows = products
      .map((p) => {
        const active = p.variants.filter((v) => v.status === "active");
        const prices = active.map((v) => v.priceGr);
        return {
          p,
          row: {
            id: p.id,
            slug: p.slug,
            category: p.categoryId as CategoryId,
            name: p.name,
            status: p.status as "active" | "archived",
            variant_count: p.variants.length,
            from_price_gr: prices.length > 0 ? Math.min(...prices) : 0,
            total_stock: p.variants.reduce((s, v) => s + v.stock, 0),
            missing_images: missingBy.get(p.id) ?? 0,
            badges: p.badges as ("nowosc" | "bestseller")[],
            on_sale: active.some((v) => lowest.has(v.sku)),
            version: p.version,
            updated_at: p.updatedAt.toISOString(),
          },
        };
      })
      .filter(({ p, row }) => {
        if (query.missing_image && row.missing_images === 0) return false;
        if (query.low_stock && !p.variants.some((v) => v.stock <= LOW_STOCK_MAX)) return false;
        if (query.promo && !row.on_sale) return false;
        if (wanted) {
          const haystack = [p.name, p.slug, p.id, ...p.variants.map((v) => v.sku)].map(
            normalizeSearchText,
          );
          if (!haystack.some((h) => h.includes(wanted))) return false;
        }
        return true;
      });

    const dir = sortMatch[1] ? -1 : 1;
    rows.sort((a, b) => {
      const x = a.row[key];
      const y = b.row[key];
      const cmp =
        typeof x === "number" && typeof y === "number"
          ? x - y
          : String(x).localeCompare(String(y), "pl");
      return (cmp || a.row.id.localeCompare(b.row.id)) * dir;
    });
    const start = (query.page - 1) * query.per_page;
    return {
      items: rows.slice(start, start + query.per_page).map((r) => r.row),
      page: query.page,
      per_page: query.per_page,
      total: rows.length,
    };
  }

  /** B-102, B-105: pelny widok produktu do edycji; lowest_30d_gr wylicza serwer (tylko do odczytu). */
  async detail(id: string, warnings: Warning[] = []) {
    const p = await this.prisma.product.findUnique({
      where: { id },
      include: { variants: { orderBy: { sku: "asc" } }, images: { orderBy: { key: "asc" } } },
    });
    if (!p) throw notFound("Nie znaleziono produktu.");
    const lowest = await this.pricing.lowest30dBySku(
      this.clock(),
      p.variants.map((v) => v.sku),
    );
    return this.toDetail(p, lowest, [...warnings, ...this.defaultVariantWarnings(p)]);
  }

  private toDetail(p: ProductWithRelations, lowest: Map<string, number>, warnings: Warning[]) {
    return {
      id: p.id,
      slug: p.slug,
      category: p.categoryId,
      name: p.name,
      brand: p.brand,
      short: p.short,
      description: p.description,
      options: p.options,
      default_variant_sku: p.defaultVariantSku ?? p.variants[0]?.sku ?? null,
      badges: p.badges,
      fit: p.fit,
      in_box: p.inBox,
      gpsr: p.gpsr,
      attributes: p.attributes,
      status: p.status,
      version: p.version,
      updated_at: p.updatedAt.toISOString(),
      variants: p.variants.map((v) => ({
        sku: v.sku,
        color: v.colorId,
        switch: v.switchId,
        size: v.sizeKey,
        price_gr: v.priceGr,
        lowest_30d_gr: lowest.get(v.sku) ?? null,
        stock: v.stock,
        images_key: v.imagesKey,
        status: v.status,
        regular_price_gr: v.regularPriceGr,
        version: v.version,
      })),
      images: p.images.map((i) => ({
        key: i.key,
        kind: i.kind,
        shot: i.shot,
        description: i.description,
        status: i.status,
        files: i.files,
      })),
      warnings,
    };
  }

  /** B-103: domyslny wariant bez stanu przy dostepnym innym - ostrzezenie, nie blokada. */
  private defaultVariantWarnings(p: ProductWithRelations): Warning[] {
    const def = p.variants.find((v) => v.sku === (p.defaultVariantSku ?? p.variants[0]?.sku));
    if (!def || def.stock > 0) return [];
    return p.variants.some((v) => v.status === "active" && v.stock > 0)
      ? [
          {
            code: "default_variant_out_of_stock",
            message: "Domyslny wariant nie ma stanu, a inny wariant jest dostepny.",
            details: [def.sku],
          },
        ]
      : [];
  }

  // ------------------------------------------------------------------ produkt

  /** B-111: nowy produkt. Bez wariantow jest `archived` (ukryty) do czasu dodania pierwszego wariantu (API-011). */
  async createProduct(body: ProductCreate, ctx: AuditContext) {
    const errors = [
      ...productIdErrors(body.category, body.id),
      ...optionsErrors(body.category, body.options),
      ...gpsrErrors(body.gpsr),
    ];
    const attrs = mergeAttributes(body.category, {}, body.attributes);
    if (!attrs.ok) errors.push(...attrs.errors);
    if (errors.length > 0) throw validationFailed(errors);
    const attributes = attrs.ok ? attrs.value : {};

    try {
      await this.audit.withAudit(ctx, async (tx, audit) => {
        const clash = await tx.product.findFirst({
          where: { OR: [{ id: body.id }, { slug: body.slug }] },
          select: { id: true, slug: true },
        });
        if (clash) {
          throw clash.slug === body.slug
            ? conflict("slug", "slug_taken", "Ten adres jest juz uzywany. Wybierz inny.")
            : conflict("id", "id_taken", "Produkt o tym identyfikatorze juz istnieje.");
        }
        await tx.product.create({
          data: {
            id: body.id,
            slug: body.slug,
            categoryId: body.category,
            name: body.name,
            short: body.short,
            attributes: attributes as Prisma.InputJsonValue,
            options: body.options,
            badges: body.badges,
            fit: body.fit,
            inBox: body.in_box,
            gpsr: body.gpsr,
            status: "archived",
            createdAt: this.clock(),
            updatedAt: this.clock(),
          },
        });
        const auditId = await audit({
          action: "product.create",
          entity: "product",
          entityId: body.id,
          after: { id: body.id, slug: body.slug, category: body.category, name: body.name },
        });
        await this.outbox.enqueueTags(
          tx,
          productCreatedTags({ slug: body.slug, categoryId: body.category }),
          auditId,
        );
      });
    } catch (e) {
      if (isUniqueViolation(e))
        throw conflict("slug", "slug_taken", "Ten adres jest juz uzywany. Wybierz inny.");
      throw e;
    }
    return this.detail(body.id);
  }

  /** B-102, B-109, B-110: edycja produktu pod blokada wiersza i kontrola wersji (If-Match). */
  async patchProduct(id: string, body: ProductPatch, version: number, ctx: AuditContext) {
    let warnings: Warning[];
    try {
      warnings = await this.audit.withAudit(ctx, async (tx, audit) => {
        const locked = await tx.$queryRaw<{ version: number }[]>`
          SELECT version FROM products WHERE id = ${id} FOR UPDATE`;
        if (!locked[0]) throw notFound("Nie znaleziono produktu.");
        if (locked[0].version !== version) throw preconditionFailed();
        const p = await tx.product.findUniqueOrThrow({
          where: { id },
          include: { variants: true },
        });
        const category = p.categoryId as CategoryId;
        const errors: ProblemFieldError[] = [];
        const data: Prisma.ProductUpdateInput = {};
        const beforeView: Record<string, unknown> = {};
        const afterView: Record<string, unknown> = {};
        const set = <K extends string>(field: K, from: unknown, to: unknown): void => {
          beforeView[field] = from;
          afterView[field] = to;
        };

        if (body.name !== undefined) {
          data.name = body.name;
          set("name", p.name, body.name);
        }
        if (body.short !== undefined) {
          data.short = body.short;
          set("short", p.short, body.short);
        }
        if (body.badges !== undefined) {
          data.badges = [...new Set(body.badges)];
          set("badges", p.badges, data.badges);
        }
        if (body.fit !== undefined) {
          data.fit = body.fit;
          set("fit", p.fit, body.fit);
        }
        if (body.in_box !== undefined) {
          data.inBox = body.in_box;
          set("in_box", p.inBox, body.in_box);
        }
        if (body.gpsr !== undefined) {
          errors.push(...gpsrErrors(body.gpsr));
          data.gpsr = body.gpsr;
          set("gpsr", p.gpsr, body.gpsr);
        }
        if (body.attributes !== undefined) {
          const merged = mergeAttributes(
            category,
            p.attributes as Record<string, unknown>,
            body.attributes,
          );
          if (merged.ok) {
            data.attributes = merged.value as Prisma.InputJsonValue;
            set("attributes", p.attributes, merged.value);
          } else errors.push(...merged.errors);
        }
        if (body.slug !== undefined && body.slug !== p.slug) {
          const taken = await tx.product.findFirst({
            where: { slug: body.slug },
            select: { id: true },
          });
          if (taken)
            throw conflict("slug", "slug_taken", "Ten adres jest juz uzywany. Wybierz inny.");
          data.slug = body.slug;
          set("slug", p.slug, body.slug);
        }
        if (body.default_variant_sku !== undefined) {
          const v = p.variants.find((x) => x.sku === body.default_variant_sku);
          if (!v || v.status !== "active") {
            errors.push({
              path: "default_variant_sku",
              code: "unknown_variant",
              message: "Domyslny wariant musi byc aktywnym wariantem tego produktu.",
            });
          } else {
            data.defaultVariant = { connect: { sku: v.sku } };
            set("default_variant_sku", p.defaultVariantSku, v.sku);
          }
        }
        if (body.status !== undefined) {
          if (body.status === "active" && !p.variants.some((v) => v.status === "active")) {
            errors.push({
              path: "status",
              code: "no_active_variant",
              message: "Aktywny produkt musi miec co najmniej jeden aktywny wariant.",
            });
          }
          data.status = body.status;
          set("status", p.status, body.status);
        }
        if (errors.length > 0) throw validationFailed(errors);

        const diff = changedFields(beforeView, afterView);
        if (Object.keys(diff.after).length === 0) return [];

        await tx.product.update({
          where: { id },
          data: { ...data, version: { increment: 1 }, updatedAt: this.clock() },
        });
        const auditId = await audit({
          action: "product.update",
          entity: "product",
          entityId: id,
          before: diff.before,
          after: diff.after,
        });
        const tags = new Set([
          ...productTags({ slug: p.slug, categoryId: p.categoryId }),
          ...reviewTags({ slug: p.slug, categoryId: p.categoryId }),
        ]);
        if (typeof data.slug === "string") {
          for (const t of [
            ...productTags({ slug: data.slug, categoryId: p.categoryId }),
            ...reviewTags({ slug: data.slug, categoryId: p.categoryId }),
          ])
            tags.add(t);
        }
        await this.outbox.enqueueTags(tx, [...tags], auditId);
        const touchesAvailability = body.status !== undefined;
        return touchesAvailability
          ? this.presetWarningsInTx(
              tx,
              p.variants.map((v) => v.sku),
            )
          : [];
      });
    } catch (e) {
      if (isUniqueViolation(e))
        throw conflict("slug", "slug_taken", "Ten adres jest juz uzywany. Wybierz inny.");
      throw e;
    }
    return this.detail(id, warnings);
  }

  /** B-113: gotowe sety, ktorych ceny lub dostepnosc zmieniaja sie razem z wariantami (odczyt w transakcji). */
  private async presetWarningsInTx(
    tx: Prisma.TransactionClient,
    skus: readonly string[],
  ): Promise<Warning[]> {
    const items = await tx.presetItem.findMany({
      where: { sku: { in: [...skus] } },
      select: { presetId: true },
    });
    const ids = [...new Set(items.map((i) => i.presetId))].sort();
    return ids.length === 0
      ? []
      : [
          {
            code: "in_presets",
            message: `Ten produkt jest w gotowych setach: ${ids.length}. Ich ceny zmienia sie razem z nim.`,
            details: ids,
          },
        ];
  }

  /** B-110: twarde usuniecie tylko bez zamowien i bez udzialu w gotowych setach; inaczej 409 (uzyj archiwizacji). */
  async deleteProduct(id: string, ctx: AuditContext): Promise<void> {
    await this.audit.withAudit(ctx, async (tx, audit) => {
      const p = await tx.product.findUnique({ where: { id }, include: { variants: true } });
      if (!p) throw notFound("Nie znaleziono produktu.");
      const skus = p.variants.map((v) => v.sku);
      await this.assertDeletable(tx, skus, "Produkt ma zamowienia. Zarchiwizuj go zamiast usuwac.");
      await tx.$executeRaw`SELECT set_config('taktyl.catalog_purge', 'on', true)`;
      await tx.product.update({ where: { id }, data: { defaultVariant: { disconnect: true } } });
      await tx.stockMovement.deleteMany({ where: { sku: { in: skus } } });
      await tx.priceHistory.deleteMany({ where: { sku: { in: skus } } });
      await tx.variant.deleteMany({ where: { productId: id } });
      await tx.productImage.deleteMany({ where: { productId: id } });
      await tx.product.delete({ where: { id } });
      const ref = { slug: p.slug, categoryId: p.categoryId };
      const auditId = await audit({
        action: "product.delete",
        entity: "product",
        entityId: id,
        before: {
          id,
          slug: p.slug,
          category: p.categoryId,
          name: p.name,
          status: p.status,
          skus,
        },
      });
      await this.outbox.enqueueTags(tx, [...productTags(ref), ...reviewTags(ref)], auditId);
    });
  }

  private async assertDeletable(
    tx: Prisma.TransactionClient,
    skus: readonly string[],
    ordersMessage: string,
  ): Promise<void> {
    if (skus.length === 0) return;
    if ((await tx.orderItem.count({ where: { sku: { in: [...skus] } } })) > 0) {
      throw conflict("id", "has_orders", ordersMessage);
    }
    if ((await tx.presetItem.count({ where: { sku: { in: [...skus] } } })) > 0) {
      throw conflict(
        "id",
        "in_presets",
        "Pozycja jest w gotowym secie. Najpierw zmien sklad setu albo zarchiwizuj produkt.",
      );
    }
  }

  // ------------------------------------------------------------------ wariant

  /** B-111, B-103: nowy wariant (SKU wg wzoru kategorii i kodow); pierwszy wariant staje sie domyslnym. */
  async createVariant(productId: string, body: VariantCreate, ctx: AuditContext) {
    let warnings: Warning[];
    try {
      warnings = await this.audit.withAudit(ctx, async (tx, audit) => {
        const p = await tx.product.findUnique({ where: { id: productId } });
        if (!p) throw notFound("Nie znaleziono produktu.");
        const category = p.categoryId as CategoryId;
        const [color, sw] = await Promise.all([
          tx.color.findUnique({ where: { id: body.color } }),
          body.switch ? tx.switch.findUnique({ where: { id: body.switch } }) : null,
        ]);
        const errors = [
          ...variantShapeErrors(category, body),
          ...(color ? [] : [{ path: "color", code: "unknown", message: "Nieznany kolor." }]),
          ...(body.switch && !sw
            ? [{ path: "switch", code: "unknown", message: "Nieznany przelacznik." }]
            : []),
          ...(body.images_key !== body.color
            ? [
                {
                  path: "images_key",
                  code: "invalid_images_key",
                  message: "Klucz zdjec wariantu to identyfikator jego koloru.",
                },
              ]
            : []),
        ];
        if (color && errors.length === 0) {
          errors.push(
            ...skuErrors(category, body.sku, {
              colorCode: color.code,
              switchCode: sw?.code ?? null,
              size: body.size ?? null,
            }),
          );
        }
        if (errors.length > 0) throw validationFailed(errors);

        if (await tx.variant.findUnique({ where: { sku: body.sku }, select: { sku: true } })) {
          throw conflict("sku", "sku_taken", "Ten SKU jest juz zajety.");
        }
        const twin = await tx.variant.findFirst({
          where: {
            productId,
            colorId: body.color,
            switchId: body.switch ?? null,
            sizeKey: body.size ?? null,
          },
          select: { sku: true },
        });
        if (twin) {
          throw conflict("sku", "variant_exists", `Taka kombinacja ma juz wariant ${twin.sku}.`);
        }

        const now = this.clock();
        await tx.variant.create({
          data: {
            sku: body.sku,
            productId,
            colorId: body.color,
            switchId: body.switch ?? null,
            sizeKey: body.size ?? null,
            priceGr: body.price_gr,
            regularPriceGr: body.regular_price_gr ?? null,
            stock: body.stock,
            imagesKey: body.images_key,
            updatedAt: now,
          },
        });
        await tx.priceHistory.create({
          data: {
            sku: body.sku,
            priceGr: body.price_gr,
            validFrom: now,
            changedBy: ctx.actorId,
            reason: "nowy wariant",
          },
        });
        if (body.stock > 0) {
          await tx.stockMovement.create({
            data: {
              sku: body.sku,
              delta: body.stock,
              stockAfter: body.stock,
              kind: "adjustment",
              reason: "nowy wariant",
              actor: ctx.actorId,
              at: now,
            },
          });
        }
        if (!p.defaultVariantSku) {
          await tx.product.update({
            where: { id: productId },
            data: { defaultVariant: { connect: { sku: body.sku } } },
          });
        }
        const auditId = await audit({
          action: "variant.create",
          entity: "variant",
          entityId: body.sku,
          after: {
            sku: body.sku,
            product_id: productId,
            color: body.color,
            switch: body.switch ?? null,
            size: body.size ?? null,
            price_gr: body.price_gr,
            stock: body.stock,
          },
        });
        await this.outbox.enqueueTags(
          tx,
          productTags({ slug: p.slug, categoryId: p.categoryId }),
          auditId,
        );
        return [];
      });
    } catch (e) {
      if (isUniqueViolation(e)) throw conflict("sku", "sku_taken", "Ten SKU jest juz zajety.");
      throw e;
    }
    return this.detail(productId, warnings);
  }

  /** B-103, B-109: kolor, przelacznik, rozmiar, klucz zdjec, dostepnosc (`disabled`); If-Match = wersja wariantu. */
  async patchVariant(sku: string, body: VariantPatch, version: number, ctx: AuditContext) {
    const { productId, warnings } = await this.audit.withAudit(ctx, async (tx, audit) => {
      const locked = await tx.$queryRaw<{ version: number }[]>`
        SELECT version FROM variants WHERE sku = ${sku} FOR UPDATE`;
      if (!locked[0]) throw notFound("Nie znaleziono wariantu.");
      if (locked[0].version !== version) throw preconditionFailed();
      const v = await tx.variant.findUniqueOrThrow({
        where: { sku },
        include: { product: { include: { variants: true } } },
      });
      const category = v.product.categoryId as CategoryId;
      const next = {
        color: body.color ?? v.colorId,
        switch: body.switch !== undefined ? body.switch : v.switchId,
        size: body.size !== undefined ? body.size : v.sizeKey,
        images_key: body.images_key ?? (body.color && !body.images_key ? body.color : v.imagesKey),
        status: body.status ?? (v.status as "active" | "disabled"),
      };
      const errors = variantShapeErrors(category, next);
      if (
        body.status === "disabled" &&
        v.product.status === "active" &&
        !v.product.variants.some((x) => x.sku !== sku && x.status === "active")
      ) {
        errors.push({
          path: "status",
          code: "last_active_variant",
          message:
            "Aktywny produkt musi miec co najmniej jeden aktywny wariant. Zarchiwizuj produkt.",
        });
      }
      if (errors.length > 0) throw validationFailed(errors);
      const before = {
        color: v.colorId,
        switch: v.switchId,
        size: v.sizeKey,
        images_key: v.imagesKey,
        status: v.status,
      };
      const diff = changedFields(before, next);
      const warnings: Warning[] =
        diff.after["status"] === "disabled" ? await this.presetWarningsInTx(tx, [sku]) : [];
      if (Object.keys(diff.after).length === 0) return { productId: v.productId, warnings };

      const twin = await tx.variant.findFirst({
        where: {
          productId: v.productId,
          colorId: next.color,
          switchId: next.switch,
          sizeKey: next.size,
          NOT: { sku },
        },
        select: { sku: true },
      });
      if (twin)
        throw conflict("color", "variant_exists", `Taka kombinacja ma juz wariant ${twin.sku}.`);
      if (next.color !== v.colorId) {
        const c = await tx.color.findUnique({ where: { id: next.color } });
        if (!c)
          throw validationFailed([{ path: "color", code: "unknown", message: "Nieznany kolor." }]);
      }
      if (next.switch && next.switch !== v.switchId) {
        const s = await tx.switch.findUnique({ where: { id: next.switch } });
        if (!s)
          throw validationFailed([
            { path: "switch", code: "unknown", message: "Nieznany przelacznik." },
          ]);
      }
      await tx.variant.update({
        where: { sku },
        data: {
          colorId: next.color,
          switchId: next.switch,
          sizeKey: next.size,
          imagesKey: next.images_key,
          status: next.status,
          version: { increment: 1 },
          updatedAt: this.clock(),
        },
      });
      const auditId = await audit({
        action: "variant.update",
        entity: "variant",
        entityId: sku,
        before: diff.before,
        after: diff.after,
      });
      await this.outbox.enqueueTags(
        tx,
        productTags({ slug: v.product.slug, categoryId: v.product.categoryId }),
        auditId,
      );
      return { productId: v.productId, warnings };
    });
    return this.detail(productId, warnings);
  }

  /** B-110 (docs/16): twarde usuniecie wariantu tylko bez zamowien i setow; ostatniego wariantu aktywnego produktu nie usuniesz. */
  async deleteVariant(sku: string, ctx: AuditContext): Promise<void> {
    await this.audit.withAudit(ctx, async (tx, audit) => {
      const v = await tx.variant.findUnique({
        where: { sku },
        include: { product: { include: { variants: { orderBy: { sku: "asc" } } } } },
      });
      if (!v) throw notFound("Nie znaleziono wariantu.");
      const others = v.product.variants.filter((x) => x.sku !== sku);
      if (v.product.status === "active" && others.every((x) => x.status !== "active")) {
        throw validationFailed([
          {
            path: "sku",
            code: "last_active_variant",
            message: "To ostatni aktywny wariant. Zarchiwizuj produkt zamiast usuwac wariant.",
          },
        ]);
      }
      await this.assertDeletable(
        tx,
        [sku],
        "Wariant ma zamowienia. Wylacz go (status disabled) zamiast usuwac.",
      );
      await tx.$executeRaw`SELECT set_config('taktyl.catalog_purge', 'on', true)`;
      if (v.product.defaultVariantSku === sku) {
        const fallback = others.find((x) => x.status === "active") ?? others[0];
        await tx.product.update({
          where: { id: v.productId },
          data: fallback
            ? { defaultVariant: { connect: { sku: fallback.sku } } }
            : { defaultVariant: { disconnect: true } },
        });
      }
      await tx.stockMovement.deleteMany({ where: { sku } });
      await tx.priceHistory.deleteMany({ where: { sku } });
      await tx.variant.delete({ where: { sku } });
      const auditId = await audit({
        action: "variant.delete",
        entity: "variant",
        entityId: sku,
        before: {
          sku,
          product_id: v.productId,
          price_gr: v.priceGr,
          stock: v.stock,
          status: v.status,
        },
      });
      await this.outbox.enqueueTags(
        tx,
        productTags({ slug: v.product.slug, categoryId: v.product.categoryId }),
        auditId,
      );
    });
  }

  // ------------------------------------------------------------------ cena i stan

  /**
   * B-104, B-107: nowa cena = nowy wiersz price_history (poprzedni zamykany, nigdy UPDATE ceny w miejscu); `variants.price_gr`
   * to kopia biezacej ceny. `regular_price_gr` jest wewnetrzna i nie tworzy wpisu historii. lowest_30d liczy serwer.
   */
  async setPrice(
    sku: string,
    body: PriceBody,
    ifMatch: number | undefined,
    ctx: AuditContext,
  ): Promise<ReturnType<AdminCatalogService["detail"]>> {
    const { productId, warnings } = await this.audit.withAudit(ctx, async (tx, audit) => {
      const locked = await tx.$queryRaw<{ version: number }[]>`
        SELECT version FROM variants WHERE sku = ${sku} FOR UPDATE`;
      if (!locked[0]) throw notFound("Nie znaleziono wariantu.");
      if (ifMatch !== undefined && locked[0].version !== ifMatch) throw preconditionFailed();
      const v = await tx.variant.findUniqueOrThrow({
        where: { sku },
        include: { product: true },
      });
      const nextRegular =
        body.regular_price_gr === undefined ? v.regularPriceGr : body.regular_price_gr;
      const priceChanged = body.price_gr !== v.priceGr;
      const regularChanged = nextRegular !== v.regularPriceGr;
      if (!priceChanged && !regularChanged) return { productId: v.productId, warnings: [] };

      const now = this.clock();
      if (priceChanged) {
        const open = await tx.priceHistory.findFirst({ where: { sku, validTo: null } });
        // valid_to musi byc pozniejsze niz valid_from (wyzwalacz w bazie), takze przy zmianach w tej samej chwili.
        const at =
          open && open.validFrom.getTime() >= now.getTime()
            ? new Date(open.validFrom.getTime() + 1)
            : now;
        if (open) {
          await tx.priceHistory.update({ where: { id: open.id }, data: { validTo: at } });
        }
        await tx.priceHistory.create({
          data: {
            sku,
            priceGr: body.price_gr,
            validFrom: at,
            changedBy: ctx.actorId,
            reason: body.reason?.trim() || null,
          },
        });
      }
      await tx.variant.update({
        where: { sku },
        data: {
          priceGr: body.price_gr,
          regularPriceGr: nextRegular,
          version: { increment: 1 },
          updatedAt: now,
        },
      });
      const auditId = await audit({
        action: "variant.price.set",
        entity: "variant",
        entityId: sku,
        before: { price_gr: v.priceGr, regular_price_gr: v.regularPriceGr },
        after: {
          price_gr: body.price_gr,
          regular_price_gr: nextRegular,
          ...(body.reason ? { reason: body.reason } : {}),
        },
      });
      // regular_price_gr jest wewnetrzna: sama jej zmiana nie zmienia nic w sklepie (docs/04 par. 5.2).
      if (priceChanged) {
        await this.outbox.enqueueTags(
          tx,
          priceTags({ slug: v.product.slug, categoryId: v.product.categoryId }),
          auditId,
        );
      }
      return {
        productId: v.productId,
        warnings: priceChanged ? await this.presetWarningsInTx(tx, [sku]) : [],
      };
    });
    return this.detail(productId, warnings);
  }

  /** B-108: stan 0 lub wiecej; zapis ruchu magazynowego `adjustment` (delta, stan po, powod, autor). */
  async setStock(sku: string, body: StockBody, ifMatch: number | undefined, ctx: AuditContext) {
    const { productId, warnings } = await this.audit.withAudit(ctx, async (tx, audit) => {
      const locked = await tx.$queryRaw<{ version: number }[]>`
        SELECT version FROM variants WHERE sku = ${sku} FOR UPDATE`;
      if (!locked[0]) throw notFound("Nie znaleziono wariantu.");
      if (ifMatch !== undefined && locked[0].version !== ifMatch) throw preconditionFailed();
      const v = await tx.variant.findUniqueOrThrow({ where: { sku }, include: { product: true } });
      const delta = body.stock - v.stock;
      if (delta === 0) return { productId: v.productId, warnings: [] };
      const now = this.clock();
      await tx.stockMovement.create({
        data: {
          sku,
          delta,
          stockAfter: body.stock,
          kind: "adjustment",
          reason: body.reason,
          actor: ctx.actorId,
          at: now,
        },
      });
      await tx.variant.update({
        where: { sku },
        data: { stock: body.stock, version: { increment: 1 }, updatedAt: now },
      });
      const auditId = await audit({
        action: "variant.stock.set",
        entity: "variant",
        entityId: sku,
        before: { stock: v.stock },
        after: { stock: body.stock, reason: body.reason },
      });
      await this.outbox.enqueueTags(
        tx,
        stockTags([{ slug: v.product.slug, categoryId: v.product.categoryId }]),
        auditId,
      );
      return {
        productId: v.productId,
        warnings: body.stock === 0 ? await this.presetWarningsInTx(tx, [sku]) : [],
      };
    });
    return this.detail(productId, warnings);
  }

  /** B-105: historia cen (od najnowszej), wyliczone lowest_30d i okno obliczenia; nic nie jest edytowalne. */
  async priceHistory(sku: string, role: Role) {
    const v = await this.prisma.variant.findUnique({ where: { sku }, select: { sku: true } });
    if (!v) throw notFound("Nie znaleziono wariantu.");
    const [rows, windowDays] = await Promise.all([
      this.prisma.priceHistory.findMany({
        where: { sku },
        orderBy: [{ validFrom: "desc" }, { id: "desc" }],
        include: { author: { select: { email: true } } },
      }),
      this.pricing.promoWindowDays(),
    ]);
    const asc: PriceRow[] = [...rows]
      .reverse()
      .map((r) => ({ priceGr: r.priceGr, validFrom: r.validFrom, validTo: r.validTo }));
    const promo = computePromotion(asc, this.clock(), windowDays);
    const who = (email: string | undefined): string | null =>
      email === undefined ? null : role === "viewer" ? maskEmail(email) : email;
    return {
      sku,
      entries: rows.map((r) => ({
        price_gr: r.priceGr,
        valid_from: r.validFrom.toISOString(),
        valid_to: r.validTo?.toISOString() ?? null,
        changed_by: who(r.author?.email),
        reason: r.reason,
      })),
      lowest_30d_gr: promo.lowest30dGr,
      window: promo.cutAt
        ? {
            from: new Date(promo.cutAt.getTime() - windowDays * DAY_MS).toISOString(),
            to: promo.cutAt.toISOString(),
          }
        : null,
    };
  }

  /** B-108: historia ruchow magazynowych (korekta, sprzedaz, anulowanie); najnowsze pierwsze. */
  async stockMovements(sku: string, role: Role) {
    const v = await this.prisma.variant.findUnique({ where: { sku }, select: { sku: true } });
    if (!v) throw notFound("Nie znaleziono wariantu.");
    const rows = await this.prisma.stockMovement.findMany({
      where: { sku },
      orderBy: [{ at: "desc" }, { id: "desc" }],
      take: 200,
    });
    const actorIds = [...new Set(rows.map((r) => r.actor).filter((a): a is string => a !== null))];
    const users = actorIds.length
      ? await this.prisma.adminUser.findMany({
          where: { id: { in: actorIds } },
          select: { id: true, email: true },
        })
      : [];
    const actor = (id: string | null): string | null => {
      if (id === null) return null;
      const email = users.find((u) => u.id === id)?.email;
      return email ? (role === "viewer" ? maskEmail(email) : email) : id;
    };
    return {
      sku,
      items: rows.map((r) => ({
        id: r.id.toString(),
        delta: r.delta,
        stock_after: r.stockAfter,
        kind: r.kind,
        order_number: r.orderNumber,
        reason: r.reason,
        actor: actor(r.actor),
        at: r.at.toISOString(),
      })),
    };
  }
}
