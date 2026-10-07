// F-221, F-223 (docs/17 par. 9, ADR-0007): zadanie cykliczne - po MESSAGE_RETENTION_DAYS (30) dniach wiadomosci z kontaktu
// i zapisy do newslettera sa USUWANE (dane osobowe). Wzorzec jak OrderRetentionService: interwal w procesie API, zadanie
// idempotentne (kilka instancji nie szkodzi), w testach wywolywane recznie (purge) albo na falszywych zegarach.
// Wpis w audit_log niesie tylko liczby i date graniczna, bez e-maili i tresci.
import {
  Inject,
  Injectable,
  Logger,
  type OnApplicationBootstrap,
  type OnApplicationShutdown,
} from "@nestjs/common";
import { AuditService, systemAudit } from "../audit/audit.service.js";
import { CLOCK, type Clock } from "../common/clock.js";
import { APP_CONFIG } from "../config/config.module.js";
import type { AppConfig } from "../config/env.js";
import { PrismaService } from "../prisma/prisma.service.js";

export const MESSAGES_RETENTION_INTERVAL_MS = 6 * 60 * 60 * 1000;

@Injectable()
export class MessagesRetentionService implements OnApplicationBootstrap, OnApplicationShutdown {
  private readonly log = new Logger(MessagesRetentionService.name);
  private timer: NodeJS.Timeout | undefined;

  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(AuditService) private readonly audit: AuditService,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  onApplicationBootstrap(): void {
    // W testach integracyjnych zadanie wywolujemy recznie (purge), bez zegara w tle.
    if (this.config.NODE_ENV === "test") return;
    const run = () =>
      void this.purge().catch((e: unknown) =>
        this.log.error(`retencja zgloszen: ${e instanceof Error ? e.name : "blad"}`),
      );
    run();
    this.timer = setInterval(run, MESSAGES_RETENTION_INTERVAL_MS);
    this.timer.unref();
  }

  onApplicationShutdown(): void {
    if (this.timer) clearInterval(this.timer);
  }

  /** Usuwa zgloszenia starsze niz okres retencji. Zwraca liczby usunietych wierszy. */
  async purge(): Promise<{ contact: number; newsletter: number }> {
    const now = this.clock();
    const cutoff = new Date(now.getTime() - this.config.MESSAGE_RETENTION_DAYS * 86_400_000);
    return this.audit.withAudit(
      systemAudit(`messages-retention-${now.getTime()}`),
      async (tx, audit) => {
        const contact = await tx.contactMessage.deleteMany({
          where: { createdAt: { lt: cutoff } },
        });
        const newsletter = await tx.newsletterSignup.deleteMany({
          where: { createdAt: { lt: cutoff } },
        });
        const counts = { contact: contact.count, newsletter: newsletter.count };
        if (counts.contact + counts.newsletter > 0) {
          await audit({
            action: "messages.retention_purge",
            entity: "message",
            entityId: "retention",
            after: { ...counts, older_than: cutoff.toISOString() },
          });
          this.log.log(
            `retencja zgloszen: usunieto ${counts.contact} wiadomosci i ${counts.newsletter} zapisow newslettera`,
          );
        }
        return counts;
      },
    );
  }
}
