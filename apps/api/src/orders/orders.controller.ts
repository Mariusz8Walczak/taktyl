// F-170...F-180, F-201, F-202 (docs/16 par. 2): cienki kontroler zamowien. Brak cache (no-store ustawia requestContext).
import { Body, Controller, Get, Headers, HttpCode, Inject, Param, Post } from "@nestjs/common";
import { idempotencyKeySchema, orderNumberSchema, orderRequestSchema } from "@taktyl/contracts";
import type { z } from "zod";
import { validationFailed } from "../common/app-exception.js";
import { ZodPipe } from "../common/zod.pipe.js";
import { OrdersService } from "./orders.service.js";

@Controller("orders")
export class OrdersController {
  constructor(@Inject(OrdersService) private readonly orders: OrdersService) {}

  @Post()
  @HttpCode(201)
  create(
    @Headers("idempotency-key") key: string | undefined,
    @Body(new ZodPipe(orderRequestSchema)) body: z.output<typeof orderRequestSchema>,
  ) {
    const parsed = idempotencyKeySchema.safeParse(key);
    if (!parsed.success) {
      throw validationFailed([
        {
          path: "Idempotency-Key",
          code: "required",
          message: "Wymagany naglowek Idempotency-Key (UUID).",
        },
      ]);
    }
    return this.orders.create(body, parsed.data);
  }

  @Get()
  list(@Headers("x-order-token") token: string | undefined) {
    return this.orders.list(token);
  }

  @Get(":number")
  get(
    @Param("number", new ZodPipe(orderNumberSchema)) number: string,
    @Headers("x-order-token") token: string | undefined,
  ) {
    return this.orders.get(number, token);
  }
}
