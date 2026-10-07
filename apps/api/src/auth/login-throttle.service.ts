// B-004 (docs/15, docs/14 par. 7 A07): limit nieudanych prob logowania z blokada czasowa. Licznik w bazie (login_attempts),
// klucze to HMAC e-maila i IP. Konto: LOGIN_MAX_ATTEMPTS (5) w oknie LOGIN_WINDOW_MINUTES (15); IP: szerszy limit (wspolne NAT).
// Zliczamy takze proby na nieistniejace konta, wiec blokada nie zdradza, ktore konta istnieja.
import { Inject, Injectable } from "@nestjs/common";
import { CLOCK, type Clock } from "../common/clock.js";
import { APP_CONFIG } from "../config/config.module.js";
import type { AppConfig } from "../config/env.js";
import { PrismaService } from "../prisma/prisma.service.js";

@Injectable()
export class LoginThrottleService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  private get windowMs(): number {
    return this.config.LOGIN_WINDOW_MINUTES * 60_000;
  }

  /** Sekundy do konca blokady (>0) albo 0, gdy logowanie jest dozwolone. */
  async retryAfterSeconds(emailHash: string, ipHash: string | null): Promise<number> {
    const now = this.clock();
    const since = new Date(now.getTime() - this.windowMs);
    const byEmail = await this.prisma.loginAttempt.findMany({
      where: { emailHash, at: { gt: since } },
      orderBy: { at: "asc" },
      select: { at: true },
    });
    const byIp = ipHash
      ? await this.prisma.loginAttempt.findMany({
          where: { ipHash, at: { gt: since } },
          orderBy: { at: "asc" },
          select: { at: true },
        })
      : [];
    let lockedUntil = 0;
    const consider = (rows: { at: Date }[], max: number) => {
      if (rows.length < max) return;
      // Blokada trwa, dopoki najstarsza z ostatnich `max` prob nie wypadnie z okna.
      const pivot = rows[rows.length - max] as { at: Date };
      lockedUntil = Math.max(lockedUntil, pivot.at.getTime() + this.windowMs);
    };
    consider(byEmail, this.config.LOGIN_MAX_ATTEMPTS);
    consider(byIp, this.config.LOGIN_IP_MAX_ATTEMPTS);
    return lockedUntil > now.getTime() ? Math.ceil((lockedUntil - now.getTime()) / 1000) : 0;
  }

  async recordFailure(emailHash: string, ipHash: string | null): Promise<void> {
    const now = this.clock();
    await this.prisma.loginAttempt.create({
      data: { emailHash, ipHash: ipHash ?? "unknown", at: now },
    });
    // Porzadki: wiersze starsze niz 4 okna nie maja znaczenia.
    await this.prisma.loginAttempt.deleteMany({
      where: { at: { lt: new Date(now.getTime() - 4 * this.windowMs) } },
    });
  }

  /** Udane logowanie zeruje licznik konta (nie licznik IP). */
  async clear(emailHash: string): Promise<void> {
    await this.prisma.loginAttempt.deleteMany({ where: { emailHash } });
  }
}
