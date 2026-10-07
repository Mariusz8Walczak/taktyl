// B-002, B-003, B-006 (docs/16 par. 1.1, par. 4; docs/14 par. 7 A01): guard calego /v1/admin/*.
// Domyslnie zamkniete: trasa admina bez @Roles/@AdminPublic jest odrzucana. Kolejnosc: sesja (401) -> CSRF dla mutacji (403
// csrf_invalid) -> rola (403 forbidden). Odmowy loguje ProblemFilter (warn, bez danych osobowych).
import { type CanActivate, type ExecutionContext, Inject, Injectable } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import type { Role } from "@taktyl/contracts";
import type { Response } from "express";
import { AppException } from "../common/app-exception.js";
import { type AdminRequest } from "./admin-request.js";
import { clearedSessionCookie, readCookie, SESSION_COOKIE } from "./cookies.js";
import { safeEqual } from "./crypto.js";
import { ADMIN_PUBLIC_KEY, ROLE_RANK, ROLES_KEY } from "./decorators.js";
import { SessionService } from "./session.service.js";

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

export const isAdminPath = (path: string): boolean =>
  path === "/v1/admin" || path.startsWith("/v1/admin/");

@Injectable()
export class AdminAuthGuard implements CanActivate {
  constructor(
    @Inject(Reflector) private readonly reflector: Reflector,
    @Inject(SessionService) private readonly sessions: SessionService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    if (context.getType() !== "http") return true;
    const http = context.switchToHttp();
    const req = http.getRequest<AdminRequest>();
    if (!isAdminPath(req.path)) return true;

    const targets = [context.getHandler(), context.getClass()];
    if (this.reflector.getAllAndOverride<boolean | undefined>(ADMIN_PUBLIC_KEY, targets))
      return true;
    const minRole = this.reflector.getAllAndOverride<Role | undefined>(ROLES_KEY, targets);
    if (!minRole) throw new AppException(403, "forbidden", "Trasa nie ma zadeklarowanej roli.");

    const resolved = await this.sessions.resolve(
      readCookie(req.headers.cookie, SESSION_COOKIE),
      req.ip,
    );
    if ("failure" in resolved) {
      const expired = resolved.failure !== "none";
      if (expired)
        http
          .getResponse<Response>()
          .setHeader("Set-Cookie", clearedSessionCookie(this.sessions.cookieOptions));
      const message = expired ? "Sesja wygasla. Zaloguj sie ponownie." : "Zaloguj sie.";
      throw new AppException(401, "unauthorized", message, [
        { path: "session", code: expired ? "session_expired" : "no_session", message },
      ]);
    }
    const principal = resolved.principal;

    if (!SAFE_METHODS.has(req.method)) {
      const provided = req.header("x-csrf-token");
      if (!provided || !safeEqual(principal.csrfToken, provided)) {
        throw new AppException(403, "csrf_invalid", "Odswiez strone i sprobuj ponownie.");
      }
    }
    if (ROLE_RANK[principal.role] < ROLE_RANK[minRole]) {
      throw new AppException(403, "forbidden", "Twoja rola nie pozwala na te operacje.");
    }
    req.admin = principal;
    return true;
  }
}
