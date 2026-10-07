// F-001, F-065, F-101, F-172 (docs/16 par. 2): cienki kontroler ustawien publicznych.
import { Controller, Get, Inject, Query } from "@nestjs/common";
import { pickupPointsQuerySchema, shippingEstimateQuerySchema } from "@taktyl/contracts";
import type { z } from "zod";
import { ZodPipe } from "../common/zod.pipe.js";
import { SettingsService } from "./settings.service.js";

@Controller()
export class SettingsController {
  constructor(@Inject(SettingsService) private readonly settings: SettingsService) {}

  @Get("shop-settings")
  shopSettings() {
    return this.settings.shopSettings();
  }

  @Get("shipping-estimate")
  shippingEstimate(
    @Query(new ZodPipe(shippingEstimateQuerySchema))
    q: z.output<typeof shippingEstimateQuerySchema>,
  ) {
    return this.settings.shippingEstimate(q.method);
  }

  @Get("pickup-points")
  pickupPoints(
    @Query(new ZodPipe(pickupPointsQuerySchema)) q: z.output<typeof pickupPointsQuerySchema>,
  ) {
    return this.settings.pickupPoints(q.city);
  }

  @Get("rules")
  rules() {
    return this.settings.rules();
  }
}
