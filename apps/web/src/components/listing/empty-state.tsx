// F-029 (docs/02 §3): pusty wynik - komunikat, przycisk "Wyczyść filtry" i 3 propozycje (nigdy pusta siatka).
// Propozycje to 3 pierwsze produkty kategorii w sortowaniu "Polecane" (bez filtrow), te same dane co listing.
import { Alert } from "@taktyl/ui";
import { getListing } from "../../lib/api";
import { Cards } from "./cards";

export interface EmptyStateProps {
  categoryId: "klawiatury" | "myszki" | "podkladki";
  categoryName: string;
  /** Adres listingu bez filtrow. */
  resetHref: string;
  hasFilters: boolean;
}

export async function EmptyState({
  categoryId,
  categoryName,
  resetHref,
  hasFilters,
}: EmptyStateProps) {
  const suggestions = await getListing({
    category: categoryId,
    filters: {},
    sort: "polecane",
    limit: 3,
  });
  return (
    <section className="pusty" aria-labelledby="pusty-naglowek">
      <Alert variant="info" title="Brak produktów dla wybranych filtrów">
        Zmień albo usuń część filtrów. Poniżej kilka propozycji z kategorii.
      </Alert>
      {hasFilters ? (
        <p>
          <a href={resetHref} className="tk-btn tk-btn--glowny pusty__wyczysc">
            Wyczyść filtry
          </a>
        </p>
      ) : null}
      <h2 id="pusty-naglowek" className="pusty__naglowek">
        Zobacz w kategorii: {categoryName}
      </h2>
      <ul className="lista siatka" data-kolumny={3}>
        <Cards cards={suggestions.items} categoryName={categoryName} />
      </ul>
    </section>
  );
}
