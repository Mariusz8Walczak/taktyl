// F-150...F-157 (docs/16 par. 2): POST /v1/cart/quote bez cache (Cache-Control: no-store ustawia requestContext).
import { Body, Controller, HttpCode, Inject, Post } from "@nestjs/common";
import { quoteRequestSchema } from "@taktyl/contracts";
import type { z } from "zod";
import { ZodPipe } from "../common/zod.pipe.js";
import { CartQuoteService } from "./cart-quote.service.js";

@Controller("cart")
export class CartQuoteController {
  constructor(@Inject(CartQuoteService) private readonly quotes: CartQuoteService) {}

  @Post("quote")
  @HttpCode(200)
  quote(@Body(new ZodPipe(quoteRequestSchema)) body: z.output<typeof quoteRequestSchema>) {
    return this.quotes.quote({
      items: body.items,
      coupon: body.coupon,
      shippingMethod: body.shipping_method,
    });
  }
}
