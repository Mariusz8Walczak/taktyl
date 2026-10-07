// B-400...B-408 (docs/16 par. 3.5): GET/PATCH /v1/admin/settings. Odczyt: viewer; zapis: tylko owner (docs/15 par. 10), If-Match.
import { Body, Controller, Get, Headers, Inject, Patch, Res } from "@nestjs/common";
import { adminSettingsSchema, settingsPatchSchema } from "@taktyl/contracts";
import type { Response } from "express";
import type { z } from "zod";
import { Actor } from "../auth/admin-request.js";
import { Roles } from "../auth/decorators.js";
import type { AuditContext } from "../audit/audit.service.js";
import { etagOf, parseIfMatch } from "../common/if-match.js";
import { respond, ZodPipe } from "../common/zod.pipe.js";
import { AdminSettingsService } from "./admin-settings.service.js";

@Controller("admin/settings")
export class AdminSettingsController {
  constructor(@Inject(AdminSettingsService) private readonly settings: AdminSettingsService) {}

  @Get()
  @Roles("viewer")
  async get(@Res({ passthrough: true }) res: Response) {
    const body = respond(adminSettingsSchema, await this.settings.get());
    res.setHeader("ETag", etagOf(body.version));
    return body;
  }

  @Patch()
  @Roles("owner")
  async patch(
    @Headers("if-match") ifMatch: string | undefined,
    @Body(new ZodPipe(settingsPatchSchema)) body: z.output<typeof settingsPatchSchema>,
    @Actor() ctx: AuditContext,
    @Res({ passthrough: true }) res: Response,
  ) {
    const version = parseIfMatch(ifMatch, true) as number;
    const out = respond(adminSettingsSchema, await this.settings.patch(body, version, ctx));
    res.setHeader("ETag", etagOf(out.version));
    return out;
  }
}
