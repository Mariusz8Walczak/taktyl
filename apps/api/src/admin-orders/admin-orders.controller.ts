// B-200...B-205, B-208 (docs/16 par. 3.3): /v1/admin/orders. Odczyt: viewer (dane osobowe maskowane w odpowiedzi),
// zmiana statusu i notatki: editor. Mutacje wymagaja X-CSRF-Token (guard) i sa audytowane.
import { Body, Controller, Get, HttpCode, Inject, Param, Post, Query } from "@nestjs/common";
import {
  adminOrderDetailSchema,
  adminOrderListQuerySchema,
  adminOrderListSchema,
  orderNoteRequestSchema,
  orderNumberSchema,
  orderTransitionRequestSchema,
} from "@taktyl/contracts";
import type { z } from "zod";
import { Actor, Admin, type AdminPrincipal } from "../auth/admin-request.js";
import { Roles } from "../auth/decorators.js";
import type { AuditContext } from "../audit/audit.service.js";
import { respond, ZodPipe } from "../common/zod.pipe.js";
import { AdminOrdersService } from "./admin-orders.service.js";

@Controller("admin/orders")
export class AdminOrdersController {
  constructor(@Inject(AdminOrdersService) private readonly orders: AdminOrdersService) {}

  @Get()
  @Roles("viewer")
  async list(
    @Query(new ZodPipe(adminOrderListQuerySchema))
    query: z.output<typeof adminOrderListQuerySchema>,
  ) {
    return respond(adminOrderListSchema, await this.orders.list(query));
  }

  @Get(":number")
  @Roles("viewer")
  async get(
    @Param("number", new ZodPipe(orderNumberSchema)) number: string,
    @Admin() admin: AdminPrincipal,
  ) {
    return respond(adminOrderDetailSchema, await this.orders.detail(number, admin.role));
  }

  @Post(":number/transition")
  @Roles("editor")
  @HttpCode(200)
  async transition(
    @Param("number", new ZodPipe(orderNumberSchema)) number: string,
    @Body(new ZodPipe(orderTransitionRequestSchema))
    body: z.output<typeof orderTransitionRequestSchema>,
    @Actor() ctx: AuditContext,
  ) {
    return respond(adminOrderDetailSchema, await this.orders.transition(number, body, ctx));
  }

  @Post(":number/note")
  @Roles("editor")
  @HttpCode(201)
  async note(
    @Param("number", new ZodPipe(orderNumberSchema)) number: string,
    @Body(new ZodPipe(orderNoteRequestSchema)) body: z.output<typeof orderNoteRequestSchema>,
    @Actor() ctx: AuditContext,
  ) {
    return respond(adminOrderDetailSchema, await this.orders.addNote(number, body, ctx));
  }
}
