// B-300, B-301, B-302, B-303 (docs/04 par. 7-8, docs/15 par. 9, docs/16 par. 3.4, docs/14 par. 6): opisy produktow i opinie demo.
// Opis: czysty tekst (tagi usuwane), zakazane slowa i dlugosc to OSTRZEZENIA. Opinie: 3-6, oceny 3-5, `demo = true` zawsze
// (CHECK w bazie), autor "imie + inicjal", data do 6 miesiecy wstecz, wariant istniejacy; etykieta sekcji jest stala.
import { Inject, Injectable } from "@nestjs/common";
import type { Prisma } from "../prisma/client.js";
import {
  REVIEWS_LABEL,
  type descriptionPutSchema,
  type ProblemFieldError,
  type reviewsPutSchema,
} from "@taktyl/contracts";
import type { z } from "zod";
import { type AuditContext, AuditService } from "../audit/audit.service.js";
import { notFound, validationFailed } from "../common/app-exception.js";
import { BrandGuard } from "../common/brand-guard.js";
import { CLOCK, type Clock } from "../common/clock.js";
import { preconditionFailed } from "../common/if-match.js";
import { OutboxService } from "../outbox/outbox.service.js";
import { reviewTags } from "../outbox/tags.js";
import { PrismaService } from "../prisma/prisma.service.js";
import {
  describeDescription,
  earliestReviewDate,
  legalContentErrors,
  medicalClaims,
  reviewErrors,
  variantLabels,
} from "./content-rules.js";
import { stripTags } from "./content-sanitizer.js";

type DescriptionPut = z.output<typeof descriptionPutSchema>;
type ReviewsPut = z.output<typeof reviewsPutSchema>;

const round1 = (n: number): number => Math.round(n * 10) / 10;

