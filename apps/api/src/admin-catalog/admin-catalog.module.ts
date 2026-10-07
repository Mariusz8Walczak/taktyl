// B-100...B-115: modul katalogu w backpanelu (produkty, warianty, ceny, stany, gotowe sety).
import { Module } from "@nestjs/common";
import { OutboxModule } from "../outbox/outbox.module.js";
import { PresetsModule } from "../presets/presets.module.js";
import { PricingModule } from "../pricing/pricing.module.js";
import { AdminCatalogController } from "./admin-catalog.controller.js";
import { AdminCatalogService } from "./admin-catalog.service.js";
import { AdminPresetsService } from "./admin-presets.service.js";

@Module({
  imports: [OutboxModule, PricingModule, PresetsModule],
  controllers: [AdminCatalogController],
  providers: [AdminCatalogService, AdminPresetsService],
})
export class AdminCatalogModule {}
