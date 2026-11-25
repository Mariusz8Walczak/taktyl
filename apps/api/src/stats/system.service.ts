// B-623 (docs/25 par. 2, audyt P2-6): "Jak to jest zrobione" - stos (wersje odczytane w runtime, nic z palca),
// kondycja uslug (baza, migracje, kolejka outbox, sklep przez /api/health) i liczby danych.
// B-626: wyszukiwarka globalna backpanelu (produkt po nazwie, id lub SKU; zamowienie po numerze).
import { createRequire } from "node:module";
import { Inject, Injectable } from "@nestjs/common";
import {
  adminSearchSchema,
  systemStatusSchema,
  type AdminSearch,
  type CategoryId,
  type OrderStatus,
  type SystemStatus,
} from "@taktyl/contracts";
import { normalizeSearchText as normalizeSearch } from "@taktyl/domain";
import { CLOCK, type Clock } from "../common/clock.js";
import { respond } from "../common/zod.pipe.js";
import { APP_CONFIG } from "../config/config.module.js";
import type { AppConfig } from "../config/env.js";
import { OUTBOX_PENDING_LIMIT } from "../health/health.controller.js";
import { PrismaService } from "../prisma/prisma.service.js";

const SEARCH_LIMIT = 8;
const WEB_TIMEOUT_MS = 1500;

function packageVersion(name: string): string {
  try {
    const req = createRequire(import.meta.url);
    return (req(`${name}/package.json`) as { version?: string }).version ?? "?";
  } catch {
    return "?";
  }
}

type Service = SystemStatus["services"][number];

