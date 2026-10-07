// F-007 (docs/05 §1, docs/02 F-007; wzorzec: wyniki w ukladzie listingu `shop-grid`, docs/08 §3): /szukaj?q= - karty
// produktow z GET /v1/search (normalizacja i synonimy po stronie API), licznik z Intl.PluralRules, brak wynikow =
// komunikat + 3 najpopularniejsze produkty ("Polecane"). Bez cache wyniku (zalezy od q), noindex. Zastepuje zaslepke
// z TAKTYL-29. Zdarzenie `search` wysyla okno wyszukiwarki (F-005); tu `view_item_list` i `select_item` (TrackedGrid).
import { Alert } from "@taktyl/ui";
import { formatCount, type PluralForms } from "@taktyl/domain";
import type { Metadata } from "next";
import Link from "next/link";
import "../../styles/listing.css";
import "../../styles/poradnik.css";
import { Breadcrumbs } from "../../components/breadcrumbs";
import { Cards } from "../../components/listing/cards";
import { TrackedGrid } from "../../components/search/tracked-grid";
import { ApiError, getListing, getSearch } from "../../lib/api";
import type { SearchResponse } from "../../lib/api";

export const metadata: Metadata = {
  title: "Wyniki wyszukiwania",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

const MAX_QUERY = 80;
const RESULT_FORMS: PluralForms = { one: "wynik", few: "wyniki", many: "wyników" };
const CATEGORIES = ["klawiatury", "myszki", "podkladki"] as const;

type Props = { searchParams: Promise<{ q?: string | string[] }> };

/** "3 najpopularniejsze": po jednym pierwszym produkcie z kategorii w sortowaniu "Polecane". */
async function popular() {
  const lists = await Promise.all(
    CATEGORIES.map((category) =>
      getListing({ category, filters: {}, sort: "polecane", limit: 1 }).then((r) => r.items),
    ),
  );
  return lists.flat().slice(0, 3);
}

function SearchForm({ query }: { query: string }) {
  return (
    <form action="/szukaj" method="get" role="search" className="szukaj-formularz">
      <label htmlFor="szukaj-q" className="tk-pole__etykieta">
        Czego szukasz?
      </label>
      <div className="szukaj-formularz__wiersz">
        <input
          id="szukaj-q"
          name="q"
          type="search"
          className="tk-pole__kontrolka"
          defaultValue={query}
          maxLength={MAX_QUERY}
          autoComplete="off"
        />
        <button type="submit" className="tk-btn tk-btn--glowny">
          Szukaj
        </button>
      </div>
    </form>
  );
}

export default async function SearchResultsPage({ searchParams }: Props) {
  const { q } = await searchParams;
  const query = (Array.isArray(q) ? q[0] : q)?.trim().slice(0, MAX_QUERY) ?? "";

  let result: SearchResponse | null = null;
  let failed = false;
  if (query) {
    try {
      result = await getSearch(query, 20);
    } catch (e) {
      // 422 (np. fraza z samych znakow niedozwolonych) traktujemy jak brak wynikow, reszta to blad uslugi
      if (e instanceof ApiError && e.status === 422)
        result = { products: [], categories: [], guides: [] };
      else failed = true;
    }
  }
  const products = result?.products ?? [];
  const suggestions = query && result && products.length === 0 ? await popular() : [];

  return (
    <div className="kontener strona strona--listing">
      <Breadcrumbs
        items={[{ label: "Strona główna", href: "/" }, { label: "Wyniki wyszukiwania" }]}
      />
      <h1 className="naglowek-strony">Wyniki wyszukiwania</h1>
      <SearchForm query={query} />

      {!query ? (
        <p className="wstep">Wpisz nazwę produktu, kategorię albo temat, np. „przełączniki”.</p>
      ) : failed ? (
        <Alert variant="blad">
          Nie udało się teraz wyszukać. Spróbuj ponownie za chwilę albo przejdź do kategorii.
        </Alert>
      ) : products.length > 0 ? (
        <section aria-labelledby="szukaj-licznik">
          <p id="szukaj-licznik" className="szukaj-licznik" role="status">
            {formatCount(products.length, RESULT_FORMS)} dla „{query}”
          </p>
          <TrackedGrid listId="szukaj" listName="Wyniki wyszukiwania">
            <Cards cards={products} categoryName="Wyniki wyszukiwania" priorityCount={4} />
          </TrackedGrid>
        </section>
      ) : (
        <section className="pusty" aria-labelledby="szukaj-pusto">
          <Alert variant="info" title={`Brak wyników dla „${query}”`}>
            Sprawdź pisownię albo wpisz krótszą frazę. Poniżej najpopularniejsze produkty.
          </Alert>
          <h2 id="szukaj-pusto" className="pusty__naglowek">
            Polecane
          </h2>
          <TrackedGrid listId="szukaj-polecane" listName="Polecane" columns={3}>
            <Cards cards={suggestions} categoryName="Polecane" />
          </TrackedGrid>
        </section>
      )}

      {result && result.guides.length > 0 ? (
        <section className="szukaj-poradniki" aria-labelledby="szukaj-poradniki">
          <h2 id="szukaj-poradniki" className="pusty__naglowek">
            Poradniki
          </h2>
          <ul className="lista">
            {result.guides.map((g) => (
              <li key={g.slug}>
                <Link href={`/poradnik/${g.slug}`} className="tk-link szukaj-poradniki__link">
                  {g.title}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
