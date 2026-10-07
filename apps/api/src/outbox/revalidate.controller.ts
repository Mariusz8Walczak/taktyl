// B-061 (docs/16 par. 3.5): POST /v1/admin/revalidate (owner) - reczne wyslanie znacznikow (diagnostyka). Znaczniki trafiaja
// do outbox (ten sam mechanizm, ponawianie, audyt), a nie bezposrednio do sklepu.
import { Body, Controller, HttpCode, Inject, Post } from "@nestjs/common";
import { revalidateRequestSchema, revalidateResponseSchema } from "@taktyl/contracts";
import type { z } from "zod";
import { Actor } from "../auth/admin-request.js";
import { Roles } from "../auth/decorators.js";
import { type AuditContext, AuditService } from "../audit/audit.service.js";
import { respond, ZodPipe } from "../common/zod.pipe.js";
import { OutboxService } from "./outbox.service.js";

@Controller("admin/revalidate")
export class RevalidateController {
  constructor(
    @Inject(AuditService) private readonly audit: AuditService,
    @Inject(OutboxService) private readonly outbox: OutboxService,
  ) {}

  @Post()
  @Roles("owner")
  @HttpCode(202)
  async revalidate(
    @Body(new ZodPipe(revalidateRequestSchema)) body: z.output<typeof revalidateRequestSchema>,
    @Actor() ctx: AuditContext,
  ) {
    const tags = [...new Set(body.tags)].sort();
    await this.audit.withAudit(ctx, async (tx, audit) => {
      const auditId = await audit({
        action: "revalidate.manual",
        entity: "revalidate",
        entityId: "manual",
        after: { tags },
      });
      await this.outbox.enqueueTags(tx, tags, auditId);
    });
    return respond(revalidateResponseSchema, { revalidated: tags });
  }
}