@Injectable()
export class SystemService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  private async timed<T>(fn: () => Promise<T>): Promise<{ value: T | null; ms: number }> {
    const t0 = performance.now();
    try {
      const value = await fn();
      return { value, ms: Math.round(performance.now() - t0) };
    } catch {
      return { value: null, ms: Math.round(performance.now() - t0) };
    }
  }

  private async web(): Promise<Service> {
    const base = this.config.REVALIDATE_URL;
    if (!base) {
      return { id: "web", label: "Sklep (Next.js)", status: "uwaga", detail: "Brak REVALIDATE_URL w konfiguracji API.", latency_ms: null };
    }
    const url = `${new URL(base).origin}/api/health`;
    const r = await this.timed(async () => {
      const res = await fetch(url, { signal: AbortSignal.timeout(WEB_TIMEOUT_MS) });
      return res.ok;
    });
    return r.value
      ? { id: "web", label: "Sklep (Next.js)", status: "ok", detail: "Odpowiada na /api/health.", latency_ms: r.ms }
      : { id: "web", label: "Sklep (Next.js)", status: "awaria", detail: "Brak odpowiedzi z /api/health.", latency_ms: null };
  }

  async status(): Promise<SystemStatus> {
    const now = this.clock();
    const [db, pgVersion, migrations, pending, failed, lastSent, web, counts] = await Promise.all([
      this.timed(() => this.prisma.$queryRaw`SELECT 1`),
      this.prisma.$queryRaw<{ v: string }[]>`SHOW server_version`.catch(() => [] as { v: string }[]),
      this.prisma.$queryRaw<{ n: number; last: string | null }[]>`
        SELECT count(*)::int AS n, max(migration_name) AS last FROM _prisma_migrations WHERE finished_at IS NOT NULL`.catch(
        () => [] as { n: number; last: string | null }[],
      ),
      this.prisma.outbox.count({ where: { status: "pending" } }),
      this.prisma.outbox.count({ where: { status: "failed" } }),
      this.prisma.outbox.findFirst({
        where: { status: "sent", sentAt: { not: null } },
        orderBy: { sentAt: "desc" },
        select: { sentAt: true },
      }),
      this.web(),
      Promise.all([
        this.prisma.product.count(),
        this.prisma.variant.count(),
        this.prisma.order.count(),
        this.prisma.order.count({ where: { demo: true } }),
        this.prisma.analyticsEvent.count(),
        this.prisma.auditLog.count(),
        this.prisma.productImage.count({ where: { status: "gotowe" } }),
        this.prisma.contentPage.count(),
      ]),
    ]);
    const pg = (pgVersion[0] as { server_version?: string; v?: string } | undefined) ?? {};
    const outboxStatus: Service["status"] =
      failed > 0 || pending > OUTBOX_PENDING_LIMIT ? "awaria" : pending > 0 ? "uwaga" : "ok";
    const services: Service[] = [
      {
        id: "api",
        label: "API (NestJS)",
        status: "ok",
        detail: "Odpowiada (to zapytanie przeszlo przez API).",
        latency_ms: null,
      },
      db.value !== null
        ? { id: "db", label: "Baza PostgreSQL", status: "ok", detail: "SELECT 1 bez bledu.", latency_ms: db.ms }
        : { id: "db", label: "Baza PostgreSQL", status: "awaria", detail: "Brak polaczenia z baza.", latency_ms: null },
      {
        id: "outbox",
        label: "Kolejka rewalidacji (outbox)",
        status: outboxStatus,
        detail: `Oczekuje: ${pending}, z bledem: ${failed}. Ostatnia wysylka: ${lastSent?.sentAt?.toISOString() ?? "brak"}.`,
        latency_ms: null,
      },
      web,
    ];
    const [products, variants, orders, demoOrders, events, audit, images, pages] = counts;
    return respond(systemStatusSchema, {
      generated_at: now.toISOString(),
      demo_mode: this.config.DEMO_MODE,
      services,
      stack: [
        { name: "Node.js", version: process.versions.node, role: "srodowisko uruchomieniowe API" },
        { name: "NestJS", version: packageVersion("@nestjs/core"), role: "API REST i logika backpanelu" },
        { name: "Prisma", version: packageVersion("@prisma/client"), role: "dostep do bazy i migracje" },
        {
          name: "PostgreSQL",
          version: String(pg.server_version ?? pg.v ?? "?"),
          role: "baza danych (zrodlo prawdy w runtime)",
        },
        { name: "Zod", version: packageVersion("zod"), role: "kontrakty API wspolne dla sklepu i panelu" },
      ],
      data: [
        { id: "products", label: "Produkty", count: products },
        { id: "variants", label: "Warianty", count: variants },
        { id: "orders", label: "Zamowienia", count: orders },
        { id: "orders_demo", label: "w tym z generatora demo", count: demoOrders },
        { id: "events", label: "Zdarzenia pomiaru", count: events },
        { id: "audit", label: "Wpisy dziennika zmian", count: audit },
        { id: "images", label: "Zdjecia gotowe", count: images },
        { id: "pages", label: "Strony i poradniki", count: pages },
      ],
      migrations: { applied: migrations[0]?.n ?? 0, last: migrations[0]?.last ?? null },
    });
  }

  /** B-626: do 8 produktow (nazwa, id, SKU wariantu) i 8 zamowien (numer). */
  async search(q: string): Promise<AdminSearch> {
    const needle = q.trim();
    const upper = needle.toUpperCase();
    const norm = normalizeSearch(needle);
    const [products, variants, orders] = await Promise.all([
      this.prisma.product.findMany({
        select: { id: true, name: true, categoryId: true, status: true },
        orderBy: { name: "asc" },
      }),
      this.prisma.variant.findMany({
        where: { sku: { contains: upper } },
        select: { sku: true, product: { select: { id: true, name: true, categoryId: true, status: true } } },
        orderBy: { sku: "asc" },
        take: SEARCH_LIMIT,
      }),
      this.prisma.order.findMany({
        where: { number: { contains: upper } },
        select: { number: true, status: true, totalGr: true, createdAt: true },
        orderBy: { createdAt: "desc" },
        take: SEARCH_LIMIT,
      }),
    ]);
    const byName = products
      .filter((p) => normalizeSearch(p.name).includes(norm) || p.id.includes(norm))
      .map((p) => ({ id: p.id, name: p.name, category: p.categoryId as CategoryId, sku: null, status: p.status }));
    const bySku = variants.map((v) => ({
      id: v.product.id,
      name: v.product.name,
      category: v.product.categoryId as CategoryId,
      sku: v.sku,
      status: v.product.status,
    }));
    return respond(adminSearchSchema, {
      products: [...byName, ...bySku].slice(0, SEARCH_LIMIT),
      orders: orders.map((o) => ({
        number: o.number,
        status: o.status as OrderStatus,
        total_gr: o.totalGr,
        created_at: o.createdAt.toISOString(),
      })),
    });
  }
}

