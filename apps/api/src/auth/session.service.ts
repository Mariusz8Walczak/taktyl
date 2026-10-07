// B-002, B-003, B-009 (docs/17 par. 3.6, docs/18 D): sesje po stronie serwera. Token: 32 losowe bajty; w bazie wylacznie
// jego SHA-256 (id sesji). Wygasniecie: 12 h od logowania (expires_at) i 30 min bezczynnosci (last_seen_at).
// CSRF: token powiazany z sesja (HMAC SESSION_SECRET nad id i csrf_secret) wysylany w naglowku X-CSRF-Token.
import { Inject, Injectable } from "@nestjs/common";
import type { Prisma, Session } from "@prisma/client";
import type { Role } from "@taktyl/contracts";
import { CLOCK, type Clock } from "../common/clock.js";
import { APP_CONFIG } from "../config/config.module.js";
import type { AppConfig } from "../config/env.js";
import { PrismaService } from "../prisma/prisma.service.js";
import type { AdminPrincipal } from "./admin-request.js";
import { hmacBase64Url, keyedHash, randomToken, safeEqual, sha256Hex } from "./crypto.js";

/** Aktualizujemy last_seen_at najwyzej raz na 30 s (mniej zapisow, bezczynnosc liczona z dokladnoscia do pol minuty). */
const TOUCH_INTERVAL_MS = 30_000;

export type SessionFailure = "none" | "expired" | "inactive";

export interface CreatedSession {
  token: string;
  csrfToken: string;
  maxAgeSeconds: number;
}

@Injectable()
export class SessionService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  get cookieOptions() {
    return {
      secure: this.config.SESSION_COOKIE_SECURE ?? this.config.NODE_ENV === "production",
      domain: this.config.SESSION_COOKIE_DOMAIN,
    };
  }

  ipHash(ip: string | undefined): string | null {
    return ip ? keyedHash(this.config.SESSION_SECRET, "ip", ip) : null;
  }

  emailHash(email: string): string {
    return keyedHash(this.config.SESSION_SECRET, "email", email);
  }

  csrfFor(session: Pick<Session, "id" | "csrfSecret">): string {
    return hmacBase64Url(this.config.SESSION_SECRET, `csrf:${session.id}:${session.csrfSecret}`);
  }

  isCsrfValid(session: Pick<Session, "id" | "csrfSecret">, provided: string | undefined): boolean {
    return provided !== undefined && safeEqual(this.csrfFor(session), provided);
  }

  /** Tworzy sesje w podanej transakcji (razem z wpisem audytu logowania). */
  async create(
    tx: Prisma.TransactionClient,
    userId: string,
    meta: { ipHash: string | null; userAgent: string | undefined },
  ): Promise<CreatedSession> {
    const now = this.clock();
    const token = randomToken();
    const id = sha256Hex(token);
    const csrfSecret = randomToken();
    const ttlMs = this.config.SESSION_TTL_HOURS * 3_600_000;
    await tx.session.create({
      data: {
        id,
        userId,
        csrfSecret,
        createdAt: now,
        lastSeenAt: now,
        expiresAt: new Date(now.getTime() + ttlMs),
        ipHash: meta.ipHash,
        userAgent: meta.userAgent?.slice(0, 200) ?? null,
      },
    });
    return { token, csrfToken: this.csrfFor({ id, csrfSecret }), maxAgeSeconds: ttlMs / 1000 };
  }

  /** Sprawdza token z ciasteczka. Zwraca zalogowanego albo powod odmowy; sesje po terminie usuwa. */
  async resolve(
    token: string | undefined,
    ip: string | undefined,
  ): Promise<{ principal: AdminPrincipal } | { failure: SessionFailure }> {
    if (!token || token.length < 20 || token.length > 100) return { failure: "none" };
    const id = sha256Hex(token);
    const session = await this.prisma.session.findUnique({
      where: { id },
      include: { user: true },
    });
    if (!session) return { failure: "none" };
    const now = this.clock();
    const idleMs = this.config.SESSION_IDLE_MINUTES * 60_000;
    if (session.expiresAt <= now || now.getTime() - session.lastSeenAt.getTime() >= idleMs) {
      await this.prisma.session.deleteMany({ where: { id } });
      return { failure: "expired" };
    }
    if (!session.user.active) {
      await this.prisma.session.deleteMany({ where: { id } });
      return { failure: "inactive" };
    }
    if (now.getTime() - session.lastSeenAt.getTime() > TOUCH_INTERVAL_MS) {
      await this.prisma.session.updateMany({ where: { id }, data: { lastSeenAt: now } });
    }
    return {
      principal: {
        userId: session.user.id,
        email: session.user.email,
        role: session.user.role as Role,
        sessionId: id,
        csrfToken: this.csrfFor(session),
        ipHash: this.ipHash(ip),
      },
    };
  }

  /** B-009: uniewaznienie sesji po stronie serwera (w transakcji z audytem wylogowania). */
  revoke(tx: Prisma.TransactionClient, sessionId: string) {
    return tx.session.deleteMany({ where: { id: sessionId } });
  }

  /** Wylogowanie wszystkich sesji uzytkownika (dezaktywacja, zmiana roli, reset hasla). */
  revokeAllForUser(tx: Prisma.TransactionClient, userId: string) {
    return tx.session.deleteMany({ where: { userId } });
  }

  /** Porzadki: sesje po terminie bezwzglednym lub bezczynnosci. */
  async purgeExpired(): Promise<number> {
    const now = this.clock();
    const idleCutoff = new Date(now.getTime() - this.config.SESSION_IDLE_MINUTES * 60_000);
    const res = await this.prisma.session.deleteMany({
      where: { OR: [{ expiresAt: { lte: now } }, { lastSeenAt: { lte: idleCutoff } }] },
    });
    return res.count;
  }
}
