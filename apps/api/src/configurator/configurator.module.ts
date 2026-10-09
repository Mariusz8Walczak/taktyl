// F-250..F-256 (ADR-0011): modul konfiguratora kolorow.
import { Module } from "@nestjs/common";
import { CatalogModule } from "../catalog/catalog.module.js";
import { ConfiguratorController } from "./configurator.controller.js";
import { ConfiguratorService } from "./configurator.service.js";

@Module({
  imports: [CatalogModule],
  controllers: [ConfiguratorController],
  providers: [ConfiguratorService],
})
export class ConfiguratorModule {}
