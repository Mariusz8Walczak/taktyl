// B-300..B-308 (docs/15 par. 4, 9): /tresci - spis sekcji tresci jako odnosniki tekstowe.
import Link from "next/link";
import { PageHeader } from "../ui/page-header";

const SECTIONS = [
  [
    "/tresci/strony",
    "Strony informacyjne i prawne",
    "Regulamin, polityka prywatności, dostawa i inne (B-305, B-306).",
  ],
  ["/tresci/poradnik", "Poradniki", "Artykuły z profilem kreatora na końcu (B-304)."],
  ["/tresci/faq", "FAQ", "Pytania i odpowiedzi w ustalonej kolejności (B-307)."],
  [
    "/tresci/opisy",
    "Opisy produktów",
    "Opis 60–120 słów, ostrzeżenia o zakazanych słowach (B-300, B-301).",
  ],
  ["/tresci/opinie", "Opinie przykładowe", "Opinie demonstracyjne produktów (B-302, B-303)."],
  ["/zgloszenia", "Zgłoszenia z formularzy", "Kontakt i newsletter, status „obsłużone” (B-308)."],
] as const;

export function ContentHub() {
  return (
    <div className="adm-strona">
      <PageHeader title="Treści" />
      <ul className="adm-lista adm-stos">
        {SECTIONS.map(([href, label, hint]) => (
          <li key={href} className="adm-karta adm-stos">
            <Link className="tk-link" href={href}>
              {label}
            </Link>
            <span className="adm-powod">{hint}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
