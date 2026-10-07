// B-060 (ADR-0003, docs/17 par. 3.6): worker outboxa. Pobiera wiersze `pending` pod `FOR UPDATE SKIP LOCKED` (bezpieczne
// wielokrotne uruchomienie), laczy i deduplikuje znaczniki w jedno wywolanie webhooka, ponawia z wykladniczym opoznieniem
// (5 s, 15 s, 45 s ... do 5 min), po 8 probach oznacza `failed`. Uruchamiany interwalem i pobudzany po zapisie.
import {
  Inject,
  Injectable,
  Logger,
  type OnApplicationBootstrap,
  type OnApplicationShutdown,
} from "@nestjs/common";
import { CLOCK, type Clock } from "../common/clock.js";
import { APP_CONFIG } from "../config/config.module.js";
import type { AppConfig } from "../config/env.js";
import { PrismaService } from "../prisma/prisma.service.js";
import { OutboxService } from "./outbox.service.js";
import { RevalidationService } from "./revalidation.service.js";
import { aggregateTags, chunkTags } from "./tags.js";

export const MAX_ATTEMPTS = 8;
export const BASE_DELAY_MS = 5_000;
export const MAX_DELAY_MS = 5 * 60_000;
const DAY_MS = 86_400_000;

/** Opoznienie przed kolejna proba po `attempts` nieudanych probach: 5 s * 3^(n-1), maks. 5 min. */
export function backoffMs(attempts: number): number {
  return Math.min(BASE_DELAY_MS * 3 ** Math.max(0, attempts - 1), MAX_DELAY_MS);
}

export interface RunResult {
  picked: number;
  sent: number;
  retried: number;
  failed: number;
}

interface Row {
  id: bigint;
  tags: string[];
  attempts: number;
}

@Injectable()
export class OutboxWorker implements OnApplicationBootstrap, OnApplicationShutdown {
  private readonly log = new Logger("OutboxWorker");
  private timer: ReturnType<typeof setInterval> | null = null;
  private unsubscribe: (() => void) | null = null;
  private running = false;
  private lastCleanup = 0;
  /** Metryki w pamieci (docs/14 par. 8): sumy od startu procesu. */
  readonly stats = { runs: 0, sent: 0, retried: 0, failed: 0, consecutiveFailures: 0 };

  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(OutboxService) private readonly outbox: OutboxService,
    @Inject(RevalidationService) private readonly revalidation: RevalidationService,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  onApplicationBootstrap(): void {
    if (!this.config.OUTBOX_WORKER_ENABLED) return;
    if (!this.revalidation.enabled) {
      this.log.warn(
        "REVALIDATE_URL nie jest ustawiony: webhook wylaczony, wiersze outbox zostaja pending",
      );
      return;
    }
    this.unsubscribe = this.outbox.onWake(() => void this.tick());
    this.timer = setInterval(() => void this.tick(), this.config.OUTBOX_POLL_MS);
    this.timer.unref();
    void this.tick();
  }

  onApplicationShutdown(): void {
    if (this.timer) clearInterval(this.timer);
    this.unsubscribe?.();
    this.timer = null;
    this.unsubscribe = null;
  }

  /** Jedno przejscie harmonogramu (bez nakladania sie przebiegow w tym procesie; miedzy procesami chroni SKIP LOCKED). */
  private async tick(): Promise<void> {
    if (this.running) return;
    this.running = true;
    try {
      let r: RunResult;
      do {
        r = await this.runOnce();
      } while (r.picked >= this.config.OUTBOX_BATCH_SIZE && r.sent > 0);
    } catch (e) {
      this.log.error(`Przebieg outbox nie powiodl sie: ${e instanceof Error ? e.message : "blad"}`);
    } finally {
      this.running = false;
    }
  }

  /**
   * B-060: jeden przebieg. Transakcja trzyma blokady pobranych wierszy na czas wywolania webhooka, wiec drugi worker
   * (SKIP LOCKED) bierze inne wiersze; awaria odbiornika = wiersze zostaja `pending` z nowym `next_attempt_at`.
   */
  async runOnce(opts: { batchSize?: number } = {}): Promise<RunResult> {
    const now = this.clock();
    const batch = opts.batchSize ?? this.config.OUTBOX_BATCH_SIZE;
    this.stats.runs += 1;
    const result = await this.prisma.$transaction(
      async (tx): Promise<RunResult> => {
        const rows = await tx.$queryRaw<Row[]>`
          SELECT id, tags, attempts FROM outbox
          WHERE status = 'pending' AND next_attempt_at <= ${now.toISOString()}::timestamptz
          ORDER BY id
          LIMIT ${batch}
          FOR UPDATE SKIP LOCKED`;
        if (rows.length === 0) return { picked: 0, sent: 0, retried: 0, failed: 0 };

        const tags = aggregateTags(rows.map((r) => r.tags));
        let error: string | null = null;
        try {
          for (const chunk of chunkTags(tags)) await this.revalidation.send(chunk);
        } catch (e) {
          error = (e instanceof Error ? e.message : "blad wysylki").slice(0, 500);
        }

        if (error === null) {
          await tx.outbox.updateMany({
            where: { id: { in: rows.map((r) => r.id) } },
            data: { status: "sent", sentAt: now, lastError: null, attempts: { increment: 1 } },
          });
          return { picked: rows.length, sent: rows.length, retried: 0, failed: 0 };
        }

        let retried = 0;
        let failed = 0;
        for (const r of rows) {
          const attempts = r.attempts + 1;
          const exhausted = attempts >= MAX_ATTEMPTS;
          await tx.outbox.update({
            where: { id: r.id },
            data: exhausted
              ? { status: "failed", attempts, lastError: error }
              : {
                  attempts,
                  lastError: error,
                  nextAttemptAt: new Date(now.getTime() + backoffMs(attempts)),
                },
          });
          if (exhausted) failed += 1;
          else retried += 1;
        }
        return { picked: rows.length, sent: 0, retried, failed };
      },
      { timeout: this.config.REVALIDATE_TIMEOUT_MS * 4 + 10_000, maxWait: 10_000 },
    );

    this.stats.sent += result.sent;
    this.stats.retried += result.retried;
    this.stats.failed += result.failed;
    if (result.picked > 0) {
      this.stats.consecutiveFailures = result.sent > 0 ? 0 : this.stats.consecutiveFailures + 1;
      const line = `outbox: wierszy=${result.picked} wyslano=${result.sent} ponowien=${result.retried} nieudanych=${result.failed}`;
      if (result.failed > 0 || this.stats.consecutiveFailures > 3) this.log.warn(line);
      else this.log.log(line);
    }
    await this.cleanup(now);
    return result;
  }

  /** docs/17 par. 9: `sent` 7 dni, `failed` 30 dni (najwyzej raz na godzine). */
  private async cleanup(now: Date): Promise<void> {
    if (now.getTime() - this.lastCleanup < 3_600_000) return;
    this.lastCleanup = now.getTime();
    await this.prisma.outbox.deleteMany({
      where: {
        OR: [
          { status: "sent", sentAt: { lt: new Date(now.getTime() - 7 * DAY_MS) } },
          { status: "failed", createdAt: { lt: new Date(now.getTime() - 30 * DAY_MS) } },
        ],
      },
    });
  }
}
