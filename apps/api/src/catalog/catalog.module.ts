// F-020 (B-216): modul katalogu.
import { Module } from "@nestjs/common";
import { PricingModule } from "../pricing/pricing.module.js";
import { CatalogController } from "./catalog.controller.js";
import { CatalogLoader } from "./catalog.loader.js";
import { CatalogService } from "./catalog.service.js";

@Module({
  imports: [PricingModule],
  controllers: [CatalogController],
  providers: [CatalogLoader, CatalogService],
  exports: [CatalogLoader],
})
export class CatalogModule {}
