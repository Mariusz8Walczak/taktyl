// B-209 (ADR-0007, docs/17 par. 9): zadanie cykliczne - po ORDER_RETENTION_DAYS (30) dniach pola osobowe zamowien
// (e-mail, telefon, adres dostawy, dane do faktury) sa puste; numer, kwoty, pozycje i statusy zostaja.
// Notatki wewnetrzne nie sa dotykane (pisze je personel). Zadanie jest idempotentne, wiec kilka instancji API mu nie szkodzi.
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

const INTERVAL_MS = 6 * 60 * 60 * 1000;

@Injectable()
export class OrderRetentionService implements OnApplicationBootstrap, OnApplicationShutdown {
  private readonly log = new Logger(OrderRetentionService.name);
  private timer: NodeJS.Timeout | undefined;

  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(AuditService) private readonly audit: AuditService,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  onApplicationBootstrap(): void {
    // W testach zadanie wywolujemy recznie (purge), bez zegara w tle.
    if (this.config.NODE_ENV === "test") return;
    const run = () =>
      void this.purge().catch((e: unknown) => this.log.error(`retencja zamowien: ${String(e)}`));
    run();
    this.timer = setInterval(run, INTERVAL_MS);
    this.timer.unref();
  }

  onApplicationShutdown(): void {
    if (this.timer) clearInterval(this.timer);
  }

  /** Czysci dane osobowe zamowien starszych niz okres retencji. Zwraca liczbe zamowien. */
  async purge(): Promise<number> {
    const now = this.clock();
    const cutoff = new Date(now.getTime() - this.config.ORDER_RETENTION_DAYS * 86_400_000);
    return this.audit.withAudit(systemAudit(`retention-${now.getTime()}`), async (tx, audit) => {
      const rows = await tx.$queryRaw<{ number: string }[]>`
        UPDATE orders
           SET contact_email = NULL, contact_phone = NULL, shipping_address = NULL, invoice = NULL
         WHERE created_at < ${cutoff}
           AND (contact_email IS NOT NULL OR contact_phone IS NOT NULL
                OR shipping_address IS NOT NULL OR invoice IS NOT NULL)
        RETURNING number`;
      if (rows.length > 0) {
        await audit({
          action: "orders.retention_purge",
          entity: "order",
          entityId: "retention",
          after: { count: rows.length, older_than: cutoff.toISOString() },
        });
        this.log.log(`retencja zamowien: wyczyszczono dane osobowe w ${rows.length} zamowieniach`);
      }
      return rows.length;
    });
  }
}
