// B-103: korzen aplikacji; moduly domenowe wg docs/16 (katalog, wyszukiwanie, presety, ustawienia, ...).
import { Module } from "@nestjs/common";
import { APP_GUARD } from "@nestjs/core";
import { ThrottlerGuard, ThrottlerModule } from "@nestjs/throttler";
import { AdminCatalogModule } from "./admin-catalog/admin-catalog.module.js";
import { AdminSettingsModule } from "./admin-settings/admin-settings.module.js";
import { AdminContentModule } from "./admin-content/admin-content.module.js";
import { AdminOrdersModule } from "./admin-orders/admin-orders.module.js";
import { AuditModule } from "./audit/audit.module.js";
import { AuthModule } from "./auth/auth.module.js";
import { CartQuoteModule } from "./cart-quote/cart-quote.module.js";
import { CatalogModule } from "./catalog/catalog.module.js";
import { CommonModule } from "./common/common.module.js";
import { configureDemoThrottle, RATE_WINDOW_MS, LIMITS } from "./common/rate-limits.js";
import { APP_CONFIG, ConfigModule } from "./config/config.module.js";
import type { AppConfig } from "./config/env.js";
import { DemoModule } from "./demo/demo.module.js";
import { HealthController } from "./health/health.controller.js";
import { OpenApiModule } from "./openapi/openapi.module.js";
import { OrdersModule } from "./orders/orders.module.js";
import { OutboxModule } from "./outbox/outbox.module.js";
import { PaymentsSimModule } from "./payments-sim/payments-sim.module.js";
import { PresetsModule } from "./presets/presets.module.js";
import { PublicContentModule } from "./public-content/public-content.module.js";
import { PricingModule } from "./pricing/pricing.module.js";
import { PrismaModule } from "./prisma/prisma.module.js";
import { SearchModule } from "./search/search.module.js";
import { SettingsModule } from "./settings/settings.module.js";
import { UsersModule } from "./users/users.module.js";

@Module({
  imports: [
    ConfigModule,
    CommonModule,
    PrismaModule,
    AuditModule,
    AuthModule,
    UsersModule,
    PricingModule,
    CatalogModule,
    SearchModule,
    PresetsModule,
    SettingsModule,
    CartQuoteModule,
    OutboxModule,
    OrdersModule,
    PaymentsSimModule,
    AdminOrdersModule,
    AdminCatalogModule,
    AdminSettingsModule,
    AdminContentModule,
    PublicContentModule,
    DemoModule,
    OpenApiModule,
    ThrottlerModule.forRootAsync({
      inject: [APP_CONFIG],
      useFactory: (config: AppConfig) => {
        configureDemoThrottle(config);
        return {
        throttlers: [{ name: "default", ttl: RATE_WINDOW_MS, limit: LIMITS.default.limit }],
        skipIf: () => !config.RATE_LIMIT_ENABLED,
        };
      },
    }),
  ],
  controllers: [HealthController],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}
