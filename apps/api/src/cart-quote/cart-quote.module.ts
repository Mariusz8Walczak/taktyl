// F-150: modul wyceny koszyka.
import { Module } from "@nestjs/common";
import { CatalogModule } from "../catalog/catalog.module.js";
import { ConfiguratorModule } from "../configurator/configurator.module.js";
import { SettingsModule } from "../settings/settings.module.js";
import { CartQuoteController } from "./cart-quote.controller.js";
import { CartQuoteService } from "./cart-quote.service.js";

@Module({
  imports: [CatalogModule, SettingsModule, ConfiguratorModule],
  controllers: [CartQuoteController],
  providers: [CartQuoteService],
  exports: [CartQuoteService],
})
export class CartQuoteModule {}
