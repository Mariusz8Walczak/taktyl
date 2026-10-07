// F-076, F-220, F-221 (docs/16 par. 2, docs/04 par. 8, docs/11): publiczny odczyt tresci i opinii demo.
// Zwracamy tylko tresci o statusie `published`; zapis (i sanityzacja Markdown allowlista) dzieje sie w backpanelu (B-304, B-305),
// wiec tu tekst idzie bez zmian. Brak danych strukturalnych aggregateRating/review: tylko `avg` i `count` do wyswietlenia.
import { Inject, Injectable } from "@nestjs/common";
import { REVIEWS_LABEL } from "@taktyl/contracts";
import { notFound } from "../common/app-exception.js";
import type { ContentPage } from "../prisma/client.js";
import { PrismaService } from "../prisma/prisma.service.js";

const round1 = (n: number): number => Math.round(n * 10) / 10;

function pageBody(p: ContentPage) {
  return {
    slug: p.slug,
    type: p.type as "page" | "guide",
    title: p.title,
    lead: p.lead,
    body_md: p.bodyMd,
    demo_notice: p.demoNotice,
    guide_profile: p.guideProfile as never,
    published_at: p.publishedAt ? p.publishedAt.toISOString() : null,
  };
}

@Injectable()
export class PublicContentService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  /** F-221: strona informacyjna lub prawna; szkic i archiwum to 404. Znacznik sklepu: `content:{slug}`. */
  async page(slug: string) {
    const p = await this.prisma.contentPage.findFirst({
      where: { slug, type: "page", status: "published" },
    });
    if (!p) throw notFound("Nie znaleziono strony.");
    return pageBody(p);
  }

  /** F-220: lista artykulow poradnika, najnowsze pierwsze. Znacznik sklepu: `content:guide`. */
  async guides() {
    const rows = await this.prisma.contentPage.findMany({
      where: { type: "guide", status: "published" },
      orderBy: [{ publishedAt: { sort: "desc", nulls: "last" } }, { slug: "asc" }],
    });
    return {
      items: rows.map((p) => ({
        slug: p.slug,
        title: p.title,
        lead: p.lead,
        guide_profile: p.guideProfile as never,
      })),
    };
  }

  /** F-220: artykul poradnika. Znaczniki sklepu: `content:{slug}`, `content:guide`. */
  async guide(slug: string) {
    const p = await this.prisma.contentPage.findFirst({
      where: { slug, type: "guide", status: "published" },
    });
    if (!p) throw notFound("Nie znaleziono artykulu.");
    return pageBody(p);
  }

  /** F-221: FAQ w ustalonej kolejnosci, tylko opublikowane. Znacznik sklepu: `content:faq`. */
  async faq() {
    const rows = await this.prisma.faqItem.findMany({
      where: { status: "published" },
      orderBy: [{ position: "asc" }, { id: "asc" }],
    });
    return { items: rows.map((r) => ({ question: r.question, answer_md: r.answerMd })) };
  }

  /** F-076, B-303: opinie demo produktu (aktywnego) z etykieta, srednia (1 miejsce po przecinku) i liczba. Znacznik: `reviews:{slug}`. */
  async reviews(slug: string) {
    const p = await this.prisma.product.findFirst({
      where: { slug, status: "active" },
      select: { reviews: { orderBy: [{ date: "desc" }, { id: "asc" }] } },
    });
    if (!p) throw notFound("Nie znaleziono produktu.");
    const count = p.reviews.length;
    return {
      label: REVIEWS_LABEL,
      avg: count === 0 ? null : round1(p.reviews.reduce((s, r) => s + r.rating, 0) / count),
      count,
      items: p.reviews.map((r) => ({
        author: r.author,
        date: r.date.toISOString().slice(0, 10),
        rating: r.rating,
        variant_label: r.variantLabel,
        text: r.text,
        demo: true as const,
      })),
    };
  }
}
