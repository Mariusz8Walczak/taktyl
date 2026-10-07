// B-002: kontekst zalogowanego uzytkownika backpanelu doklejany do zadania przez AdminAuthGuard.
import { createParamDecorator, type ExecutionContext } from "@nestjs/common";
import type { Role } from "@taktyl/contracts";
import type { AuditContext } from "../audit/audit.service.js";
import type { RequestWithId } from "../common/request-context.js";

export interface AdminPrincipal {
  userId: string;
  email: string;
  role: Role;
  /** skrot tokenu sesji (klucz w tabeli sessions) */
  sessionId: string;
  csrfToken: string;
  ipHash: string | null;
}

export type AdminRequest = RequestWithId & { admin?: AdminPrincipal };

/** `@Admin()` - zalogowany uzytkownik (tylko na trasach z @Roles). */
export const Admin = createParamDecorator((_: unknown, ctx: ExecutionContext): AdminPrincipal => {
  const principal = ctx.switchToHttp().getRequest<AdminRequest>().admin;
  if (!principal) throw new Error("Trasa bez sesji uzyla @Admin()");
  return principal;
});

/** `@Actor()` - kontekst dziennika zmian (kto, rola, requestId, hash IP). */
export const Actor = createParamDecorator((_: unknown, ctx: ExecutionContext): AuditContext => {
  const req = ctx.switchToHttp().getRequest<AdminRequest>();
  const p = req.admin;
  if (!p) throw new Error("Trasa bez sesji uzyla @Actor()");
  return { actorId: p.userId, actorRole: p.role, requestId: req.id ?? "unknown", ipHash: p.ipHash };
});
