// B-500..B-508: modul mediow w backpanelu (manifest zdjec, wgrywanie, usuwanie).
import { Module } from "@nestjs/common";
import { OutboxModule } from "../outbox/outbox.module.js";
import { AdminMediaController } from "./admin-media.controller.js";
import { AdminMediaService } from "./admin-media.service.js";

@Module({
  imports: [OutboxModule],
  controllers: [AdminMediaController],
  providers: [AdminMediaService],
  exports: [AdminMediaService],
})
export class AdminMediaModule {}
