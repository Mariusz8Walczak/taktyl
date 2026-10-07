// F-221 (docs/05 §1 "/404", docs/12 S23; wzorzec: strona bledu 404 szablonu, docs/08 §6): pelne 404 - komunikat,
// wyszukiwarka (formularz GET do /szukaj, dziala bez JS) i trzy kategorie. Kod odpowiedzi 404 ustawia Next dla
// nieznanych adresow i dla notFound(); noindex w meta (reguła 10). Bez zdarzen pomiaru (brak listy produktow).
import type { Metadata } from "next";
import Link from "next/link";
import "../styles/tresc.css";
import { getCategories } from "../lib/api";
import { NAV_MAIN } from "../lib/nav";

export const metadata: Metadata = {
  title: "Nie ma takiej strony",
  robots: { index: false, follow: false },
};

interface CategoryLink {
  id: string;
  name: string;
  href: string;
}

/** Trzy kategorie z API; gdy API nie odpowiada, 404 nadal sie wyswietla (nawigacja glowna jako zapas). */
async function categoryLinks(): Promise<CategoryLink[]> {
  try {
    const categories = await getCategories();
    return [...categories]
      .sort((a, b) => a.position - b.position)
      .slice(0, 3)
      .map((c) => ({ id: c.id, name: c.name, href: `/${c.slug}` }));
  } catch {
    return NAV_MAIN.slice(0, 3).map((n) => ({ id: n.href, name: n.label, href: n.href }));
  }
}

export default async function NotFound() {
  const categories = await categoryLinks();
  return (
    <div className="kontener strona">
      <div className="nie-ma">
        <h1 className="naglowek-strony">Nie ma takiej strony</h1>
        <p className="wstep">
          Adres mógł się zmienić albo zawiera literówkę. Poszukaj produktu albo wybierz kategorię.
        </p>
        <form action="/szukaj" method="get" role="search" className="nie-ma__szukaj">
          <label htmlFor="nie-ma-q" className="tk-pole__etykieta">
            Czego szukasz?
          </label>
          <div className="nie-ma__wiersz">
            <input
              id="nie-ma-q"
              name="q"
              type="search"
              className="tk-pole__kontrolka"
              maxLength={80}
              autoComplete="off"
            />
            <button type="submit" className="tk-btn tk-btn--glowny">
              Szukaj
            </button>
          </div>
        </form>
        <h2 className="nie-ma__tytul">Kategorie</h2>
        <ul className="lista nie-ma__kategorie">
          {categories.map((c) => (
            <li key={c.id}>
              <Link href={c.href} className="nie-ma__kategoria">
                {c.name}
              </Link>
            </li>
          ))}
        </ul>
        <p>
          <Link href="/" className="tk-link">
            Wróć na stronę główną
          </Link>
        </p>
      </div>
    </div>
  );
}
