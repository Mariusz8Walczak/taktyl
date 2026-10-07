// F-177: modul symulacji platnosci.
import { Module } from "@nestjs/common";
import { OrdersModule } from "../orders/orders.module.js";
import { OutboxModule } from "../outbox/outbox.module.js";
import { PaymentsSimController } from "./payments-sim.controller.js";
import { PaymentsSimService } from "./payments-sim.service.js";

@Module({
  imports: [OrdersModule, OutboxModule],
  controllers: [PaymentsSimController],
  providers: [PaymentsSimService],
})
export class PaymentsSimModule {}
