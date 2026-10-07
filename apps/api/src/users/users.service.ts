// B-013 (docs/15 par. 6, docs/16 par. 3.1): konta backpanelu - lista, utworzenie (editor/viewer/owner), zmiana roli,
// dezaktywacja, reset hasla. Tylko owner. Ostatniego aktywnego owner nie da sie odebrac ani wylaczyc (409).
// Kazda zmiana: wpis audit_log w tej samej transakcji (bez hasel i hashy), uniewaznienie sesji zmienianego konta.
import { Inject, Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import type { Role } from "@taktyl/contracts";
import { type AuditContext, AuditService } from "../audit/audit.service.js";
import { DEMO_VIEWER_EMAIL } from "../auth/auth.service.js";
import { randomToken } from "../auth/crypto.js";
import { PasswordService, passwordProblems } from "../auth/password.service.js";
import { SessionService } from "../auth/session.service.js";
import { AppException, notFound, validationFailed } from "../common/app-exception.js";
import { CLOCK, type Clock } from "../common/clock.js";
import { PrismaService } from "../prisma/prisma.service.js";

export interface UserView {
  id: string;
  email: string;
  role: Role;
  active: boolean;
  last_login_at: string | null;
  created_at: string;
}

const view = (u: {
  id: string;
  email: string;
  role: string;
  active: boolean;
  lastLoginAt: Date | null;
  createdAt: Date;
}): UserView => ({
  id: u.id,
  email: u.email,
  role: u.role as Role,
  active: u.active,
  last_login_at: u.lastLoginAt ? u.lastLoginAt.toISOString() : null,
  created_at: u.createdAt.toISOString(),
});

/** Stan konta do dziennika: bez hasla i hasha. */
const snapshot = (u: { email: string; role: string; active: boolean }) => ({
  email: u.email,
  role: u.role,
  active: u.active,
});

@Injectable()
export class UsersService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(AuditService) private readonly audit: AuditService,
    @Inject(PasswordService) private readonly passwords: PasswordService,
    @Inject(SessionService) private readonly sessions: SessionService,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  async list(): Promise<{ items: UserView[] }> {
    const users = await this.prisma.adminUser.findMany({
      orderBy: [{ createdAt: "asc" }, { email: "asc" }],
    });
    return { items: users.map(view) };
  }

  async create(
    input: { email: string; role: Role; initial_password: string },
    ctx: AuditContext,
  ): Promise<UserView> {
    const email = input.email.trim().toLowerCase();
    if (email === DEMO_VIEWER_EMAIL) {
      throw new AppException(409, "conflict", "Ten adres jest zarezerwowany dla konta demo.");
    }
    const problems = passwordProblems(input.initial_password, email);
    if (problems.length > 0) {
      throw validationFailed(
        problems.map((message) => ({ path: "initial_password", code: "weak_password", message })),
      );
    }
    const passwordHash = await this.passwords.hash(input.initial_password);
    try {
      const created = await this.audit.withAudit(ctx, async (tx, audit) => {
        const user = await tx.adminUser.create({
          data: { email, passwordHash, role: input.role, active: true, createdAt: this.clock() },
        });
        await audit({
          action: "user.create",
          entity: "user",
          entityId: user.id,
          after: snapshot(user),
        });
        return user;
      });
      return view(created);
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
        throw new AppException(409, "conflict", "Konto z takim adresem e-mail juz istnieje.");
      }
      throw e;
    }
  }

  async update(
    id: string,
    patch: {
      role?: Role | undefined;
      active?: boolean | undefined;
      reset_password?: true | undefined;
    },
    ctx: AuditContext,
  ): Promise<UserView & { temporary_password?: string }> {
    const temporaryPassword = patch.reset_password ? randomToken(16) : undefined;
    const temporaryHash = temporaryPassword
      ? await this.passwords.hash(temporaryPassword)
      : undefined;

    const updated = await this.audit.withAudit(ctx, async (tx, audit) => {
      // Blokada wierszy ownerow: rownolegle zmiany nie moga razem zostawic systemu bez ownera.
      await tx.$queryRaw`SELECT id FROM admin_users WHERE role = 'owner' ORDER BY id FOR UPDATE`;
      const before = await tx.adminUser.findUnique({ where: { id } });
      if (!before) throw notFound("Nie znaleziono konta.");
      if (before.email === DEMO_VIEWER_EMAIL && (patch.role !== undefined || temporaryHash)) {
        throw new AppException(
          409,
          "conflict",
          "Konta demo nie mozna zmieniac (rola viewer, brak hasla).",
        );
      }

      const nextRole = patch.role ?? (before.role as Role);
      const nextActive = patch.active ?? before.active;
      const losesOwner =
        before.role === "owner" && before.active && (nextRole !== "owner" || !nextActive);
      if (losesOwner) {
        const others = await tx.adminUser.count({
          where: { role: "owner", active: true, id: { not: id } },
        });
        if (others === 0) {
          throw new AppException(
            409,
            "conflict",
            "Nie mozna odebrac roli ani wylaczyc ostatniego konta owner.",
          );
        }
      }

      const user = await tx.adminUser.update({
        where: { id },
        data: {
          role: nextRole,
          active: nextActive,
          ...(temporaryHash ? { passwordHash: temporaryHash } : {}),
        },
      });
      // Zmiana roli, wylaczenie i reset hasla konczą sesje tego konta (nowe uprawnienia = nowe logowanie).
      const changed =
        nextRole !== before.role || nextActive !== before.active || Boolean(temporaryHash);
      if (changed) await this.sessions.revokeAllForUser(tx, id);
      await audit({
        action: "user.update",
        entity: "user",
        entityId: id,
        before: snapshot(before),
        after: { ...snapshot(user), ...(temporaryHash ? { credentials_reset: true } : {}) },
      });
      return user;
    });
    return {
      ...view(updated),
      ...(temporaryPassword ? { temporary_password: temporaryPassword } : {}),
    };
  }
}
