// B-621 (ADR-0012): POST /v1/events - publiczny kolektor zdarzen z docs/10. Limit 60/min/IP, walidacja Zod (strict),
// odpowiedz 202 bez cache. Sklep wysyla zdarzenia dopiero po zgodzie na analityke (docs/10 par. 2).
import { Body, Controller, HttpCode, Inject, Post } from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import { eventsBatchSchema, type EventsBatch } from "@taktyl/contracts";
import { LIMITS } from "../common/rate-limits.js";
import { ZodPipe } from "../common/zod.pipe.js";
import { EventsService } from "./events.service.js";

@Controller("events")
export class EventsController {
  constructor(@Inject(EventsService) private readonly events: EventsService) {}

  @Post()
  @HttpCode(202)
  @Throttle({ default: LIMITS.events })
  collect(@Body(new ZodPipe(eventsBatchSchema)) body: EventsBatch) {
    return this.events.collect(body);
  }
}
