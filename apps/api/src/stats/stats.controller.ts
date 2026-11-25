// B-610..B-626 (docs/16 par. 3.5): odczyt statystyk pulpitu, ruchu, operacji, kondycji systemu i wyszukiwarka globalna.
// Kazda rola (viewer tez); odpowiedzi bez danych osobowych, bez cache.
import { Controller, Get, Header, Inject, Query } from "@nestjs/common";
import { adminSearchQuerySchema, statsRangeQuerySchema } from "@taktyl/contracts";
import type { z } from "zod";
import { Roles } from "../auth/decorators.js";
import { ZodPipe } from "../common/zod.pipe.js";
import { SalesStatsService } from "./sales-stats.service.js";
import { SystemService } from "./system.service.js";
import { TrafficStatsService } from "./traffic-stats.service.js";

type RangeQuery = z.output<typeof statsRangeQuerySchema>;

@Controller("admin")
export class StatsController {
  constructor(
    @Inject(SalesStatsService) private readonly sales: SalesStatsService,
    @Inject(TrafficStatsService) private readonly trafficStats: TrafficStatsService,
    @Inject(SystemService) private readonly system: SystemService,
  ) {}

  @Get("stats/sales")
  @Roles("viewer")
  @Header("Cache-Control", "no-store")
  salesStats(@Query(new ZodPipe(statsRangeQuerySchema)) q: RangeQuery) {
    return this.sales.sales(q);
  }

  @Get("stats/traffic")
  @Roles("viewer")
  @Header("Cache-Control", "no-store")
  traffic(@Query(new ZodPipe(statsRangeQuerySchema)) q: RangeQuery) {
    return this.trafficStats.traffic(q);
  }

  @Get("stats/operations")
  @Roles("viewer")
  @Header("Cache-Control", "no-store")
  operations() {
    return this.sales.operations();
  }

  @Get("system")
  @Roles("viewer")
  @Header("Cache-Control", "no-store")
  status() {
    return this.system.status();
  }

  @Get("search")
  @Roles("viewer")
  @Header("Cache-Control", "no-store")
  search(@Query(new ZodPipe(adminSearchQuerySchema)) q: z.output<typeof adminSearchQuerySchema>) {
    return this.system.search(q.q);
  }
}
