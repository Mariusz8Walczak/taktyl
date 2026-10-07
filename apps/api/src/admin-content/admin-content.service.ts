// B-304, B-305, B-306, B-307 (docs/15 par. 9, docs/16 par. 3.4, docs/17 par. 3.5, docs/14 par. 6): strony informacyjne i prawne,
// artykuly poradnika i FAQ w backpanelu. Tresc jest sanityzowana allowlista (Markdown ograniczony), walidowana pod katem
// tresci prawnych i marek, a kazda zmiana ma audyt, ostatnie 20 wersji i znaczniki content:{slug}, content:guide, content:faq.
import { Inject, Injectable } from "@nestjs/common";
import type { Prisma } from "../prisma/client.js";
import type {
  contentCreateSchema,
  contentPatchSchema,
  faqPutSchema,
  ProblemFieldError,
} from "@taktyl/contracts";
import type { z } from "zod";
import { type AuditContext, AuditService } from "../audit/audit.service.js";
import { AppException, notFound, validationFailed } from "../common/app-exception.js";
import { BrandGuard } from "../common/brand-guard.js";
import { CLOCK, type Clock } from "../common/clock.js";
import { preconditionFailed } from "../common/if-match.js";
import { OutboxService } from "../outbox/outbox.service.js";
import { PrismaService } from "../prisma/prisma.service.js";
import { guideWarnings, legalContentErrors, type RuleWarning } from "./content-rules.js";
import { sanitizeMarkdown, stripTags } from "./content-sanitizer.js";

type Create = z.output<typeof contentCreateSchema>;
type Patch = z.output<typeof contentPatchSchema>;
type FaqPut = z.output<typeof faqPutSchema>;

export interface Warning {
  code: RuleWarning["code"] | "content_sanitized";
  message: string;
  details?: string[];
}

const REVISIONS_KEPT = 20;

type Row = Prisma.ContentPageGetPayload<object>;

const toAdmin = (r: Row, warnings: Warning[] = []) => ({
  id: r.id,
  slug: r.slug,
  type: r.type,
  title: r.title,
  lead: r.lead,
  body_md: r.bodyMd,
  status: r.status,
  demo_notice: r.demoNotice,
  guide_profile: r.guideProfile,
  published_at: r.publishedAt?.toISOString() ?? null,
  version: r.version,
  updated_at: r.updatedAt.toISOString(),
  warnings,
});

/** content:{slug}, a dla artykulow takze content:guide (lista poradnika, strona glowna) - docs/14 par. 6. */
export const contentTags = (page: { slug: string; type: string }): string[] =>
  page.type === "guide" ? [`content:${page.slug}`, "content:guide"] : [`content:${page.slug}`];