@Injectable()
export class AdminReviewsService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(AuditService) private readonly audit: AuditService,
    @Inject(OutboxService) private readonly outbox: OutboxService,
    @Inject(BrandGuard) private readonly brands: BrandGuard,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  private brandError(path: string, text: string): ProblemFieldError[] {
    return this.brands.find(text).length === 0
      ? []
      : [
          {
            path,
            code: "real_brand",
            message: "Tresc nie moze zawierac nazw prawdziwych marek (regula 5).",
          },
        ];
  }

  // ------------------------------------------------------------------ opisy (B-300, B-301)

  /** B-300, B-301: zapis opisu pod If-Match (wersja produktu); stylistyka (zakazane slowa, dlugosc, akapity) to ostrzezenia, a marka z listy (regula 5) i obietnica medyczna (Q-07) blokuja zapis (422). */
  async putDescription(id: string, body: DescriptionPut, version: number, ctx: AuditContext) {
    const normalized =
      body.description === null
        ? null
        : stripTags(body.description)
            .replace(/\r\n?/g, "\n")
            .replace(/[ \t]+$/gm, "")
            .replace(/\n{3,}/g, "\n\n")
            .trim() || null;
    const errors: ProblemFieldError[] = [];
    if (normalized !== null) {
      const claims = medicalClaims(normalized);
      if (claims.length > 0) {
        errors.push({
          path: "description",
          code: "medical_claim",
          message: `Opis nie moze zawierac obietnic medycznych: ${claims.join(", ")}. Opisz cechy produktu liczbami.`,
        });
      }
      errors.push(
        ...this.brandError("description", normalized),
        ...legalContentErrors(normalized, "description").filter((e) => e.code === "invalid_domain"),
      );
    }
    if (errors.length > 0) throw validationFailed(errors);
    const stats =
      normalized === null
        ? { words: 0, paragraphs: 0, warnings: [] }
        : describeDescription(normalized);

    const result = await this.audit.withAudit(ctx, async (tx, audit) => {
      const locked = await tx.$queryRaw<{ version: number }[]>`
        SELECT version FROM products WHERE id = ${id} FOR UPDATE`;
      if (!locked[0]) throw notFound("Nie znaleziono produktu.");
      if (locked[0].version !== version) throw preconditionFailed();
      const p = await tx.product.findUniqueOrThrow({ where: { id } });
      if (p.description === normalized) return { version: p.version, description: p.description };
      const updated = await tx.product.update({
        where: { id },
        data: { description: normalized, version: { increment: 1 }, updatedAt: this.clock() },
      });
      const auditId = await audit({
        action: "product.description.update",
        entity: "product",
        entityId: id,
        before: { description: p.description },
        after: { description: normalized, words: stats.words },
      });
      await this.outbox.enqueueTags(tx, [`product:${p.slug}`], auditId);
      return { version: updated.version, description: updated.description };
    });
    return {
      product_id: id,
      description: result.description,
      version: result.version,
      stats: { words: stats.words, paragraphs: stats.paragraphs },
      warnings: stats.warnings,
    };
  }

  // ------------------------------------------------------------------ opinie (B-302, B-303)

  private async summary(productId: string, client: Prisma.TransactionClient = this.prisma) {
    const p = await client.product.findUnique({
      where: { id: productId },
      include: { reviews: { orderBy: [{ date: "desc" }, { id: "asc" }] } },
    });
    if (!p) throw notFound("Nie znaleziono produktu.");
    const count = p.reviews.length;
    return {
      product_id: p.id,
      slug: p.slug,
      name: p.name,
      avg: count === 0 ? null : round1(p.reviews.reduce((s, r) => s + r.rating, 0) / count),
      count,
      items: p.reviews.map((r) => ({
        author: r.author,
        date: r.date.toISOString().slice(0, 10),
        rating: r.rating,
        variant_label: r.variantLabel,
        text: r.text,
        demo: true as const,
      })),
    };
  }

  /** B-302, B-303: opinie wszystkich produktow (albo jednego); etykieta sekcji jest stala. */
  async list(productId?: string) {
    const products = await this.prisma.product.findMany({
      where: productId ? { id: productId } : {},
      select: { id: true },
      orderBy: { id: "asc" },
    });
    if (productId && products.length === 0) throw notFound("Nie znaleziono produktu.");
    return {
      label: REVIEWS_LABEL,
      items: await Promise.all(products.map((p) => this.summary(p.id))),
    };
  }

  /** B-302: zastapienie zestawu opinii produktu (3-6, oceny 3-5, demo wymuszone, daty i warianty walidowane). */
  async putReviews(productId: string, body: ReviewsPut, ctx: AuditContext) {
    const product = await this.prisma.product.findUnique({
      where: { id: productId },
      include: { variants: { include: { color: true, switch: true } } },
    });
    if (!product) throw notFound("Nie znaleziono produktu.");
    const now = this.clock();
    const ctxRules = {
      today: now.toISOString().slice(0, 10),
      earliest: earliestReviewDate(now),
      allowedLabels: variantLabels(
        product.variants.map((v) => ({
          colorLabel: v.color.label,
          switchName: v.switch?.name ?? null,
          size: v.sizeKey,
        })),
      ),
    };
    const errors: ProblemFieldError[] = [];
    body.items.forEach((r, i) => {
      errors.push(...reviewErrors(i, r, ctxRules));
      for (const field of ["author", "variant_label", "text"] as const) {
        errors.push(...this.brandError(`items[${i}].${field}`, r[field]));
      }
      errors.push(
        ...legalContentErrors(r.text, `items[${i}].text`).filter(
          (e) => e.code === "invalid_domain" || e.code === "real_phone",
        ),
      );
    });
    if (errors.length > 0) throw validationFailed(errors);

    const items = body.items.map((r) => ({
      author: stripTags(r.author).trim(),
      date: r.date,
      rating: r.rating,
      variant_label: r.variant_label,
      text: stripTags(r.text).trim(),
    }));

    await this.audit.withAudit(ctx, async (tx, audit) => {
      const before = await this.summary(productId, tx);
      const key = (r: {
        author: string;
        date: string;
        rating: number;
        variant_label: string;
        text: string;
      }) => JSON.stringify([r.author, r.date, r.rating, r.variant_label, r.text]);
      const same =
        before.count === items.length &&
        JSON.stringify(before.items.map(key).sort()) === JSON.stringify(items.map(key).sort());
      if (same) return;
      await tx.review.deleteMany({ where: { productId } });
      await tx.review.createMany({
        data: items.map((r) => ({
          productId,
          author: r.author,
          date: new Date(`${r.date}T00:00:00Z`),
          rating: r.rating,
          variantLabel: r.variant_label,
          text: r.text,
          demo: true,
        })),
      });
      const after = await this.summary(productId, tx);
      const auditId = await audit({
        action: "review.replace",
        entity: "review",
        entityId: productId,
        before: { count: before.count, avg: before.avg },
        after: { count: after.count, avg: after.avg, items: after.items },
      });
      await this.outbox.enqueueTags(
        tx,
        reviewTags({ slug: product.slug, categoryId: product.categoryId }),
        auditId,
      );
    });
    return this.summary(productId);
  }
}
