// F-250..F-256 (ADR-0011): cienki kontroler konfiguratora; wycena bez cache jak koszyk.
import { Body, Controller, Get, HttpCode, Inject, Post } from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import { configurationSchema } from "@taktyl/contracts";
import type { z } from "zod";
import { LIMITS } from "../common/rate-limits.js";
import { ZodPipe } from "../common/zod.pipe.js";
import { ConfiguratorService } from "./configurator.service.js";

@Controller("configurator")
export class ConfiguratorController {
  constructor(@Inject(ConfiguratorService) private readonly configurator: ConfiguratorService) {}

  @Get()
  dictionaries() {
    return this.configurator.dictionaries();
  }

  @Post("quote")
  @HttpCode(200)
  @Throttle({ default: LIMITS.quote })
  quote(@Body(new ZodPipe(configurationSchema)) body: z.output<typeof configurationSchema>) {
    return this.configurator.quote(body);
  }
}