@Injectable()
export class AdminContentService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(AuditService) private readonly audit: AuditService,
    @Inject(OutboxService) private readonly outbox: OutboxService,
    @Inject(BrandGuard) private readonly brands: BrandGuard,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  // ------------------------------------------------------------------ odczyt

  async list(type?: string) {
    const rows = await this.prisma.contentPage.findMany({
      where: type ? { type } : {},
      orderBy: [{ type: "asc" }, { title: "asc" }],
    });
    return { items: rows.map((r) => toAdmin(r)) };
  }

  async get(id: string) {
    const row = await this.prisma.contentPage.findUnique({ where: { id } });
    if (!row) throw notFound("Nie znaleziono tresci.");
    return toAdmin(row);
  }

  // ------------------------------------------------------------------ walidacja i sanityzacja

  private brandErrors(path: string, text: string): ProblemFieldError[] {
    return this.brands.find(text).length === 0
      ? []
      : [
          {
            path,
            code: "real_brand",
            message: "Tresc nie moze zawierac nazw prawdziwych marek (regula 5).",
          },
        ];
  }

  /** Sanityzuje pola tekstowe i zbiera bledy tresci; zwraca wartosci do zapisu i ostrzezenia. */
  private prepare(input: { title?: string; lead?: string | null; body_md?: string; type: string }) {
    const errors: ProblemFieldError[] = [];
    const warnings: Warning[] = [];
    const out: { title?: string; lead?: string | null; body_md?: string } = {};
    const touched: string[] = [];
    if (input.title !== undefined) {
      out.title = stripTags(input.title).trim();
      if (out.title !== input.title.trim()) touched.push("title");
      if (out.title.length < 2) {
        errors.push({ path: "title", code: "too_short", message: "Tytul ma co najmniej 2 znaki." });
      }
      errors.push(...this.brandErrors("title", out.title));
    }
    if (input.lead !== undefined) {
      out.lead = input.lead === null ? null : stripTags(input.lead).trim() || null;
      if (input.lead !== null && out.lead !== input.lead.trim()) touched.push("lead");
      if (out.lead) errors.push(...this.brandErrors("lead", out.lead));
    }
    if (input.body_md !== undefined) {
      out.body_md = sanitizeMarkdown(input.body_md);
      if (out.body_md !== input.body_md.replace(/\r\n?/g, "\n").trim()) touched.push("body_md");
      errors.push(...legalContentErrors(out.body_md), ...this.brandErrors("body_md", out.body_md));
      if (input.type === "guide") warnings.push(...guideWarnings(out.body_md));
    }
    if (touched.length > 0) {
      warnings.push({
        code: "content_sanitized",
        message:
          "Usunieto niedozwolone znaczniki, obrazy lub adresy z pol: " + touched.join(", ") + ".",
        details: touched,
      });
    }
    return { out, errors, warnings };
  }

  // ------------------------------------------------------------------ strony i artykuly

  /** B-304, B-305: nowa strona lub artykul. FAQ ma osobny zasob (B-307). */
  async create(body: Create, ctx: AuditContext) {
    if (body.type === "faq") {
      throw validationFailed([
        { path: "type", code: "faq_separate", message: "Pytania FAQ edytujesz w /v1/admin/faq." },
      ]);
    }
    const { out, errors, warnings } = this.prepare(body);
    if (body.type === "guide" && body.status === "published" && !body.guide_profile) {
      errors.push({
        path: "guide_profile",
        code: "guide_profile_required",
        message: "Opublikowany artykul musi miec ustawiony profil kreatora.",
      });
    }
    if (errors.length > 0) throw validationFailed(errors);

    const now = this.clock();
    const row = await this.audit.withAudit(ctx, async (tx, audit) => {
      if (await tx.contentPage.findUnique({ where: { slug: body.slug }, select: { id: true } })) {
        throw new AppException(409, "conflict", "Ten adres jest juz uzywany. Wybierz inny.", [
          {
            path: "slug",
            code: "slug_taken",
            message: "Ten adres jest juz uzywany. Wybierz inny.",
          },
        ]);
      }
      const created = await tx.contentPage.create({
        data: {
          slug: body.slug,
          type: body.type,
          title: out.title ?? body.title,
          lead: out.lead ?? null,
          bodyMd: out.body_md ?? "",
          status: body.status,
          demoNotice: body.demo_notice,
          guideProfile: body.guide_profile ?? null,
          publishedAt: body.status === "published" ? now : null,
          updatedAt: now,
        },
      });
      const auditId = await audit({
        action: "content.create",
        entity: "content",
        entityId: created.id,
        after: {
          slug: created.slug,
          type: created.type,
          title: created.title,
          status: created.status,
          body_md_chars: created.bodyMd.length,
        },
      });
      await this.outbox.enqueueTags(tx, contentTags(created), auditId);
      return created;
    });
    return toAdmin(row, warnings);
  }

  /** B-304..B-306: edycja, publikacja, cofniecie do szkicu; If-Match = wersja strony; ostatnie 20 wersji tresci. */
  async patch(id: string, body: Patch, version: number, ctx: AuditContext) {
    const result = await this.audit.withAudit(ctx, async (tx, audit) => {
      const locked = await tx.$queryRaw<{ version: number }[]>`
        SELECT version FROM content_pages WHERE id = ${id} FOR UPDATE`;
      if (!locked[0]) throw notFound("Nie znaleziono tresci.");
      if (locked[0].version !== version) throw preconditionFailed();
      const cur = await tx.contentPage.findUniqueOrThrow({ where: { id } });

      const { out, errors, warnings } = this.prepare({
        ...(body.title !== undefined ? { title: body.title } : {}),
        ...(body.lead !== undefined ? { lead: body.lead } : {}),
        ...(body.body_md !== undefined ? { body_md: body.body_md } : {}),
        type: cur.type,
      });
      // Strony z oznaczeniem demo (B-305): naglowek "Wzor tresci..." jest nieusuwalny.
      if (body.demo_notice === false && cur.demoNotice) {
        errors.push({
          path: "demo_notice",
          code: "demo_notice_locked",
          message: "Naglowek „Wzor tresci dla sklepu demonstracyjnego” jest nieusuwalny.",
        });
      }
      const next = {
        title: out.title ?? cur.title,
        lead: out.lead !== undefined ? out.lead : cur.lead,
        body_md: out.body_md ?? cur.bodyMd,
        status: body.status ?? cur.status,
        demo_notice: body.demo_notice ?? cur.demoNotice,
        guide_profile: body.guide_profile !== undefined ? body.guide_profile : cur.guideProfile,
      };
      if (cur.type === "guide" && next.status === "published" && !next.guide_profile) {
        errors.push({
          path: "guide_profile",
          code: "guide_profile_required",
          message: "Opublikowany artykul musi miec ustawiony profil kreatora.",
        });
      }
      if (errors.length > 0) throw validationFailed(errors);

      const before = {
        title: cur.title,
        lead: cur.lead,
        body_md: cur.bodyMd,
        status: cur.status,
        demo_notice: cur.demoNotice,
        guide_profile: cur.guideProfile,
      };
      const changedKeys = (Object.keys(next) as (keyof typeof next)[]).filter(
        (k) => JSON.stringify(before[k]) !== JSON.stringify(next[k]),
      );
      if (changedKeys.length === 0) return { row: cur, warnings };

      const now = this.clock();
      if (changedKeys.includes("title") || changedKeys.includes("body_md")) {
        await tx.contentRevision.create({
          data: { pageId: id, bodyMd: cur.bodyMd, title: cur.title, author: ctx.actorId, at: now },
        });
        const stale = await tx.contentRevision.findMany({
          where: { pageId: id },
          orderBy: [{ at: "desc" }, { id: "desc" }],
          skip: REVISIONS_KEPT,
          select: { id: true },
        });
        if (stale.length > 0) {
          await tx.contentRevision.deleteMany({ where: { id: { in: stale.map((s) => s.id) } } });
        }
      }
      const updated = await tx.contentPage.update({
        where: { id },
        data: {
          title: next.title,
          lead: next.lead,
          bodyMd: next.body_md,
          status: next.status,
          demoNotice: next.demo_notice,
          guideProfile: next.guide_profile,
          publishedAt:
            next.status === "published" && cur.publishedAt === null ? now : cur.publishedAt,
          version: { increment: 1 },
          updatedAt: now,
        },
      });
      const pick = (src: typeof before | typeof next): Record<string, unknown> =>
        Object.fromEntries(
          changedKeys.map((k) => [
            k === "body_md" ? "body_md_chars" : k,
            k === "body_md" ? src[k].length : src[k],
          ]),
        );
      const auditId = await audit({
        action: "content.update",
        entity: "content",
        entityId: id,
        before: pick(before),
        after: pick(next),
      });
      await this.outbox.enqueueTags(tx, contentTags(updated), auditId);
      return { row: updated, warnings };
    });
    return toAdmin(result.row, result.warnings);
  }

  /** B-305: strony informacyjne i prawne (typ `page`) nigdy nie sa usuwane, tylko archiwizowane (docs/16 par. 3.4). */
  async remove(id: string, ctx: AuditContext): Promise<void> {
    await this.audit.withAudit(ctx, async (tx, audit) => {
      const cur = await tx.contentPage.findUnique({ where: { id } });
      if (!cur) throw notFound("Nie znaleziono tresci.");
      if (cur.type === "page") {
        throw new AppException(
          409,
          "conflict",
          "Strony informacyjne i prawne tylko archiwizuj (status archived).",
          [
            {
              path: "id",
              code: "system_page",
              message: "Strony informacyjne i prawne tylko archiwizuj (status archived).",
            },
          ],
        );
      }
      await tx.contentPage.delete({ where: { id } });
      const auditId = await audit({
        action: "content.delete",
        entity: "content",
        entityId: id,
        before: { slug: cur.slug, type: cur.type, title: cur.title, status: cur.status },
      });
      await this.outbox.enqueueTags(tx, contentTags(cur), auditId);
    });
  }

  // ------------------------------------------------------------------ FAQ

  /** B-307: lista FAQ (kolejnosc = pozycja); w panelu takze szkice i zarchiwizowane. */
  async faq(warnings: Warning[] = []) {
    const rows = await this.prisma.faqItem.findMany({
      orderBy: [{ position: "asc" }, { id: "asc" }],
    });
    return {
      items: rows.map((r) => ({
        id: r.id,
        question: r.question,
        answer_md: r.answerMd,
        position: r.position,
        status: r.status as "draft" | "published" | "archived",
      })),
      warnings,
    };
  }

  /** B-307: zapis calej uporzadkowanej listy (dodaje, zmienia, usuwa pominiete); zmiana kolejnosci = nowa kolejnosc tablicy. */
  async putFaq(body: FaqPut, ctx: AuditContext) {
    const errors: ProblemFieldError[] = [];
    const warnings: Warning[] = [];
    const touched: string[] = [];
    const items = body.items.map((it, i) => {
      const question = stripTags(it.question).trim();
      const answer = sanitizeMarkdown(it.answer_md);
      if (question !== it.question.trim()) touched.push(`items[${i}].question`);
      if (answer !== it.answer_md.replace(/\r\n?/g, "\n").trim())
        touched.push(`items[${i}].answer_md`);
      errors.push(
        ...this.brandErrors(`items[${i}].question`, question),
        ...this.brandErrors(`items[${i}].answer_md`, answer),
        ...legalContentErrors(answer, `items[${i}].answer_md`),
      );
      return { id: it.id, question, answer_md: answer, status: it.status };
    });
    if (touched.length > 0) {
      warnings.push({
        code: "content_sanitized",
        message:
          "Usunieto niedozwolone znaczniki, obrazy lub adresy z pol: " + touched.join(", ") + ".",
        details: touched,
      });
    }
    if (errors.length > 0) throw validationFailed(errors);

    await this.audit.withAudit(ctx, async (tx, audit) => {
      const existing = await tx.faqItem.findMany({ orderBy: [{ position: "asc" }, { id: "asc" }] });
      const known = new Set(existing.map((e) => e.id));
      items.forEach((it, i) => {
        if (it.id !== undefined && !known.has(it.id)) {
          errors.push({ path: `items[${i}].id`, code: "unknown_id", message: "Nieznane pytanie." });
        }
      });
      const ids = items.map((i) => i.id).filter((x): x is string => x !== undefined);
      if (new Set(ids).size !== ids.length) {
        errors.push({ path: "items", code: "duplicate", message: "Pytanie wystepuje dwa razy." });
      }
      if (errors.length > 0) throw validationFailed(errors);

      const view = (
        list: { id?: string | undefined; question: string; answer_md: string; status: string }[],
      ) => list.map((x) => ({ id: x.id ?? null, q: x.question, a: x.answer_md, s: x.status }));
      const beforeView = view(
        existing.map((e) => ({
          id: e.id,
          question: e.question,
          answer_md: e.answerMd,
          status: e.status,
        })),
      );
      const sameShape =
        beforeView.length === items.length &&
        beforeView.every((b, i) => {
          const n = items[i]!;
          return (
            b.id === (n.id ?? null) && b.q === n.question && b.a === n.answer_md && b.s === n.status
          );
        });
      if (sameShape) return;

      await tx.faqItem.deleteMany({ where: { id: { notIn: ids } } });
      for (const [i, it] of items.entries()) {
        const data = {
          question: it.question,
          answerMd: it.answer_md,
          position: i + 1,
          status: it.status,
        };
        if (it.id) await tx.faqItem.update({ where: { id: it.id }, data });
        else await tx.faqItem.create({ data });
      }
      const auditId = await audit({
        action: "faq.replace",
        entity: "content",
        entityId: "faq",
        before: { count: existing.length },
        after: {
          count: items.length,
          published: items.filter((i) => i.status === "published").length,
        },
      });
      await this.outbox.enqueueTags(tx, ["content:faq"], auditId);
    });
    return this.faq(warnings);
  }
}
