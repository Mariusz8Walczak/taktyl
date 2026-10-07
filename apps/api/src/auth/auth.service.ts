// B-001, B-007, B-009, B-004 (ADR-0006, docs/18 D): logowanie e-mail + haslo, tryb demo (viewer bez hasla), wylogowanie.
// Jednolity komunikat bledu logowania (brak enumeracji kont, rowniez czasowej: nieistniejace konto tez kosztuje jedno
// sprawdzenie argon2). Zdarzenia bezpieczenstwa trafiaja do audit_log w tej samej transakcji co zmiana sesji.
import { Inject, Injectable } from "@nestjs/common";
import { Prisma } from "../prisma/client.js";
import type { Role, SessionResponse } from "@taktyl/contracts";
import { type AuditContext, AuditService, systemAudit } from "../audit/audit.service.js";
import { AppException, notFound } from "../common/app-exception.js";
import { CLOCK, type Clock } from "../common/clock.js";
import { APP_CONFIG } from "../config/config.module.js";
import type { AppConfig } from "../config/env.js";
import { PrismaService } from "../prisma/prisma.service.js";
import type { AdminPrincipal } from "./admin-request.js";
import { LoginThrottleService } from "./login-throttle.service.js";
import { PasswordService } from "./password.service.js";
import { type CreatedSession, SessionService } from "./session.service.js";

/** Konto systemowe trybu demo (B-007): rola viewer, brak hasla, nie da sie na nie zalogowac haslem. */
export const DEMO_VIEWER_EMAIL = "viewer@taktyl.example";

export const INVALID_CREDENTIALS_MESSAGE = "Nieprawidlowy e-mail lub haslo.";

export interface ClientMeta {
  ip: string | undefined;
  userAgent: string | undefined;
  requestId: string;
}

export interface LoginResult {
  session: CreatedSession;
  response: SessionResponse;
}

