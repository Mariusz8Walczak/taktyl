// F-008 (docs/02 §2): okruszki na listingu i karcie produktu + dane strukturalne BreadcrumbList.
// Wzorzec: okruszki szablonu (docs/08), ostylowane tokenami. Biezaca strona to tekst z aria-current, nie odnosnik.
import Link from "next/link";
import "../styles/okruszki.css";
import { breadcrumbJsonLd, jsonLdString, type Crumb } from "../lib/json-ld";

export function Breadcrumbs({ items }: { items: readonly Crumb[] }) {
  return (
    <>
      <nav className="okruszki" aria-label="Okruszki">
        <ol className="lista okruszki__lista">
          {items.map((c, i) => {
            const last = i === items.length - 1;
            return (
              <li key={`${c.label}-${i}`} className="okruszki__pozycja">
                {c.href && !last ? (
                  <Link href={c.href} className="tk-link okruszki__link">
                    {c.label}
                  </Link>
                ) : (
                  <span aria-current={last ? "page" : undefined}>{c.label}</span>
                )}
              </li>
            );
          })}
        </ol>
      </nav>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLdString(breadcrumbJsonLd(items)) }}
      />
    </>
  );
}
