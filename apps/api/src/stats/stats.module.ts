// B-610..B-626: modul statystyk pulpitu (tylko odczyt).
import { Module } from "@nestjs/common";
import { ConfiguratorModule } from "../configurator/configurator.module.js";
import { PricingModule } from "../pricing/pricing.module.js";
import { SalesStatsService } from "./sales-stats.service.js";
import { StatsController } from "./stats.controller.js";
import { SystemService } from "./system.service.js";
import { TrafficStatsService } from "./traffic-stats.service.js";

@Module({
  imports: [PricingModule, ConfiguratorModule],
  controllers: [StatsController],
  providers: [SalesStatsService, TrafficStatsService, SystemService],
})
export class StatsModule {}
