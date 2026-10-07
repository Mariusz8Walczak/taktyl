// F-221, F-223 (docs/16 par. 2): POST /v1/forms/contact i /v1/forms/newsletter. Limit 5/min/IP na endpoint (docs/14 par. 7),
// walidacja strictObject (nieznane pola = 422), odpowiedz bez cache (no-store ustawia requestContext).
import { Body, Controller, HttpCode, Inject, Post } from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import { contactFormSchema, newsletterFormSchema } from "@taktyl/contracts";
import type { z } from "zod";
import { LIMITS } from "../common/rate-limits.js";
import { ZodPipe } from "../common/zod.pipe.js";
import { FormsService } from "./forms.service.js";

@Controller("forms")
export class FormsController {
  constructor(@Inject(FormsService) private readonly forms: FormsService) {}

  @Post("contact")
  @HttpCode(201)
  @Throttle({ default: LIMITS.form })
  contact(@Body(new ZodPipe(contactFormSchema)) body: z.output<typeof contactFormSchema>) {
    return this.forms.contact(body);
  }

  @Post("newsletter")
  @HttpCode(201)
  @Throttle({ default: LIMITS.form })
  newsletter(@Body(new ZodPipe(newsletterFormSchema)) body: z.output<typeof newsletterFormSchema>) {
    return this.forms.newsletter(body);
  }
}
