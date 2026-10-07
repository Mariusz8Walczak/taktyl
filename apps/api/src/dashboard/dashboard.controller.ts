// B-600..B-607 (docs/16 par. 3.5): GET /v1/admin/dashboard - odczyt dla kazdej roli.
import { Controller, Get, Inject, Header } from "@nestjs/common";
import { dashboardSchema } from "@taktyl/contracts";
import { Admin, type AdminPrincipal } from "../auth/admin-request.js";
import { Roles } from "../auth/decorators.js";
import { respond } from "../common/zod.pipe.js";
import { DashboardService } from "./dashboard.service.js";

@Controller("admin/dashboard")
export class DashboardController {
  constructor(@Inject(DashboardService) private readonly dashboard: DashboardService) {}

  @Get()
  @Roles("viewer")
  @Header("Cache-Control", "no-store")
  async get(@Admin() admin: AdminPrincipal) {
    return respond(dashboardSchema, await this.dashboard.get(admin.role));
  }
}
