// B-103: korzen aplikacji. Kolejne moduly (katalog, wycena, zamowienia, admin) dopisuja kolejne zadania.
import { Module } from "@nestjs/common";
import { ConfigModule } from "./config/config.module.js";
import { HealthController } from "./health/health.controller.js";
import { PrismaModule } from "./prisma/prisma.module.js";

@Module({
  imports: [ConfigModule, PrismaModule],
  controllers: [HealthController],
})
export class AppModule {}
