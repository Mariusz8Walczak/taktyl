// B-300...B-309: modul tresci w backpanelu (strony, poradnik, FAQ, opisy produktow, opinie demo, zgloszenia).
import { Module } from "@nestjs/common";
import { OutboxModule } from "../outbox/outbox.module.js";
import { AdminContentController } from "./admin-content.controller.js";
import { AdminContentService } from "./admin-content.service.js";
import { AdminMessagesService } from "./admin-messages.service.js";
import { AdminReviewsService } from "./admin-reviews.service.js";

@Module({
  imports: [OutboxModule],
  controllers: [AdminContentController],
  providers: [AdminContentService, AdminReviewsService, AdminMessagesService],
})
export class AdminContentModule {}
