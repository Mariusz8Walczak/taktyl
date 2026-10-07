// F-170: modul zamowien.
import { Module } from "@nestjs/common";
import { CartQuoteModule } from "../cart-quote/cart-quote.module.js";
import { OrderAccessService } from "./order-access.service.js";
import { OrdersController } from "./orders.controller.js";
import { OrdersService } from "./orders.service.js";

@Module({
  imports: [CartQuoteModule],
  controllers: [OrdersController],
  providers: [OrdersService, OrderAccessService],
  exports: [OrderAccessService],
})
export class OrdersModule {}
