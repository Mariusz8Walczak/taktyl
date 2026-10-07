// B-600..B-607 (docs/15 par. 12, docs/16 par. 3.5): pulpit. Wylacznie liczby i listy z bazy, bez wykresow i wskaznikow z palca.
import { Inject, Injectable } from "@nestjs/common";
import type { Dashboard, Role } from "@taktyl/contracts";
import { CLOCK, type Clock } from "../common/clock.js";
import { maskEmail } from "../common/pii-mask.js";
import { warsawDayStart } from "../common/warsaw.js";
import { PrismaService } from "../prisma/prisma.service.js";

const DAY_MS = 86_400_000;
/** Statusy zamowien oplaconych (>= paid): licza sie do przychodu (B-601). */
const PAID_STATUSES = ["paid", "processing", "shipped", "delivered"];
/** B-602: stan 0-3 (jak plakietka "Ostatnie sztuki"). */
const LOW_STOCK_MAX = 3;
const LOW_STOCK_LIST = 50;
const TO_HANDLE_LIST = 20;

/** Dzisiejsza data kalendarzowa w Europe/Warsaw (RRRR-MM-DD) przez Intl. */
const warsawToday = (now: Date): string =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Warsaw",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);

@Injectable()
export class DashboardService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  async get(role: Role): Promise<Dashboard> {
    const now = this.clock();
    const todayStart = warsawDayStart(warsawToday(now));
    const d7 = new Date(now.getTime() - 7 * DAY_MS);
    const d30 = new Date(now.getTime() - 30 * DAY_MS);
    const h24 = new Date(now.getTime() - DAY_MS);
    const lowWhere = {
      stock: { lte: LOW_STOCK_MAX },
      status: "active",
      product: { status: "active" },
    } as const;

    const [
      byStatus,
      today,
      last7,
      last30,
      paid7,
      paid30,
      lowCount,
      outCount,
      lowRows,
      toHandle,
      p0Total,
      p0Ready,
      recent,
      pending,
      failed,
      lastSent,
    ] = await Promise.all([
      this.prisma.order.groupBy({ by: ["status"], _count: { _all: true } }),
      this.prisma.order.count({ where: { createdAt: { gte: todayStart } } }),
      this.prisma.order.count({ where: { createdAt: { gte: d7 } } }),
      this.prisma.order.count({ where: { createdAt: { gte: d30 } } }),
      this.prisma.order.aggregate({
        _sum: { totalGr: true },
        where: { status: { in: PAID_STATUSES }, paidAt: { gte: d7 } },
      }),
      this.prisma.order.aggregate({
        _sum: { totalGr: true },
        where: { status: { in: PAID_STATUSES }, paidAt: { gte: d30 } },
      }),
      this.prisma.variant.count({ where: lowWhere }),
      this.prisma.variant.count({ where: { ...lowWhere, stock: 0 } }),
      this.prisma.variant.findMany({
        where: lowWhere,
        orderBy: [{ stock: "asc" }, { sku: "asc" }],
        take: LOW_STOCK_LIST,
        select: {
          sku: true,
          stock: true,
          product: { select: { id: true, slug: true, name: true } },
        },
      }),
      this.prisma.order.findMany({
        where: { status: "paid", paidAt: { lt: h24 } },
        orderBy: { paidAt: "asc" },
        take: TO_HANDLE_LIST,
        select: { number: true, paidAt: true, totalGr: true },
      }),
      this.prisma.productImage.count({ where: { priority: "P0" } }),
      this.prisma.productImage.count({ where: { priority: "P0", status: "gotowe" } }),
      this.prisma.auditLog.findMany({
        orderBy: [{ at: "desc" }, { id: "desc" }],
        take: 10,
        select: {
          id: true,
          at: true,
          actorId: true,
          actorRole: true,
          action: true,
          entity: true,
          entityId: true,
          actor: { select: { email: true } },
        },
      }),
      this.prisma.outbox.count({ where: { status: "pending" } }),
      this.prisma.outbox.count({ where: { status: "failed" } }),
      this.prisma.outbox.findFirst({
        where: { status: "sent", sentAt: { not: null } },
        orderBy: { sentAt: "desc" },
        select: { sentAt: true },
      }),
    ]);

    const by_status: Dashboard["orders"]["by_status"] = {};
    let total = 0;
    for (const g of byStatus) {
      by_status[g.status as keyof typeof by_status] = g._count._all;
      total += g._count._all;
    }
    const label = (r: (typeof recent)[number]): string => {
      if (!r.actor) return r.actorRole === "system" ? "System" : "Konto usunięte";
      return role === "viewer" ? maskEmail(r.actor.email) : r.actor.email;
    };

    return {
      generated_at: now.toISOString(),
      orders: { today, last_7_days: last7, last_30_days: last30, total, by_status },
      revenue: {
        paid_7_days_gr: paid7._sum.totalGr ?? 0,
        paid_30_days_gr: paid30._sum.totalGr ?? 0,
      },
      low_stock: {
        count: lowCount,
        out_of_stock_count: outCount,
        items: lowRows.map((v) => ({
          sku: v.sku,
          product_id: v.product.id,
          product_slug: v.product.slug,
          product_name: v.product.name,
          stock: v.stock,
        })),
      },
      orders_to_handle: toHandle.map((o) => ({
        number: o.number,
        paid_at: (o.paidAt as Date).toISOString(),
        total_gr: o.totalGr,
      })),
      images_p0: { ready: p0Ready, total: p0Total },
      recent_changes: recent.map((r) => ({
        id: r.id.toString(),
        at: r.at.toISOString(),
        actor_id: r.actorId,
        actor_label: label(r),
        action: r.action,
        entity: r.entity,
        entity_id: r.entityId,
      })),
      connection: {
        outbox_pending: pending,
        outbox_failed: failed,
        last_revalidated_at: lastSent?.sentAt?.toISOString() ?? null,
      },
    };
  }
}
