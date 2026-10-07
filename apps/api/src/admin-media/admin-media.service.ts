// B-500..B-508 (docs/15 par. 11, docs/16 par. 3.5, docs/09): manifest zdjec i wgrywanie plikow dostarczonych przez czlowieka.
// API NIE tworzy obrazow: przyjmuje WebP zgodny z manifestem (nazwa i wymiary z wpisu), zapisuje do wolumenu MEDIA_DIR,
// ustawia status `gotowe` (B-506) i w TEJ SAMEJ transakcji zapisuje audit_log oraz znaczniki rewalidacji w outbox.
import { randomBytes } from "node:crypto";
import { mkdir, rename, stat, unlink, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { Inject, Injectable } from "@nestjs/common";
import type { Prisma } from "../prisma/client.js";
import {
  MEDIA_ALLOWED_TYPES,
  type MediaEntry,
  type MediaSlot,
  type MediaUploadResponse,
  type mediaListQuerySchema,
  type ProblemFieldError,
} from "@taktyl/contracts";
import type { z } from "zod";
import { type AuditContext, AuditService } from "../audit/audit.service.js";
import { AppException, notFound, validationFailed } from "../common/app-exception.js";
import { APP_CONFIG } from "../config/config.module.js";
import type { AppConfig } from "../config/env.js";
import { OutboxService } from "../outbox/outbox.service.js";
import { PrismaService } from "../prisma/prisma.service.js";
import {
  dimensionsMessage,
  NO_ALPHA_MESSAGE,
  NOT_WEBP_MESSAGE,
  resolveInMediaDir,
  type SlotSpec,
  slotSpecs,
} from "./media-spec.js";
import { readWebpInfo } from "./webp.js";

type ListQuery = z.output<typeof mediaListQuerySchema>;

export interface IncomingFile {
  /** nazwa pola multipart = miejsce na plik (`1x`, `2x`, `400`...) albo `file` z polem `slot` */
  fieldname: string;
  mimetype: string;
  buffer: Buffer;
  size: number;
}

type Row = Prisma.ProductImageGetPayload<{
  include: { product: { select: { slug: true; name: true; categoryId: true } } };
}>;

const INCLUDE = { product: { select: { slug: true, name: true, categoryId: true } } } as const;
const SLOTS = new Set<string>(["400", "800", "1600", "1x", "2x"]);

const exists = (abs: string): Promise<boolean> =>
  stat(abs).then(
    (s) => s.isFile(),
    () => false,
  );

@Injectable()
export class AdminMediaService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(AuditService) private readonly audit: AuditService,
    @Inject(OutboxService) private readonly outbox: OutboxService,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
  ) {}

  /** B-501, B-605: licznik z danych calego manifestu. */
  async progress() {
    const [total, totalReady, p0Total, p0Ready] = await Promise.all([
      this.prisma.productImage.count(),
      this.prisma.productImage.count({ where: { status: "gotowe" } }),
      this.prisma.productImage.count({ where: { priority: "P0" } }),
      this.prisma.productImage.count({ where: { priority: "P0", status: "gotowe" } }),
    ]);
    return { p0_ready: p0Ready, p0_total: p0Total, total_ready: totalReady, total };
  }

  /** B-500: lista wpisow z filtrami (status, rodzaj, priorytet, produkt, szukaj) i strona. */
  async list(query: ListQuery) {
    const where: Prisma.ProductImageWhereInput = {
      ...(query.status ? { status: query.status } : {}),
      ...(query.kind ? { kind: query.kind } : {}),
      ...(query.priority ? { priority: query.priority } : {}),
      ...(query.product_id ? { productId: query.product_id } : {}),
      ...(query.q
        ? {
            OR: [
              { key: { contains: query.q, mode: "insensitive" } },
              { product: { name: { contains: query.q, mode: "insensitive" } } },
            ],
          }
        : {}),
    };
    const [total, rows, progress] = await Promise.all([
      this.prisma.productImage.count({ where }),
      this.prisma.productImage.findMany({
        where,
        include: INCLUDE,
        orderBy: [{ priority: "asc" }, { key: "asc" }],
        skip: (query.page - 1) * query.per_page,
        take: query.per_page,
      }),
      this.progress(),
    ]);
    const items = await Promise.all(rows.map((r) => this.toEntry(r)));
    return { items, page: query.page, per_page: query.per_page, total, progress };
  }

  private async load(key: string): Promise<Row> {
    const row = await this.prisma.productImage.findUnique({ where: { key }, include: INCLUDE });
    if (!row) throw notFound("Nie ma takiego wpisu w manifeście.");
    return row;
  }

  private async toEntry(row: Row): Promise<MediaEntry> {
    const specs = slotSpecs(row);
    const slots = await Promise.all(
      specs.map(async (s) => {
        const abs = resolveInMediaDir(this.config.MEDIA_DIR, s.path);
        const present = abs ? await exists(abs) : false;
        return {
          slot: s.slot,
          file_name: s.fileName,
          path: s.path,
          width: s.width,
          height: s.height,
          present,
          url: present ? this.publicUrl(s.path) : null,
        };
      }),
    );
    const dims = row.dimsMm as { w?: unknown; d?: unknown } | null;
    return {
      key: row.key,
      product_id: row.productId,
      product_slug: row.product.slug,
      product_name: row.product.name,
      color: row.colorId,
      kind: row.kind as MediaEntry["kind"],
      shot: row.shot,
      description: row.description,
      priority: row.priority as MediaEntry["priority"],
      status: row.status as MediaEntry["status"],
      dims_mm:
        dims && Number.isInteger(dims.w) && Number.isInteger(dims.d)
          ? { w: dims.w as number, d: dims.d as number }
          : null,
      pixels: (row.pixels as MediaEntry["pixels"]) ?? null,
      slots,
      updated_at: row.updatedAt.toISOString(),
    };
  }

  private publicUrl(path: string): string {
    return `${this.config.MEDIA_PUBLIC_URL.replace(/\/+$/, "")}/${path}`;
  }

  /** Znaczniki wg docs/14 par. 6 i docs/15 par. 11.1: karta produktu, kategoria, listingi, gotowe sety. */
  private tags(row: Row): string[] {
    return [
      `product:${row.product.slug}`,
      `category:${row.product.categoryId}`,
      "catalog",
      "presets",
    ];
  }

  /**
   * B-502..B-506: wgranie pliku (lub kompletu rozmiarow) do wpisu. Wszystko albo nic: jeden zly plik odrzuca cale zadanie.
   * Status zmienia sie na `gotowe`, gdy wszystkie miejsca z manifestu maja plik.
   */
  async upload(
    key: string,
    files: readonly IncomingFile[],
    body: Record<string, unknown>,
    ctx: AuditContext,
  ): Promise<MediaUploadResponse> {
    const row = await this.load(key);
    const specs = slotSpecs(row);
    if (specs.length === 0) {
      throw validationFailed([
        { path: "key", code: "no_slots", message: "Wpis nie ma plików do wgrania." },
      ]);
    }
    if (files.length === 0) {
      throw validationFailed([{ path: "file", code: "no_file", message: "Wybierz plik." }]);
    }

    const errors: ProblemFieldError[] = [];
    let status = 422;
    const bump = (s: number) => {
      // 415 (zly typ) wazniejszy od 413 (rozmiar), ten od 422 (wymiary, miejsce).
      const rank = (n: number) => (n === 415 ? 3 : n === 413 ? 2 : 1);
      if (rank(s) > rank(status)) status = s;
    };
    const accepted: { spec: SlotSpec; buffer: Buffer }[] = [];
    const warnings: MediaUploadResponse["warnings"] = [];
    const seen = new Set<string>();

    for (const f of files) {
      const slotName = f.fieldname === "file" ? String(body["slot"] ?? "") : f.fieldname;
      const path = f.fieldname;
      const spec = specs.find((s) => s.slot === slotName);
      if (!SLOTS.has(slotName) || !spec) {
        errors.push({
          path,
          code: "unknown_slot",
          message: `Ten wpis przyjmuje pliki: ${specs.map((s) => s.slot).join(", ")}.`,
        });
        continue;
      }
      if (seen.has(slotName)) {
        errors.push({ path, code: "unknown_slot", message: "Ten rozmiar podano dwa razy." });
        continue;
      }
      seen.add(slotName);
      const info = readWebpInfo(f.buffer);
      if (!(MEDIA_ALLOWED_TYPES as readonly string[]).includes(f.mimetype) || !info) {
        errors.push({ path, code: "unsupported_type", message: NOT_WEBP_MESSAGE });
        bump(415);
        continue;
      }
      if (f.size > this.config.MEDIA_MAX_BYTES) {
        errors.push({
          path,
          code: "file_too_large",
          message: `Plik jest za duży. Maksymalny rozmiar to ${this.config.MEDIA_MAX_BYTES / (1024 * 1024)} MB.`,
        });
        bump(413);
        continue;
      }
      if (info.width !== spec.width || info.height !== spec.height) {
        errors.push({
          path,
          code: "dimensions_mismatch",
          message: dimensionsMessage(row.kind, spec.slot, info, spec),
        });
        bump(422);
        continue;
      }
      if (row.kind !== "texture" && !info.hasAlpha) {
        warnings.push({ code: "no_alpha", slot: spec.slot, message: NO_ALPHA_MESSAGE });
      }
      accepted.push({ spec, buffer: f.buffer });
    }

    if (errors.length > 0) {
      const code =
        status === 415
          ? "unsupported_media_type"
          : status === 413
            ? "payload_too_large"
            : "validation_failed";
      throw new AppException(
        status,
        code,
        errors[0]?.message ?? "Plik nie spełnia wymagań wpisu.",
        errors,
      );
    }

    const before = await this.slotState(row, specs);
    const written = await this.writeFiles(accepted);
    try {
      await this.audit.withAudit(ctx, async (tx, audit) => {
        const present = new Set(before.filter((b) => b.present).map((b) => b.slot));
        for (const a of accepted) present.add(a.spec.slot);
        const complete = specs.every((s) => present.has(s.slot));
        const nextStatus = complete ? "gotowe" : row.status === "gotowe" ? "gotowe" : "brak";
        await tx.productImage.update({ where: { key }, data: { status: nextStatus } });
        const auditId = await audit({
          action: "media.upload",
          entity: "media",
          entityId: key,
          before: { status: row.status, slots: before },
          after: {
            status: nextStatus,
            slots: specs.map((s) => ({ slot: s.slot, present: present.has(s.slot) })),
            uploaded: accepted.map((a) => a.spec.slot),
          },
        });
        await this.outbox.enqueueTags(tx, this.tags(row), auditId);
      });
    } catch (e) {
      await Promise.all(written.map((w) => unlink(w).catch(() => undefined)));
      throw e;
    }

    const entry = await this.toEntry(await this.load(key));
    return {
      entry,
      uploaded: accepted.map((a) => a.spec.slot),
      missing: entry.slots.filter((s) => !s.present).map((s) => s.slot),
      warnings,
      progress: await this.progress(),
    };
  }

  /** B-506: usuniecie plikow wpisu (owner); status wraca do `brak`, sklep pokazuje placeholder. */
  async remove(key: string, ctx: AuditContext): Promise<MediaUploadResponse> {
    const row = await this.load(key);
    const specs = slotSpecs(row);
    const before = await this.slotState(row, specs);
    await this.audit.withAudit(ctx, async (tx, audit) => {
      await tx.productImage.update({ where: { key }, data: { status: "brak" } });
      const auditId = await audit({
        action: "media.delete",
        entity: "media",
        entityId: key,
        before: { status: row.status, slots: before },
        after: { status: "brak", slots: specs.map((s) => ({ slot: s.slot, present: false })) },
      });
      await this.outbox.enqueueTags(tx, this.tags(row), auditId);
    });
    for (const s of specs) {
      const abs = resolveInMediaDir(this.config.MEDIA_DIR, s.path);
      if (abs) await unlink(abs).catch(() => undefined);
    }
    const entry = await this.toEntry(await this.load(key));
    return {
      entry,
      uploaded: [],
      missing: entry.slots.map((s) => s.slot),
      warnings: [],
      progress: await this.progress(),
    };
  }

  private async slotState(
    row: Row,
    specs: SlotSpec[],
  ): Promise<{ slot: MediaSlot; present: boolean }[]> {
    void row;
    return Promise.all(
      specs.map(async (s) => {
        const abs = resolveInMediaDir(this.config.MEDIA_DIR, s.path);
        return { slot: s.slot, present: abs ? await exists(abs) : false };
      }),
    );
  }

  /** Zapis atomowy (plik tymczasowy w tym samym katalogu, potem rename). Zwraca sciezki zapisanych plikow. */
  private async writeFiles(accepted: { spec: SlotSpec; buffer: Buffer }[]): Promise<string[]> {
    const done: string[] = [];
    try {
      for (const a of accepted) {
        const abs = resolveInMediaDir(this.config.MEDIA_DIR, a.spec.path);
        if (!abs) throw new Error("Sciezka pliku poza MEDIA_DIR");
        await mkdir(dirname(abs), { recursive: true });
        const tmp = `${abs}.${randomBytes(6).toString("hex")}.tmp`;
        await writeFile(tmp, a.buffer, { flag: "wx" });
        await rename(tmp, abs);
        done.push(abs);
      }
    } catch (e) {
      await Promise.all(done.map((p) => unlink(p).catch(() => undefined)));
      throw e;
    }
    return done;
  }
}
