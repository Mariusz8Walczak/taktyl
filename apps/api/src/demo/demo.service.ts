// B-014 (docs/15 par. 6, docs/18 G), I-009 (TAKTYL-65): reset danych demo z backpanelu. Reuzywa seeda (`runSeed` z `reset`):
// TRUNCATE + seed + wpis audytu + znaczniki outboxa w jednej transakcji; konta i sesje backpanelu zostaja.
// Tylko DEMO_MODE=true (inaczej 404, jakby endpointu nie bylo).
import { Inject, Injectable, Logger } from "@nestjs/common";
import { findSeedRoot } from "../../prisma/seed/root.js";
import { runSeed } from "../../prisma/seed/run.js";
import type { AuditContext } from "../audit/audit.service.js";
import { notFound } from "../common/app-exception.js";
import { CLOCK, type Clock } from "../common/clock.js";
import { APP_CONFIG } from "../config/config.module.js";
import type { AppConfig } from "../config/env.js";
import { PrismaService } from "../prisma/prisma.service.js";

@Injectable()
export class DemoService {
  private readonly log = new Logger(DemoService.name);

  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  async reset(ctx: AuditContext): Promise<{ status: "reset"; at: string }> {
    if (!this.config.DEMO_MODE) throw notFound();
    const at = this.clock();
    await runSeed(this.prisma, {
      root: findSeedRoot(import.meta.url),
      now: at,
      reset: true,
      notify: { actorId: ctx.actorId, actorRole: "owner", requestId: ctx.requestId },
    });
    this.log.log("reset danych demo wykonany z backpanelu");
    return { status: "reset", at: at.toISOString() };
  }
}
