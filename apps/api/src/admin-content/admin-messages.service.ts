// B-308, B-309 (docs/15 par. 9, docs/16 par. 3.4, docs/17 par. 3.5 i 9): zgloszenia z formularzy (kontakt, newsletter) w panelu.
// Lista do odczytu (viewer widzi dane zamaskowane), oznaczenie "obsluzone" (editor), usuwanie (owner, RODO w demo).
// Dane osobowe nie trafiaja do audit_log: wpis niesie tylko rodzaj, id i date.
import { Inject, Injectable } from "@nestjs/common";
import type { adminMessageListQuerySchema, Role } from "@taktyl/contracts";
import type { z } from "zod";
import { type AuditContext, AuditService } from "../audit/audit.service.js";
import { notFound, validationFailed } from "../common/app-exception.js";
import { maskEmail } from "../common/pii-mask.js";
import { PrismaService } from "../prisma/prisma.service.js";

type ListQuery = z.output<typeof adminMessageListQuerySchema>;

const MASKED_BODY = "[ukryte]";

@Injectable()
export class AdminMessagesService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(AuditService) private readonly audit: AuditService,
  ) {}

  /** B-308: kontakt i newsletter razem, najnowsze pierwsze; viewer: e-mail zamaskowany, tresc ukryta. */
  async list(query: ListQuery, role: Role) {
    const [contacts, signups] = await Promise.all([
      query.kind === "newsletter" ? [] : this.prisma.contactMessage.findMany(),
      query.kind === "contact" ? [] : this.prisma.newsletterSignup.findMany(),
    ]);
    const mask = role === "viewer";
    const all = [
      ...contacts.map((c) => ({
        id: c.id,
        kind: "contact" as const,
        email: mask ? maskEmail(c.email) : c.email,
        subject: c.subject,
        body: mask ? MASKED_BODY : c.body,
        created_at: c.createdAt,
        handled: c.handled,
      })),
      ...signups.map((s) => ({
        id: s.id,
        kind: "newsletter" as const,
        email: mask ? maskEmail(s.email) : s.email,
        subject: null,
        body: null,
        created_at: s.createdAt,
        handled: null,
      })),
    ].sort((a, b) => b.created_at.getTime() - a.created_at.getTime() || a.id.localeCompare(b.id));
    const start = (query.page - 1) * query.per_page;
    return {
      items: all.slice(start, start + query.per_page).map((m) => ({
        ...m,
        created_at: m.created_at.toISOString(),
      })),
      page: query.page,
      per_page: query.per_page,
      total: all.length,
    };
  }

  /** B-308: status "obsluzone" tylko dla wiadomosci kontaktowych (zapis do newslettera nie ma statusu). */
  async setHandled(id: string, handled: boolean, ctx: AuditContext): Promise<void> {
    await this.audit.withAudit(ctx, async (tx, audit) => {
      const msg = await tx.contactMessage.findUnique({ where: { id } });
      if (!msg) {
        if (await tx.newsletterSignup.findUnique({ where: { id }, select: { id: true } })) {
          throw validationFailed([
            { path: "id", code: "not_applicable", message: "Zapis do newslettera nie ma statusu." },
          ]);
        }
        throw notFound("Nie znaleziono zgloszenia.");
      }
      if (msg.handled === handled) return;
      await tx.contactMessage.update({ where: { id }, data: { handled } });
      await audit({
        action: "message.update",
        entity: "message",
        entityId: id,
        before: { kind: "contact", handled: msg.handled },
        after: { kind: "contact", handled },
      });
    });
  }

  /** B-309: usuniecie zgloszenia (RODO w demo); w dzienniku tylko rodzaj, id i data utworzenia. */
  async remove(id: string, ctx: AuditContext): Promise<void> {
    await this.audit.withAudit(ctx, async (tx, audit) => {
      const contact = await tx.contactMessage.findUnique({ where: { id } });
      const signup = contact ? null : await tx.newsletterSignup.findUnique({ where: { id } });
      if (!contact && !signup) throw notFound("Nie znaleziono zgloszenia.");
      if (contact) await tx.contactMessage.delete({ where: { id } });
      else await tx.newsletterSignup.delete({ where: { id } });
      await audit({
        action: "message.delete",
        entity: "message",
        entityId: id,
        before: {
          kind: contact ? "contact" : "newsletter",
          created_at: (contact ?? signup)!.createdAt.toISOString(),
        },
      });
    });
  }
}
