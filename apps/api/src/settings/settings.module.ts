// B-215: modul ustawien sklepu.
import { Module } from "@nestjs/common";
import { SettingsController } from "./settings.controller.js";
import { SettingsService } from "./settings.service.js";
import { ShopConfigService } from "./shop-config.service.js";

@Module({
  controllers: [SettingsController],
  providers: [SettingsService, ShopConfigService],
  exports: [ShopConfigService],
})
export class SettingsModule {}
