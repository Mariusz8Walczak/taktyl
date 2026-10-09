// B-200...B-205, B-208 (docs/15 par. 8, docs/16 par. 3.3, par. 5, docs/18 E): zamowienia w backpanelu.
// Lista, szczegoly (dane osobowe zamaskowane dla viewer), zmiana statusu z maszyna stanow, notatki wewnetrzne.
// Kazda zmiana: wiersz order_status_history i wpis audit_log w tej samej transakcji; anulowanie oplaconego zamowienia
// zwraca stany magazynowe (blokada wierszy, ruch `sale_reverted`) i zapisuje znaczniki rewalidacji w outbox.
import { Inject, Injectable } from "@nestjs/common";
import type { Prisma } from "../prisma/client.js";
import type {
  adminOrderListQuerySchema,
  orderNoteRequestSchema,
  orderTransitionRequestSchema,
  Role,
} from "@taktyl/contracts";
import type { z } from "zod";
import { type AuditContext, AuditService } from "../audit/audit.service.js";
import { AppException, notFound, validationFailed } from "../common/app-exception.js";
import { CLOCK, type Clock } from "../common/clock.js";
import { maskEmail, maskPhone, maskRecord } from "../common/pii-mask.js";
import { warsawDayStart, warsawNextDayStart } from "../common/warsaw.js";
import { toOrderDetail } from "../orders/order-detail.js";
import { OutboxService, stockTags } from "../outbox/outbox.service.js";
import { PrismaService } from "../prisma/prisma.service.js";
import {
  allowedAdminTransitions,
  CANCEL_REASON_MIN,
  isAdminTransitionAllowed,
  restocksOnCancel,
} from "./order-transitions.js";

type ListQuery = z.output<typeof adminOrderListQuerySchema>;
type TransitionBody = z.output<typeof orderTransitionRequestSchema>;
type NoteBody = z.output<typeof orderNoteRequestSchema>;

/** Sortowanie listy: tylko kolumny z indeksami/sensem biznesowym (reszta = 400). */
const SORTABLE = {
  created_at: "createdAt",
  total_gr: "totalGr",
  number: "number",
  status: "status",
} as const;

const asRecord = (v: Prisma.JsonValue | null): Record<string, string> | null =>
  v !== null && typeof v === "object" && !Array.isArray(v)
    ? Object.fromEntries(Object.entries(v).map(([k, x]) => [k, String(x ?? "")]))
    : null;

