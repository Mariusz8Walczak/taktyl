// F-076 (docs/04 §8, docs/11 §1.2; wzorzec: `product-reviews` z karty produktu, docs/08 §6): sekcja opinii demo.
// Komponent serwerowy, kotwica #opinie. Etykieta "Opinie przykładowe — sklep demonstracyjny" jest zawsze widoczna,
// srednia zawsze z liczba. BEZ danych strukturalnych aggregateRating/review. Tag `reviews:{slug}`.
import { getReviews } from "../../lib/api";
import { ratingText, reviewDate, reviewSummary, starChars } from "../../lib/reviews/format";
import "../../styles/poradnik.css";

export async function ReviewsSection({ slug }: { slug: string }) {
  const data = await getReviews(slug).catch(() => null); // opinie to dodatek: brak API nie psuje karty
  if (!data) return null;
  return <ReviewsView data={data} />;
}

export function ReviewsView({
  data,
}: {
  data: {
    label: string;
    avg: number | null;
    count: number;
    items: readonly {
      author: string;
      date: string;
      rating: number;
      variant_label: string;
      text: string;
    }[];
  };
}) {
  return (
    <section className="opinie" id="opinie" aria-labelledby="opinie-naglowek">
      <h2 id="opinie-naglowek" className="opinie__naglowek">
        Opinie
      </h2>
      <p className="opinie__etykieta">{data.label}</p>
      <p className="opinie__podsumowanie">
        {data.avg !== null ? (
          <span className="opinie__gwiazdki" aria-hidden="true">
            {starChars(data.avg)}
          </span>
        ) : null}{" "}
        <span className="tk-sr-only">Średnia ocena: </span>
        <strong>{reviewSummary(data.avg, data.count)}</strong>
      </p>
      {data.items.length > 0 ? (
        <ul className="lista opinie__lista">
          {data.items.map((r, i) => (
            <li key={`${r.author}-${r.date}-${i}`} className="opinia">
              <p className="opinia__ocena">
                <span className="opinie__gwiazdki" aria-hidden="true">
                  {starChars(r.rating)}
                </span>{" "}
                <span className="opinia__ocena-tekst">{ratingText(r.rating)}</span>
              </p>
              <p className="opinia__tresc">{r.text}</p>
              <p className="opinia__meta">
                <span>{r.author}</span>
                <time dateTime={r.date}>{reviewDate(r.date)}</time>
                <span>Wariant: {r.variant_label}</span>
              </p>
            </li>
          ))}
        </ul>
      ) : (
        <p>Ten produkt nie ma jeszcze opinii.</p>
      )}
    </section>
  );
}
