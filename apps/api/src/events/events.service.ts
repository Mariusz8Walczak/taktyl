// B-621 (ADR-0012, docs/10): zapis zdarzen pomiaru. Nazwy i parametry bez zmian (walidacja w @taktyl/contracts),
// anonimowy session_id, bez adresu IP i danych osobowych. Czas zdarzenia z klienta, ale tylko w oknie [teraz - 48 h, teraz + 10 min].
import { Inject, Injectable } from "@nestjs/common";
import { eventsAcceptedSchema, type EventsAccepted, type EventsBatch } from "@taktyl/contracts";
import { validationFailed } from "../common/app-exception.js";
import { CLOCK, type Clock } from "../common/clock.js";
import { respond } from "../common/zod.pipe.js";
import type { Prisma } from "../prisma/client.js";
import { PrismaService } from "../prisma/prisma.service.js";

export const EVENT_MAX_AGE_MS = 48 * 3_600_000;
export const EVENT_MAX_SKEW_MS = 10 * 60_000;

@Injectable()
export class EventsService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  async collect(batch: EventsBatch): Promise<EventsAccepted> {
    const now = this.clock();
    const errors = batch.events.flatMap((e, i) => {
      const at = new Date(e.ts).getTime();
      return at < now.getTime() - EVENT_MAX_AGE_MS || at > now.getTime() + EVENT_MAX_SKEW_MS
        ? [
            {
              path: `events[${i}].ts`,
              code: "out_of_window",
              message: "Czas zdarzenia poza oknem 48 h.",
            },
          ]
        : [];
    });
    if (errors.length > 0) throw validationFailed(errors);
    const { count } = await this.prisma.analyticsEvent.createMany({
      data: batch.events.map((e) => ({
        sessionId: batch.session_id,
        name: e.name,
        params: e.params as Prisma.InputJsonValue,
        ts: new Date(e.ts),
        receivedAt: now,
      })),
    });
    return respond(eventsAcceptedSchema, { accepted: count });
  }
}
