// B-400...B-408: modul ustawien sklepu w backpanelu.
import { Module } from "@nestjs/common";
import { OutboxModule } from "../outbox/outbox.module.js";
import { AdminSettingsController } from "./admin-settings.controller.js";
import { AdminSettingsService } from "./admin-settings.service.js";

@Module({
  imports: [OutboxModule],
  controllers: [AdminSettingsController],
  providers: [AdminSettingsService],
})
export class AdminSettingsModule {}
