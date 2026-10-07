// F-177...F-179 (docs/16 par. 6.3): POST /v1/orders/{number}/payment/simulate (X-Order-Token).
import { Body, Controller, Headers, HttpCode, Inject, Param, Post } from "@nestjs/common";
import { orderNumberSchema, paymentSimulateRequestSchema } from "@taktyl/contracts";
import type { z } from "zod";
import { ZodPipe } from "../common/zod.pipe.js";
import { PaymentsSimService } from "./payments-sim.service.js";

@Controller("orders")
export class PaymentsSimController {
  constructor(@Inject(PaymentsSimService) private readonly payments: PaymentsSimService) {}

  @Post(":number/payment/simulate")
  @HttpCode(200)
  simulate(
    @Param("number", new ZodPipe(orderNumberSchema)) number: string,
    @Headers("x-order-token") token: string | undefined,
    @Body(new ZodPipe(paymentSimulateRequestSchema))
    body: z.output<typeof paymentSimulateRequestSchema>,
  ) {
    return this.payments.simulate(number, token, body.outcome);
  }
}
