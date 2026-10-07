// B-012 (docs/16 par. 3.5): GET /v1/admin/audit - dziennik zmian z filtrami (uzytkownik, encja, zakres dat).
// Viewer czyta dziennik, ale bez wartosci pol osobowych (docs/15 par. 3).
import { Controller, Get, Inject, Query } from "@nestjs/common";
import { auditListQuerySchema, auditListSchema } from "@taktyl/contracts";
import type { z } from "zod";
import { Admin, type AdminPrincipal } from "../auth/admin-request.js";
import { Roles } from "../auth/decorators.js";
import { respond, ZodPipe } from "../common/zod.pipe.js";
import { AuditService } from "./audit.service.js";

@Controller("admin/audit")
export class AuditController {
  constructor(@Inject(AuditService) private readonly audit: AuditService) {}

  @Get()
  @Roles("viewer")
  async list(
    @Query(new ZodPipe(auditListQuerySchema)) query: z.output<typeof auditListQuerySchema>,
    @Admin() admin: AdminPrincipal,
  ) {
    return respond(auditListSchema, await this.audit.list(query, admin.role));
  }
}
