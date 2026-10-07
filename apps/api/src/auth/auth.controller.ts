// B-001, B-007, B-009 (docs/16 par. 3.1): logowanie, tryb demo, wylogowanie, biezaca sesja.
// Ciasteczko sesji ustawia kontroler (HttpOnly; SameSite=Strict; Secure wg konfiguracji), token CSRF wraca w ciele odpowiedzi.
import { Body, Controller, Get, HttpCode, Inject, Post, Req, Res } from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import { loginRequestSchema, sessionResponseSchema } from "@taktyl/contracts";
import type { Response } from "express";
import type { z } from "zod";
import type { AuditContext } from "../audit/audit.service.js";
import { LIMITS } from "../common/rate-limits.js";
import { respond, ZodPipe } from "../common/zod.pipe.js";
import { Actor, Admin, type AdminPrincipal, type AdminRequest } from "./admin-request.js";
import { AuthService, type ClientMeta, type LoginResult } from "./auth.service.js";
import { clearedSessionCookie, sessionCookie } from "./cookies.js";
import { AdminPublic, Roles } from "./decorators.js";
import { SessionService } from "./session.service.js";

const metaOf = (req: AdminRequest): ClientMeta => ({
  ip: req.ip,
  userAgent: req.header("user-agent"),
  requestId: req.id ?? "unknown",
});

@Controller("admin/auth")
export class AuthController {
  constructor(
    @Inject(AuthService) private readonly auth: AuthService,
    @Inject(SessionService) private readonly sessions: SessionService,
  ) {}

  private reply(res: Response, result: LoginResult) {
    res.setHeader(
      "Set-Cookie",
      sessionCookie(
        result.session.token,
        result.session.maxAgeSeconds,
        this.sessions.cookieOptions,
      ),
    );
    return respond(sessionResponseSchema, result.response);
  }

  @Post("login")
  @AdminPublic()
  @HttpCode(200)
  @Throttle({ default: LIMITS.login })
  async login(
    @Body(new ZodPipe(loginRequestSchema)) body: z.output<typeof loginRequestSchema>,
    @Req() req: AdminRequest,
    @Res({ passthrough: true }) res: Response,
  ) {
    return this.reply(res, await this.auth.login(body.email, body.password, metaOf(req)));
  }

  @Post("demo-viewer")
  @AdminPublic()
  @HttpCode(200)
  @Throttle({ default: LIMITS.login })
  async demoViewer(@Req() req: AdminRequest, @Res({ passthrough: true }) res: Response) {
    return this.reply(res, await this.auth.demoViewer(metaOf(req)));
  }

  /** Wylogowanie dostepne dla kazdej roli (takze viewer); mutacja wymaga X-CSRF-Token. */
  @Post("logout")
  @Roles("viewer")
  @HttpCode(204)
  async logout(
    @Admin() admin: AdminPrincipal,
    @Actor() ctx: AuditContext,
    @Res({ passthrough: true }) res: Response,
  ): Promise<void> {
    await this.auth.logout(admin, ctx);
    res.setHeader("Set-Cookie", clearedSessionCookie(this.sessions.cookieOptions));
  }

  /** `/me` (docs/16) i `/session` (alias z zadania TAKTYL-45). */
  @Get(["me", "session"])
  @Roles("viewer")
  me(@Admin() admin: AdminPrincipal) {
    return respond(sessionResponseSchema, this.auth.me(admin));
  }
}
