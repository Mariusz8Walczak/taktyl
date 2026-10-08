// F-005, F-006, F-007 (docs/16 par. 2, docs/04 par. 9): wyszukiwanie produktow, kategorii i poradnikow.
// Normalizacja i dopasowanie slow z @taktyl/domain (ta sama funkcja co w sklepie; "lupek" znajduje "Lupek").
import { Inject, Injectable } from "@nestjs/common";
import { searchResponseSchema } from "@taktyl/contracts";
import {
  matchesProductSearch,
  matchesSearch,
  normalizeSearchText,
  type Product,
} from "@taktyl/domain";
import { toCard } from "../catalog/card.js";
import { CatalogLoader, type CatalogSnapshot } from "../catalog/catalog.loader.js";
import { respond } from "../common/zod.pipe.js";
import { PrismaService } from "../prisma/prisma.service.js";

function haystack(p: Product, snap: CatalogSnapshot): string {
  const switchNames = p.variants.flatMap((v) =>
    v.switch === undefined ? [] : [snap.switches.find((s) => s.id === v.switch)?.name ?? ""],
  );
  const colorLabels = p.variants.map((v) => snap.colors[v.color]?.label ?? "");
  const category = snap.categories.find((c) => c.id === p.category)?.name ?? "";
  return [
    p.name,
    category,
    p.short,
    String(p.attributes.size ?? ""),
    String(p.attributes.size_label ?? ""),
    ...switchNames,
    ...colorLabels,
  ].join(" ");
}

@Injectable()
export class SearchService {
  constructor(
    @Inject(CatalogLoader) private readonly loader: CatalogLoader,
    @Inject(PrismaService) private readonly prisma: PrismaService,
  ) {}

  async search(q: string, limit: number) {
    const snap = await this.loader.load();
    const matches = (p: Product): boolean => matchesProductSearch(p, haystack(p, snap), q);
    const normalizedQuery = normalizeSearchText(q.trim());
    // Trafnosc: nazwa zaczyna sie od zapytania, potem nazwa zawiera, potem reszta; remis: kolejnosc katalogu.
    const rank = (p: Product): number => {
      const name = normalizeSearchText(p.name);
      return name.startsWith(normalizedQuery) ? 0 : name.includes(normalizedQuery) ? 1 : 2;
    };
    const products = snap.products
      .filter(matches)
      .map((p, i) => ({ p, i }))
      .sort((a, b) => rank(a.p) - rank(b.p) || a.i - b.i)
      .slice(0, limit)
      .map(({ p }) => p);

    // Miniatura: ujecie 01-34 domyslnego wariantu, tylko gotowe zdjecie, najmniejszy plik (400 px).
    const images = await this.prisma.productImage.findMany({
      where: {
        productId: { in: products.map((p) => p.id) },
        kind: "packshot",
        shot: "01-34",
        status: "gotowe",
      },
    });
    const thumbFor = (p: Product): string | null => {
      const color = p.variants.find((v) => v.sku === p.defaultVariant)?.color;
      const img = images.find((i) => i.productId === p.id && i.colorId === color);
      return img?.files[0] ?? null;
    };
    const cards = products.map((p) => ({
      ...toCard({ product: p, variants: p.variants, displayVariant: undefined }, false),
      thumb: thumbFor(p),
      category_name: snap.categories.find((c) => c.id === p.category)?.name ?? "",
    }));

    const categories = snap.categories
      .filter((c) => matchesSearch(c.name, q))
      .map((c) => ({ id: c.id, slug: c.slug, name: c.name }));

    const guides = (
      await this.prisma.contentPage.findMany({
        where: { type: "guide", status: "published" },
        orderBy: { slug: "asc" },
      })
    )
      .filter((g) => matchesSearch(`${g.title} ${g.lead ?? ""}`, q))
      .slice(0, limit)
      .map((g) => ({ slug: g.slug, title: g.title, lead: g.lead }));

    return respond(searchResponseSchema, { products: cards, categories, guides });
  }
}
