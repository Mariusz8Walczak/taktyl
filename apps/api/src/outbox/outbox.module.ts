// B-060, B-061, B-219: modul outbox (zapis znacznikow, worker wysylki webhooka HMAC, reczna rewalidacja).
import { Module } from "@nestjs/common";
import { OutboxService } from "./outbox.service.js";
import { OutboxWorker } from "./outbox.worker.js";
import { RevalidateController } from "./revalidate.controller.js";
import { RevalidationService } from "./revalidation.service.js";

@Module({
  controllers: [RevalidateController],
  providers: [OutboxService, RevalidationService, OutboxWorker],
  exports: [OutboxService, OutboxWorker, RevalidationService],
})
export class OutboxModule {}
