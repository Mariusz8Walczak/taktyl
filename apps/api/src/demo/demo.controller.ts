// B-014 (docs/16): POST /v1/admin/demo/reset - owner, tylko DEMO_MODE=true (inaczej 404), body { confirm: "reset" }.
import { Body, Controller, HttpCode, Inject, Post } from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import { demoResetRequestSchema, demoResetResponseSchema } from "@taktyl/contracts";
import type { z } from "zod";
import { Actor } from "../auth/admin-request.js";
import { Roles } from "../auth/decorators.js";
import type { AuditContext } from "../audit/audit.service.js";
import { LIMITS } from "../common/rate-limits.js";
import { respond, ZodPipe } from "../common/zod.pipe.js";
import { DemoService } from "./demo.service.js";

@Controller("admin/demo")
export class DemoController {
  constructor(@Inject(DemoService) private readonly demo: DemoService) {}

  @Post("reset")
  @Roles("owner")
  @HttpCode(200)
  @Throttle({ default: LIMITS.demoReset })
  async reset(
    @Body(new ZodPipe(demoResetRequestSchema)) _body: z.output<typeof demoResetRequestSchema>,
    @Actor() ctx: AuditContext,
  ) {
    return respond(demoResetResponseSchema, await this.demo.reset(ctx));
  }
}