@Injectable()
export class AdminOrdersService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(AuditService) private readonly audit: AuditService,
    @Inject(OutboxService) private readonly outbox: OutboxService,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  /** B-200, B-201: lista z filtrami i stronicowaniem. E-mail zawsze zamaskowany; pelne dane dopiero w szczegolach. */
  async list(query: ListQuery) {
    const sortMatch = /^(-)?([a-z_]+)$/.exec(query.sort);
    const column = sortMatch ? SORTABLE[sortMatch[2] as keyof typeof SORTABLE] : undefined;
    if (!sortMatch || !column) {
      throw validationFailed(
        [
          {
            path: "sort",
            code: "invalid_sort",
            message: `Dozwolone: ${Object.keys(SORTABLE).join(", ")}.`,
          },
        ],
        400,
      );
    }
    const direction = sortMatch[1] ? "desc" : "asc";
    const where: Prisma.OrderWhereInput = {
      ...(query.status ? { status: query.status } : {}),
      ...(query.payment_type ? { paymentType: query.payment_type } : {}),
      ...(query.shipping_method ? { shippingMethodId: query.shipping_method } : {}),
      ...(query.number ? { number: { contains: query.number.trim().toUpperCase() } } : {}),
      ...(query.from || query.to
        ? {
            createdAt: {
              ...(query.from ? { gte: warsawDayStart(query.from) } : {}),
              ...(query.to ? { lt: warsawNextDayStart(query.to) } : {}),
            },
          }
        : {}),
    };
    const [total, rows] = await Promise.all([
      this.prisma.order.count({ where }),
      this.prisma.order.findMany({
        where,
        orderBy: [{ [column]: direction }, { number: "desc" }],
        skip: (query.page - 1) * query.per_page,
        take: query.per_page,
        include: { _count: { select: { items: true } } },
      }),
    ]);
    return {
      items: rows.map((o) => ({
        number: o.number,
        status: o.status,
        created_at: o.createdAt.toISOString(),
        total_gr: o.totalGr,
        payment_type: o.paymentType,
        shipping_method: o.shippingMethodId,
        // Po retencji (ADR-0007) pola osobowe sa puste: "" zamiast wartosci.
        contact_email: o.contactEmail ? maskEmail(o.contactEmail) : "",
        items_count: o._count.items,
      })),
      page: query.page,
      per_page: query.per_page,
      total,
    };
  }

  /** B-202, B-208: szczegoly zamowienia; dla viewer dane osobowe maskowane w odpowiedzi API (nie tylko w UI). */
  async detail(number: string, role: Role, client: Prisma.TransactionClient = this.prisma) {
    const o = await client.order.findUnique({
      where: { number },
      include: {
        items: { orderBy: { id: "asc" } },
        payment: true,
        statusHistory: { orderBy: [{ at: "asc" }, { id: "asc" }] },
        notes: {
          orderBy: [{ at: "asc" }, { id: "asc" }],
          include: { author: { select: { email: true } } },
        },
      },
    });
    if (!o) throw notFound("Nie znaleziono zamowienia.");

    const mask = role === "viewer";
    const actorIds = [
      ...new Set(o.statusHistory.map((h) => h.actor).filter((a) => a !== "system")),
    ];
    const actors = actorIds.length
      ? await client.adminUser.findMany({
          where: { id: { in: actorIds } },
          select: { id: true, email: true },
        })
      : [];
    const who = (id: string | null): string | null => {
      if (id === null) return null;
      if (id === "system") return "system";
      const email = actors.find((a) => a.id === id)?.email;
      return email ? (mask ? maskEmail(email) : email) : id;
    };
    const email = o.contactEmail ?? "";
    const phone = o.contactPhone ?? "";
    const lastNote = o.notes[o.notes.length - 1];
    return {
      ...toOrderDetail(o),
      contact: {
        email: mask && email ? maskEmail(email) : email,
        phone: mask && phone ? maskPhone(phone) : phone,
      },
      shipping_address: mask
        ? maskRecord(asRecord(o.shippingAddress))
        : asRecord(o.shippingAddress),
      invoice: mask ? maskRecord(asRecord(o.invoice)) : asRecord(o.invoice),
      internal_note: lastNote?.body ?? null,
      notes: o.notes.map((n) => ({
        id: n.id.toString(),
        author: n.author ? (mask ? maskEmail(n.author.email) : n.author.email) : null,
        body: n.body,
        at: n.at.toISOString(),
      })),
      allowed_transitions: mask ? [] : [...allowedAdminTransitions(o.status)],
      history: o.statusHistory.map((h) => ({
        from: h.fromStatus,
        to: h.toStatus,
        actor: who(h.actor) ?? "system",
        note: h.note,
        at: h.at.toISOString(),
      })),
    };
  }

  /** B-203, B-205: zmiana statusu. Niedozwolone przejscie = 409 invalid_transition; anulowanie wymaga powodu. */
  async transition(number: string, body: TransitionBody, ctx: AuditContext) {
    const note = body.note?.trim() || null;
    if (body.to === "cancelled" && (note?.length ?? 0) < CANCEL_REASON_MIN) {
      throw validationFailed([
        {
          path: "note",
          code: "reason_required",
          message: "Podaj powod anulowania (min. 5 znakow).",
        },
      ]);
    }
    await this.audit.withAudit(ctx, async (tx, audit) => {
      const now = this.clock();
      // Blokada zamowienia: rownolegla symulacja platnosci (tez blokuje ten wiersz) lub druga zmiana czeka w kolejce.
      const rows = await tx.$queryRaw<{ status: string }[]>`
        SELECT status FROM orders WHERE number = ${number} FOR UPDATE`;
      const from = rows[0]?.status;
      if (from === undefined) throw notFound("Nie znaleziono zamowienia.");
      if (!isAdminTransitionAllowed(from, body.to)) {
        throw new AppException(
          409,
          "invalid_transition",
          `Przejscie ${from} -> ${body.to} jest niedozwolone.`,
        );
      }

      const restocked =
        body.to === "cancelled" && restocksOnCancel(from)
          ? await this.restock(tx, number, note, ctx, now)
          : [];

      await tx.order.update({ where: { number }, data: { status: body.to } });
      await tx.orderStatusHistory.create({
        data: {
          orderNumber: number,
          fromStatus: from,
          toStatus: body.to,
          actor: ctx.actorId ?? "system",
          note,
          at: now,
        },
      });
      const auditId = await audit({
        action: "order.transition",
        entity: "order",
        entityId: number,
        before: { status: from },
        after: {
          status: body.to,
          ...(note ? { note } : {}),
          ...(restocked.length > 0
            ? { restocked: restocked.map((r) => ({ sku: r.sku, qty: r.qty })) }
            : {}),
        },
      });
      if (restocked.length > 0) {
        // docs/14 par. 6 (stan wariantu) + docs/15 par. 8.2: karty, listingi i strona glowna dotknietych produktow.
        await this.outbox.enqueue(
          tx,
          [...stockTags(restocked.map((r) => r.product)), "catalog"],
          auditId,
        );
      }
    });
    return this.detail(number, ctx.actorRole === "system" ? "owner" : ctx.actorRole);
  }

  /** B-204: notatka wewnetrzna (autor i czas), niewidoczna dla klienta; tresc nie trafia do dziennika (moze zawierac dane osobowe). */
  async addNote(number: string, body: NoteBody, ctx: AuditContext) {
    await this.audit.withAudit(ctx, async (tx, audit) => {
      const exists = await tx.order.findUnique({ where: { number }, select: { number: true } });
      if (!exists) throw notFound("Nie znaleziono zamowienia.");
      const created = await tx.orderNote.create({
        data: { orderNumber: number, authorId: ctx.actorId, body: body.note, at: this.clock() },
      });
      await audit({
        action: "order.note",
        entity: "order",
        entityId: number,
        after: { note_id: created.id.toString(), chars: body.note.length },
      });
    });
    return this.detail(number, ctx.actorRole === "system" ? "owner" : ctx.actorRole);
  }

  /**
   * B-205: zwrot stanow po anulowaniu zamowienia, ktorego stan zostal zdjety (paid, processing).
   * Warianty blokowane `FOR UPDATE` w kolejnosci SKU (jak w platnosci: brak zakleszczen), ruch magazynowy `sale_reverted`.
   */
  private async restock(
    tx: Prisma.TransactionClient,
    number: string,
    reason: string | null,
    ctx: AuditContext,
    now: Date,
  ): Promise<{ sku: string; qty: number; product: { slug: string; categoryId: string } }[]> {
    const items = await tx.orderItem.findMany({
      where: { orderNumber: number },
      orderBy: { id: "asc" },
    });
    const demand = new Map<string, number>();
    for (const i of items) {
      if (i.configSku === null) demand.set(i.sku, (demand.get(i.sku) ?? 0) + i.qty);
    }
    const skus = [...demand.keys()].sort();
    if (skus.length === 0) return [];
    const locked = await tx.$queryRaw<{ sku: string; stock: number }[]>`
      SELECT sku, stock FROM variants WHERE sku = ANY(${skus}) ORDER BY sku FOR UPDATE`;
    const stock = new Map(locked.map((r) => [r.sku, r.stock]));
    const out: { sku: string; qty: number; product: { slug: string; categoryId: string } }[] = [];
    for (const sku of skus) {
      const qty = demand.get(sku) as number;
      const after = (stock.get(sku) ?? 0) + qty;
      const variant = await tx.variant.update({
        where: { sku },
        data: { stock: { increment: qty }, version: { increment: 1 } },
        select: { product: { select: { slug: true, categoryId: true } } },
      });
      await tx.stockMovement.create({
        data: {
          sku,
          delta: qty,
          stockAfter: after,
          kind: "sale_reverted",
          orderNumber: number,
          reason,
          actor: ctx.actorId ?? "system",
          at: now,
        },
      });
      out.push({ sku, qty, product: variant.product });
    }
    return out;
  }
}