@Injectable()
export class AuthService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(SessionService) private readonly sessions: SessionService,
    @Inject(PasswordService) private readonly passwords: PasswordService,
    @Inject(LoginThrottleService) private readonly throttle: LoginThrottleService,
    @Inject(AuditService) private readonly audit: AuditService,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  /** B-001, B-004: logowanie e-mailem i haslem. */
  async login(email: string, password: string, meta: ClientMeta): Promise<LoginResult> {
    const normalized = email.trim().toLowerCase();
    const emailHash = this.sessions.emailHash(normalized);
    const ipHash = this.sessions.ipHash(meta.ip);

    const retryAfter = await this.throttle.retryAfterSeconds(emailHash, ipHash);
    if (retryAfter > 0) throw this.locked(retryAfter);

    const user = await this.prisma.adminUser.findUnique({ where: { email: normalized } });
    const valid =
      user && user.active && user.passwordHash
        ? await this.passwords.verify(user.passwordHash, password)
        : await this.passwords.verifyDummy(password);
    if (!user || !valid) {
      await this.throttle.recordFailure(emailHash, ipHash);
      const lockedNow = (await this.throttle.retryAfterSeconds(emailHash, ipHash)) > 0;
      await this.audit.withAudit(this.securityContext(meta, ipHash), (_tx, audit) =>
        audit({
          action: lockedNow ? "auth.login_locked" : "auth.login_failed",
          entity: "login",
          // klucz zhashowany: dziennik nie przechowuje adresow z nieudanych prob
          entityId: emailHash.slice(0, 16),
          after: { reason: lockedNow ? "locked" : "bad_credentials" },
        }),
      );
      throw this.invalid();
    }

    return this.openSession(
      user.id,
      user.email,
      user.role as Role,
      "auth.login",
      meta,
      ipHash,
      emailHash,
    );
  }

  /** B-007: sesja roli viewer bez hasla; tylko przy DEMO_MODE=true (inaczej 404). */
  async demoViewer(meta: ClientMeta): Promise<LoginResult> {
    if (!this.config.DEMO_MODE) throw notFound();
    const user = await this.ensureDemoViewer();
    if (!user.active) throw notFound();
    return this.openSession(
      user.id,
      user.email,
      "viewer",
      "auth.demo_login",
      meta,
      this.sessions.ipHash(meta.ip),
      null,
      true,
    );
  }

  /** Tworzy (idempotentnie) konto systemowe viewer@taktyl.example bez hasla. */
  async ensureDemoViewer() {
    const find = () => this.prisma.adminUser.findUnique({ where: { email: DEMO_VIEWER_EMAIL } });
    const existing = await find();
    if (existing) return existing;
    try {
      return await this.audit.withAudit(systemAudit("demo-viewer"), async (tx, audit) => {
        const created = await tx.adminUser.create({
          data: {
            email: DEMO_VIEWER_EMAIL,
            passwordHash: null,
            role: "viewer",
            active: true,
            createdAt: this.clock(),
          },
        });
        await audit({
          action: "user.create",
          entity: "user",
          entityId: created.id,
          after: { email: created.email, role: created.role, active: true, system: true },
        });
        return created;
      });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
        return (await find()) as NonNullable<Awaited<ReturnType<typeof find>>>;
      }
      throw e;
    }
  }

  /** B-009: unieważnia sesje po stronie serwera; wpis audytu w tej samej transakcji. */
  async logout(principal: AdminPrincipal, ctx: AuditContext): Promise<void> {
    await this.audit.withAudit(ctx, async (tx, audit) => {
      await this.sessions.revoke(tx, principal.sessionId);
      await audit({
        action: "auth.logout",
        entity: "session",
        entityId: principal.sessionId.slice(0, 16),
        after: { user_id: principal.userId },
      });
    });
  }

  /** B-001: odpowiedz sesji (GET /auth/me). */
  me(principal: AdminPrincipal): SessionResponse {
    return {
      user: { id: principal.userId, email: principal.email, role: principal.role },
      csrf_token: principal.csrfToken,
      ...(principal.email === DEMO_VIEWER_EMAIL ? { demo: true } : {}),
    };
  }

  private async openSession(
    userId: string,
    email: string,
    role: Role,
    action: "auth.login" | "auth.demo_login",
    meta: ClientMeta,
    ipHash: string | null,
    emailHash: string | null,
    demo = false,
  ): Promise<LoginResult> {
    const ctx: AuditContext = {
      actorId: userId,
      actorRole: role,
      requestId: meta.requestId,
      ipHash,
    };
    const session = await this.audit.withAudit(ctx, async (tx, audit) => {
      const created = await this.sessions.create(tx, userId, { ipHash, userAgent: meta.userAgent });
      await tx.adminUser.update({ where: { id: userId }, data: { lastLoginAt: this.clock() } });
      await audit({ action, entity: "user", entityId: userId, after: { role } });
      return created;
    });
    if (emailHash) await this.throttle.clear(emailHash);
    // Porzadki poza transakcja logowania: wygasle sesje nie rosna w nieskonczonosc (docs/17 par. 9).
    await this.sessions.purgeExpired();
    return {
      session,
      response: {
        user: { id: userId, email, role },
        csrf_token: session.csrfToken,
        ...(demo ? { demo: true } : {}),
      },
    };
  }

  private securityContext(meta: ClientMeta, ipHash: string | null): AuditContext {
    return { ...systemAudit(meta.requestId), ipHash };
  }

  private invalid(): AppException {
    return new AppException(401, "unauthorized", INVALID_CREDENTIALS_MESSAGE, [
      { path: "credentials", code: "invalid_credentials", message: INVALID_CREDENTIALS_MESSAGE },
    ]);
  }

  private locked(retryAfterSeconds: number): AppException {
    const minutes = Math.max(1, Math.ceil(retryAfterSeconds / 60));
    return new AppException(
      429,
      "rate_limited",
      `Za duzo prob logowania. Sprobuj za ${minutes} min.`,
      [
        {
          path: "credentials",
          code: "login_locked",
          message: `Za duzo prob. Sprobuj za ${minutes} min.`,
        },
      ],
      { "Retry-After": String(retryAfterSeconds) },
    );
  }
}
