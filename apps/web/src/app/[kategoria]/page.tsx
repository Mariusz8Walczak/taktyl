// F-020...F-027, F-029, F-040, F-041, F-044, F-008 (docs/05 §3): listing kategorii /klawiatury, /myszki, /podkladki.
// Wzorzec: `shop-filter-sidebar` + `shop-loadmore` (docs/08 §3). Komponent serwerowy: H1 i wstep z API, okruszki
// (BreadcrumbList), karty renderowane na serwerze; interakcje filtrow to jedna wyspa kliencka (ListingShell).
// Dane: /v1/categories, /v1/facets, /v1/products z tagami category:{slug}, catalog, facets:{slug} (docs/14 §6).
import { applyNbsp } from "@taktyl/domain";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import "../../styles/listing.css";
import { Breadcrumbs } from "../../components/breadcrumbs";
import { Cards } from "../../components/listing/cards";
import { EmptyState } from "../../components/listing/empty-state";
import { ListingShell } from "../../components/listing/listing-shell";
import { SetPrompt } from "../../components/listing/set-prompt";
import { getCategoryBySlug, getColors, getFacets, getListingUpTo } from "../../lib/api";
import {
  facetDefs,
  parseQuery,
  toApiFilters,
  toSearch,
  type NextSearchParams,
} from "../../lib/catalog/listing-query";
import { absoluteUrl } from "../../lib/site";
import { buildItem } from "../../lib/track-items";

const PAGE_SIZE = 12;
const MAX_PAGE = 20;
/** Po 6. karcie (indeks 5) tylko klawiatury i podkladki (docs/05 §3 pkt 8). */
const SET_PROMPT_INDEX = 5;
/** Wejscie z listingu do konkretnego poradnika (F-220; docs/05 §3 pkt 2). */
const GUIDE_LINK: Record<string, { label: string; href: string }> = {
  klawiatury: { label: "Jaki rozmiar klawiatury wybrać?", href: "/poradnik/rozmiary-klawiatur" },
  myszki: { label: "Jak dobrać myszkę do dłoni?", href: "/poradnik/jak-dobrac-mysz-do-dloni" },
  podkladki: {
    label: "Jaka podkładka: szybka, kontrolna, mata na biurko?",
    href: "/poradnik/jaka-podkladka",
  },
};

type Props = {
  params: Promise<{ kategoria: string }>;
  searchParams: Promise<NextSearchParams>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { kategoria } = await params;
  const category = await getCategoryBySlug(kategoria);
  if (!category) return { title: "Nie ma takiej strony", robots: { index: false, follow: false } };
  return {
    title: category.name,
    description: category.intro,
    alternates: { canonical: absoluteUrl(`/${category.slug}`) },
    robots: { index: false, follow: false },
  };
}

export default async function ListingPage({ params, searchParams }: Props) {
  const { kategoria } = await params;
  const sp = await searchParams;
  const category = await getCategoryBySlug(kategoria);
  if (!category) notFound();

  // Definicje filtrow (bez aktywnych filtrow, cache `facets:{slug}`) sluza do odczytu adresu.
  const base = await getFacets(category.id);
  const defs = facetDefs(base.facets);
  const query = parseQuery(sp, defs, category.id);
  const apiFilters = toApiFilters(query.filters, base.facets);
  const hasFilters = Object.keys(apiFilters).length > 0;
  const page = Math.min(query.page, MAX_PAGE);

  const [facets, colors, listing] = await Promise.all([
    hasFilters ? getFacets(category.id, apiFilters) : Promise.resolve(base),
    getColors(),
    getListingUpTo(
      { category: category.id, filters: apiFilters, sort: query.sort },
      page * PAGE_SIZE,
    ),
  ]);

  const queryKey = toSearch({ ...query, page: 1 }, defs);
  const setPrompt =
    (category.id === "klawiatury" || category.id === "podkladki") &&
    listing.items.length > SET_PROMPT_INDEX;

  const trackItems = listing.items.map((c, index) =>
    buildItem({
      sku: c.matched_variant_sku ?? c.default_variant_sku,
      name: c.name,
      category: c.category,
      priceGr: c.from_price_gr,
      listId: category.id,
      listName: category.name,
      index,
    }),
  );

  return (
    <div className="kontener strona strona--listing">
      <Breadcrumbs items={[{ label: "Strona główna", href: "/" }, { label: category.name }]} />
      <header className="listing__naglowek">
        <h1 className="naglowek-strony">{applyNbsp(category.h1)}</h1>
        <p className="wstep">{applyNbsp(category.intro)}</p>
        <p>
          <Link href={GUIDE_LINK[category.id]?.href ?? "/poradnik"} className="tk-link">
            {GUIDE_LINK[category.id]?.label}
          </Link>
        </p>
      </header>
      <ListingShell
        category={{ id: category.id, name: category.name }}
        facets={facets.facets}
        defs={defs}
        state={query.filters}
        sort={query.sort}
        total={listing.total}
        queryKey={queryKey}
        swatches={Object.fromEntries(colors.map((c) => [c.id, c.swatch]))}
        initialCount={listing.items.length}
        nextCursor={listing.nextCursor}
        initialPage={page}
        trackItems={trackItems}
        cards={
          <Cards
            cards={listing.items}
            categoryName={category.name}
            priorityCount={4}
            insertAfter={setPrompt ? { index: SET_PROMPT_INDEX, node: <SetPrompt /> } : undefined}
          />
        }
        empty={
          <EmptyState
            categoryId={category.id}
            categoryName={category.name}
            resetHref={`/${category.slug}`}
            hasFilters={hasFilters}
          />
        }
      />
    </div>
  );
}
