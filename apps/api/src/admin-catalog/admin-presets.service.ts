// B-114 (docs/15 par. 7, docs/16 par. 3.2, docs/03 par. 6): gotowe sety w backpanelu. Sklad (3 SKU, po jednym z kategorii),
// nazwa, profil, notatka; cena liczona przez domene (nie wpisywana). Zmiana: audit_log + znacznik `presets` w jednej transakcji.
import { Inject, Injectable } from "@nestjs/common";
import type { presetUpdateSchema, ProblemFieldError } from "@taktyl/contracts";
import type { z } from "zod";
import { type AuditContext, AuditService } from "../audit/audit.service.js";
import { notFound, validationFailed } from "../common/app-exception.js";
import { CLOCK, type Clock } from "../common/clock.js";
import { preconditionFailed } from "../common/if-match.js";
import { OutboxService } from "../outbox/outbox.service.js";
import { PresetsService } from "../presets/presets.service.js";
import { PrismaService } from "../prisma/prisma.service.js";

type PresetUpdate = z.output<typeof presetUpdateSchema>;
const CATEGORIES = ["klawiatury", "myszki", "podkladki"];

@Injectable()
export class AdminPresetsService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(AuditService) private readonly audit: AuditService,
    @Inject(OutboxService) private readonly outbox: OutboxService,
    @Inject(PresetsService) private readonly presets: PresetsService,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  /** Lista dla panelu: wszystkie sety (takze ukryte przed klientem) z wersja i cena liczona na biezaco. */
  async list() {
    const [rows, all] = await Promise.all([
      this.prisma.preset.findMany({ orderBy: { position: "asc" } }),
      this.presets.listAll(),
    ]);
    return {
      items: all.items.map((i) => {
        const row = rows.find((r) => r.id === i.id);
        return {
          ...i,
          version: row?.version ?? 1,
          updated_at: (row?.updatedAt ?? this.clock()).toISOString(),
        };
      }),
    };
  }

  async get(id: string) {
    const found = (await this.list()).items.find((i) => i.id === id);
    if (!found) throw notFound("Nie znaleziono setu.");
    return found;
  }

  /** B-114: edycja setu pod If-Match; skladu nie da sie zapisac poza trzema kategoriami lub z nieaktywnym wariantem. */
  async update(id: string, body: PresetUpdate, version: number, ctx: AuditContext) {
    await this.audit.withAudit(ctx, async (tx, audit) => {
      const locked = await tx.$queryRaw<{ version: number }[]>`
        SELECT version FROM presets WHERE id = ${id} FOR UPDATE`;
      if (!locked[0]) throw notFound("Nie znaleziono setu.");
      if (locked[0].version !== version) throw preconditionFailed();
      const current = await tx.preset.findUniqueOrThrow({
        where: { id },
        include: { items: true },
      });

      let items: { categoryId: string; sku: string }[] | null = null;
      if (body.skus) {
        const variants = await tx.variant.findMany({
          where: { sku: { in: body.skus } },
          include: { product: true },
        });
        const errors: ProblemFieldError[] = [];
        if (new Set(body.skus).size !== body.skus.length) {
          errors.push({
            path: "skus",
            code: "duplicate",
            message: "SKU w secie nie moga sie powtarzac.",
          });
        }
        for (const [i, sku] of body.skus.entries()) {
          const v = variants.find((x) => x.sku === sku);
          if (!v)
            errors.push({ path: `skus[${i}]`, code: "unknown_sku", message: "Nieznany SKU." });
          else if (v.status !== "active" || v.product.status !== "active")
            errors.push({
              path: `skus[${i}]`,
              code: "inactive",
              message: "Wariant lub produkt jest nieaktywny.",
            });
        }
        const cats = variants.map((v) => v.product.categoryId).sort();
        if (errors.length === 0 && cats.join() !== [...CATEGORIES].sort().join()) {
          errors.push({
            path: "skus",
            code: "invalid_categories",
            message: "Set to dokladnie jedna klawiatura, jedna myszka i jedna podkladka.",
          });
        }
        if (errors.length > 0) throw validationFailed(errors);
        items = variants.map((v) => ({ categoryId: v.product.categoryId, sku: v.sku }));
      }

      const before = {
        name: current.name,
        profile: current.profile,
        note: current.note,
        skus: current.items.map((i) => i.sku).sort(),
      };
      const after = {
        name: body.name ?? current.name,
        profile: body.profile ?? current.profile,
        note: body.note ?? current.note,
        skus: items ? items.map((i) => i.sku).sort() : before.skus,
      };
      if (JSON.stringify(before) === JSON.stringify(after)) return;

      await tx.preset.update({
        where: { id },
        data: {
          name: after.name,
          profile: after.profile,
          note: after.note,
          version: { increment: 1 },
          updatedAt: this.clock(),
        },
      });
      if (items) {
        await tx.presetItem.deleteMany({ where: { presetId: id } });
        await tx.presetItem.createMany({ data: items.map((i) => ({ presetId: id, ...i })) });
      }
      const auditId = await audit({
        action: "preset.update",
        entity: "preset",
        entityId: id,
        before,
        after,
      });
      await this.outbox.enqueueTags(tx, ["presets"], auditId);
    });
    return this.get(id);
  }
}
