// F-005, F-006, F-007 (docs/16 par. 2, docs/04 par. 9): wyszukiwanie produktow, kategorii i poradnikow.
// Normalizacja i dopasowanie slow z @taktyl/domain (ta sama funkcja co w sklepie; "lupek" znajduje "Lupek").
import { Inject, Injectable } from "@nestjs/common";
import { searchResponseSchema } from "@taktyl/contracts";
import { matchesSearch, normalizeSearchText, searchTokens, type Product } from "@taktyl/domain";
import { toCard } from "../catalog/card.js";
import { CatalogLoader, type CatalogSnapshot } from "../catalog/catalog.loader.js";
import { respond } from "../common/zod.pipe.js";
import { PrismaService } from "../prisma/prisma.service.js";

/** F-006: synonimy mapowane na dane (nie na tekst): slowo -> predykat produktu. */
const SYNONYMS: Record<string, (p: Product) => boolean> = {
  bezprzewodowa: (p) => hasConnectivity(p, ["bt", "2.4ghz"]),
  bezprzewodowy: (p) => hasConnectivity(p, ["bt", "2.4ghz"]),
  cicha: (p) => (p.fit.cisza ?? 0) >= 2,
  cichy: (p) => (p.fit.cisza ?? 0) >= 2,
  lekka: (p) =>
    p.category === "myszki" &&
    typeof p.attributes.weight_g === "number" &&
    p.attributes.weight_g <= 60,
  lekki: (p) =>
    p.category === "myszki" &&
    typeof p.attributes.weight_g === "number" &&
    p.attributes.weight_g <= 60,
  mata: (p) => p.category === "podkladki",
  pionowa: (p) => String(p.attributes.shape ?? "").includes("pionow"),
};

function hasConnectivity(p: Product, wanted: string[]): boolean {
  const c = p.attributes.connectivity;
  return Array.isArray(c) && c.some((x) => wanted.includes(x));
}

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
    const tokens = searchTokens(q);
    const matches = (p: Product): boolean => {
      const text = haystack(p, snap);
      return tokens.every((t) => {
        const synonym = SYNONYMS[t];
        return matchesSearch(text, t) || (synonym?.(p) ?? false);
      });
    };
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
      .map(({ p }) =>
        toCard({ product: p, variants: p.variants, displayVariant: undefined }, false),
      );

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

    return respond(searchResponseSchema, { products, categories, guides });
  }
}
