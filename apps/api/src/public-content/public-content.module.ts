// F-076, F-220, F-221, F-223: modul publicznych tresci, opinii demo i formularzy (docs/16 par. 2).
import { Module } from "@nestjs/common";
import { FormsController } from "./forms.controller.js";
import { FormsService } from "./forms.service.js";
import { MessagesRetentionService } from "./messages-retention.service.js";
import { PublicContentController } from "./public-content.controller.js";
import { PublicContentService } from "./public-content.service.js";

@Module({
  controllers: [PublicContentController, FormsController],
  providers: [PublicContentService, FormsService, MessagesRetentionService],
})
export class PublicContentModule {}
