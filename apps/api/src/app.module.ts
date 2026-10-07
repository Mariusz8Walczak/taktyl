// B-103: korzen aplikacji; moduly domenowe wg docs/16 (katalog, wyszukiwanie, presety, ustawienia, ...).
import { Module } from "@nestjs/common";
import { CartQuoteModule } from "./cart-quote/cart-quote.module.js";
import { CatalogModule } from "./catalog/catalog.module.js";
import { CommonModule } from "./common/common.module.js";
import { ConfigModule } from "./config/config.module.js";
import { HealthController } from "./health/health.controller.js";
import { PresetsModule } from "./presets/presets.module.js";
import { PricingModule } from "./pricing/pricing.module.js";
import { PrismaModule } from "./prisma/prisma.module.js";
import { SearchModule } from "./search/search.module.js";
import { SettingsModule } from "./settings/settings.module.js";

@Module({
  imports: [
    ConfigModule,
    CommonModule,
    PrismaModule,
    PricingModule,
    CatalogModule,
    SearchModule,
    PresetsModule,
    SettingsModule,
    CartQuoteModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
