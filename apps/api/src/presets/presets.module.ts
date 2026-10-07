// F-111: modul presetow.
import { Module } from "@nestjs/common";
import { PresetsController } from "./presets.controller.js";
import { PresetsService } from "./presets.service.js";

@Module({
  controllers: [PresetsController],
  providers: [PresetsService],
  exports: [PresetsService],
})
export class PresetsModule {}
