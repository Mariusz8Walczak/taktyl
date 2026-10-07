// B-013 (docs/16 par. 3.1): /v1/admin/users - tylko owner. Mutacje wymagaja X-CSRF-Token (guard), kazda jest audytowana.
import { Body, Controller, Get, HttpCode, Inject, Param, Patch, Post } from "@nestjs/common";
import {
  adminUserSchema,
  createUserRequestSchema,
  updateUserRequestSchema,
  updateUserResponseSchema,
  usersResponseSchema,
} from "@taktyl/contracts";
import type { z } from "zod";
import { Actor } from "../auth/admin-request.js";
import { Roles } from "../auth/decorators.js";
import type { AuditContext } from "../audit/audit.service.js";
import { respond, ZodPipe } from "../common/zod.pipe.js";
import { UsersService } from "./users.service.js";

@Controller("admin/users")
export class UsersController {
  constructor(@Inject(UsersService) private readonly users: UsersService) {}

  @Get()
  @Roles("owner")
  async list() {
    return respond(usersResponseSchema, await this.users.list());
  }

  @Post()
  @Roles("owner")
  @HttpCode(201)
  async create(
    @Body(new ZodPipe(createUserRequestSchema)) body: z.output<typeof createUserRequestSchema>,
    @Actor() ctx: AuditContext,
  ) {
    return respond(adminUserSchema, await this.users.create(body, ctx));
  }

  @Patch(":id")
  @Roles("owner")
  async update(
    @Param("id") id: string,
    @Body(new ZodPipe(updateUserRequestSchema)) body: z.output<typeof updateUserRequestSchema>,
    @Actor() ctx: AuditContext,
  ) {
    return respond(updateUserResponseSchema, await this.users.update(id, body, ctx));
  }
}
