// B-230 (docs/14 par. 8): liveness (/health) i readiness (/health/ready, alias /ready): baza, migracje, kolejka outbox.
import { Controller, Get, Inject } from "@nestjs/common";
import { SkipThrottle } from "@nestjs/throttler";
import { AppException } from "../common/app-exception.js";
import { PrismaService } from "../prisma/prisma.service.js";

/** docs/14 par. 8: kolejka outbox ponizej progu (powyzej: aplikacja nie jest gotowa). */
export const OUTBOX_PENDING_LIMIT = 1000;

export interface ReadyReport {
  status: "ok";
  checks: { database: "ok"; migrations: "ok"; outbox_pending: number };
}

@Controller()
@SkipThrottle()
export class HealthController {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  @Get("health")
  live(): { status: "ok" } {
    return { status: "ok" };
  }

  @Get(["health/ready", "ready"])
  async ready(): Promise<ReadyReport> {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
    } catch {
      throw new AppException(503, "internal_error", "Baza danych jest niedostepna.");
    }
    let pendingMigrations: number;
    try {
      const rows = await this.prisma.$queryRaw<{ n: number }[]>`
        SELECT count(*)::int AS n FROM _prisma_migrations WHERE finished_at IS NULL AND rolled_back_at IS NULL`;
      pendingMigrations = rows[0]?.n ?? 0;
    } catch {
      throw new AppException(503, "internal_error", "Migracje nie zostaly zastosowane.");
    }
    if (pendingMigrations > 0)
      throw new AppException(503, "internal_error", "Migracje sa w toku lub nieudane.");
    const outbox = await this.prisma.outbox.count({ where: { status: "pending" } });
    if (outbox > OUTBOX_PENDING_LIMIT) {
      throw new AppException(503, "internal_error", "Kolejka outbox przekracza prog.");
    }
    return { status: "ok", checks: { database: "ok", migrations: "ok", outbox_pending: outbox } };
  }
}
