// F-007 (docs/05 §1): ZASLEPKA strony wynikow `/szukaj?q=`; wlasciwa strona (uklad listingu, wyniki, brak wynikow
// z 3 najpopularniejszymi produktami) to TAKTYL-59. Pole wyszukiwania w naglowku juz tu prowadzi (WEB-010).
import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = { title: "Wyniki wyszukiwania" };

export default async function SearchResultsPlaceholder({
  searchParams,
}: {
  searchParams: Promise<{ q?: string | string[] }>;
}) {
  const { q } = await searchParams;
  const query = (Array.isArray(q) ? q[0] : q)?.trim().slice(0, 80);
  return (
    <div className="kontener strona">
      <h1 className="naglowek-strony">Wyniki wyszukiwania</h1>
      {query ? <p className="wstep">Szukana fraza: „{query}”.</p> : null}
      <p>
        Pełna strona wyników jest w przygotowaniu. Tymczasem przejdź do kategorii:{" "}
        <Link href="/klawiatury" className="tk-link">
          Klawiatury
        </Link>
        ,{" "}
        <Link href="/myszki" className="tk-link">
          Myszki
        </Link>
        ,{" "}
        <Link href="/podkladki" className="tk-link">
          Podkładki
        </Link>
        .
      </p>
    </div>
  );
}
