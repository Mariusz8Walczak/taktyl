// B-005 (ADR-0006 pkt 4, docs/18 D): konto owner z ADMIN_BOOTSTRAP_EMAIL / ADMIN_BOOTSTRAP_PASSWORD przy starcie,
// TYLKO gdy w bazie nie ma zadnego konta owner. Bez zmiennych: ostrzezenie i brak konta. Haslo nigdy nie trafia do logow.
// W DEMO_MODE tworzone jest tez konto systemowe viewer@taktyl.example (bez hasla).
import { Inject, Injectable, Logger, type OnApplicationBootstrap } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { AuditService, systemAudit } from "../audit/audit.service.js";
import { CLOCK, type Clock } from "../common/clock.js";
import { APP_CONFIG } from "../config/config.module.js";
import type { AppConfig } from "../config/env.js";
import { PrismaService } from "../prisma/prisma.service.js";
import { AuthService } from "./auth.service.js";
import { PasswordService, passwordProblems } from "./password.service.js";

@Injectable()
export class BootstrapService implements OnApplicationBootstrap {
  private readonly log = new Logger(BootstrapService.name);

  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(PasswordService) private readonly passwords: PasswordService,
    @Inject(AuditService) private readonly audit: AuditService,
    @Inject(AuthService) private readonly auth: AuthService,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    await this.ensureOwner();
    if (this.config.DEMO_MODE) await this.auth.ensureDemoViewer();
  }

  /** B-005. Zwraca true, gdy konto zostalo utworzone. */
  async ensureOwner(): Promise<boolean> {
    if ((await this.prisma.adminUser.count({ where: { role: "owner" } })) > 0) return false;
    const email = this.config.ADMIN_BOOTSTRAP_EMAIL?.toLowerCase();
    const password = this.config.ADMIN_BOOTSTRAP_PASSWORD;
    if (!email || !password) {
      this.log.warn(
        "Brak konta owner i brak ADMIN_BOOTSTRAP_EMAIL / ADMIN_BOOTSTRAP_PASSWORD: konto nie zostalo utworzone. Backpanel jest niedostepny do czasu ustawienia zmiennych.",
      );
      return false;
    }
    const problems = passwordProblems(password, email);
    if (problems.length > 0) {
      this.log.warn(
        `ADMIN_BOOTSTRAP_PASSWORD odrzucone, konto nie zostalo utworzone: ${problems.join(" ")}`,
      );
      return false;
    }
    const passwordHash = await this.passwords.hash(password);
    try {
      await this.audit.withAudit(systemAudit("bootstrap"), async (tx, audit) => {
        const created = await tx.adminUser.create({
          data: { email, passwordHash, role: "owner", active: true, createdAt: this.clock() },
        });
        await audit({
          action: "user.bootstrap",
          entity: "user",
          entityId: created.id,
          after: { email, role: "owner", active: true },
        });
      });
    } catch (e) {
      // Drugi egzemplarz API utworzyl konto rownolegle: nic do zrobienia.
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") return false;
      throw e;
    }
    this.log.log("Utworzono konto owner z ADMIN_BOOTSTRAP_EMAIL.");
    return true;
  }
}
