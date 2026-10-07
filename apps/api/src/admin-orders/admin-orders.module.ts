// B-200...B-209: modul zamowien w backpanelu (lista, szczegoly, statusy, notatki, retencja danych osobowych).
import { Module } from "@nestjs/common";
import { OutboxModule } from "../outbox/outbox.module.js";
import { AdminOrdersController } from "./admin-orders.controller.js";
import { AdminOrdersService } from "./admin-orders.service.js";
import { OrderRetentionService } from "./order-retention.service.js";

@Module({
  imports: [OutboxModule],
  controllers: [AdminOrdersController],
  providers: [AdminOrdersService, OrderRetentionService],
})
export class AdminOrdersModule {}
