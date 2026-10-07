// B-011 (docs/15 par. 6, docs/17 par. 3.6, ADR-0006 pkt 6): dziennik zmian. Wpis powstaje w TEJ SAMEJ transakcji co mutacja
// (`withAudit`), wiec nie ma zmiany bez wpisu ani wpisu bez zmiany. Tabela jest tylko do dopisywania (wyzwalacz w bazie).
import { Inject, Injectable } from "@nestjs/common";
import { Prisma } from "../prisma/client.js";
import type { auditListQuerySchema, Role } from "@taktyl/contracts";
import type { z } from "zod";
import { CLOCK, type Clock } from "../common/clock.js";
import { PrismaService } from "../prisma/prisma.service.js";
import { maskAuditValueForViewer, NON_PERSONAL_ENTITIES, sanitizeForAudit } from "./sanitize.js";

type AuditListQuery = z.output<typeof auditListQuerySchema>;

export interface AuditContext {
  actorId: string | null;
  actorRole: Role | "system";
  requestId: string;
  /** HMAC adresu IP (bez mozliwosci odczytu adresu) */
  ipHash: string | null;
}

export interface AuditEntry {
  /** np. product.update, variant.price.set, order.transition (wzorzec z contracts) */
  action: string;
  entity: string;
  entityId: string;
  before?: unknown;
  after?: unknown;
}

export type RecordAudit = (entry: AuditEntry) => Promise<bigint>;

const ACTION = /^[a-z_]+(?:\.[a-z_]+)+$/;

const toJson = (v: unknown, entity: string): Prisma.InputJsonValue | typeof Prisma.DbNull =>
  v === undefined || v === null
    ? Prisma.DbNull
    : (sanitizeForAudit(v, 0, NON_PERSONAL_ENTITIES.has(entity)) as Prisma.InputJsonValue);

/** Kontekst systemowy (zadania cykliczne, bez uzytkownika). */
export const systemAudit = (requestId: string): AuditContext => ({
  actorId: null,
  actorRole: "system",
  requestId,
  ipHash: null,
});

@Injectable()
export class AuditService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  /** B-011: zapis wpisu w podanej transakcji. Zwraca id wpisu (do powiazania z outbox). */
  async record(
    tx: Prisma.TransactionClient,
    ctx: AuditContext,
    entry: AuditEntry,
  ): Promise<bigint> {
    if (!ACTION.test(entry.action))
      throw new Error(`Niepoprawna nazwa akcji audytu: ${entry.action}`);
    const row = await tx.auditLog.create({
      data: {
        at: this.clock(),
        actorId: ctx.actorId,
        actorRole: ctx.actorRole,
        action: entry.action,
        entity: entry.entity,
        entityId: entry.entityId,
        before: toJson(entry.before, entry.entity),
        after: toJson(entry.after, entry.entity),
        requestId: ctx.requestId,
        ipHash: ctx.ipHash,
      },
      select: { id: true },
    });
    return row.id;
  }

  /**
   * B-011: wykonuje mutacje i zapisuje wpis(y) audytu w jednej transakcji bazy. Wyjatek wycofuje oba.
   * `work` dostaje klienta transakcji i funkcje `audit(entry)`.
   */
  withAudit<T>(
    ctx: AuditContext,
    work: (tx: Prisma.TransactionClient, audit: RecordAudit) => Promise<T>,
  ): Promise<T> {
    return this.prisma.$transaction((tx) => work(tx, (entry) => this.record(tx, ctx, entry)), {
      timeout: 20_000,
      maxWait: 10_000,
    });
  }

  /** B-012: lista dziennika (page/per_page wg docs/16 par. 1), najnowsze pierwsze. Viewer: pola osobowe zamaskowane. */
  async list(query: AuditListQuery, role: Role) {
    const where: Prisma.AuditLogWhereInput = {
      ...(query.entity ? { entity: query.entity } : {}),
      ...(query.entity_id ? { entityId: query.entity_id } : {}),
      ...(query.actor_id ? { actorId: query.actor_id } : {}),
      ...(query.from || query.to
        ? {
            at: {
              ...(query.from ? { gte: new Date(query.from) } : {}),
              ...(query.to ? { lte: new Date(query.to) } : {}),
            },
          }
        : {}),
    };
    const [total, rows] = await Promise.all([
      this.prisma.auditLog.count({ where }),
      this.prisma.auditLog.findMany({
        where,
        orderBy: [{ at: "desc" }, { id: "desc" }],
        skip: (query.page - 1) * query.per_page,
        take: query.per_page,
      }),
    ]);
    const mask = role === "viewer";
    return {
      items: rows.map((r) => ({
        id: r.id.toString(),
        at: r.at.toISOString(),
        actor_id: r.actorId,
        actor_role: r.actorRole,
        action: r.action,
        entity: r.entity,
        entity_id: r.entityId,
        before:
          mask && !NON_PERSONAL_ENTITIES.has(r.entity)
            ? maskAuditValueForViewer(r.before)
            : r.before,
        after:
          mask && !NON_PERSONAL_ENTITIES.has(r.entity) ? maskAuditValueForViewer(r.after) : r.after,
        request_id: r.requestId,
      })),
      page: query.page,
      per_page: query.per_page,
      total,
    };
  }
}
