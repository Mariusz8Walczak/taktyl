// F-220 (docs/05 §1, wzorzec: `blog-grid`, docs/08 §6): /poradnik - lista 4 poradnikow (tytul, lead, czas czytania,
// profil CTA). Tagi: content:guide, content:{slug}, rules (etykiety profili). Komponent serwerowy.
import type { Metadata } from "next";
import { Breadcrumbs } from "../../components/breadcrumbs";
import { PageHero } from "../../components/page-hero";
import { GuideCard } from "../../components/guides/guide-card";
import { getGuide, getGuides } from "../../lib/api";
import { getRules } from "../../lib/builder/data";
import { readingMinutes } from "../../lib/content/reading";
import { absoluteUrl } from "../../lib/site";
import "../../styles/poradnik.css";

export const metadata: Metadata = {
  title: "Poradnik",
  description:
    "Cztery krótkie poradniki: przełączniki, rozmiary klawiatur, dobór myszki i podkładki.",
  alternates: { canonical: absoluteUrl("/poradnik") },
  robots: { index: false, follow: false },
};

export default async function GuidesPage() {
  const [guides, rules] = await Promise.all([getGuides(), getRules()]);
  const full = await Promise.all(guides.map((g) => getGuide(g.slug)));
  return (
    <div className="kontener strona">
      <Breadcrumbs items={[{ label: "Strona główna", href: "/" }, { label: "Poradnik" }]} />
      <PageHero slug="poradnik" title="Poradnik">
        <p className="wstep">
          Krótkie odpowiedzi na pytania sprzed zakupu. Każdy poradnik kończy się wejściem do
          kreatora setu z ustawionym profilem.
        </p>
      </PageHero>
      <ul className="lista poradnik-lista">
        {guides.map((g, i) => {
          const body = full[i]?.body_md;
          return (
            <li key={g.slug}>
              <GuideCard
                slug={g.slug}
                title={g.title}
                lead={g.lead}
                minutes={body ? readingMinutes(body) : null}
                profileLabel={
                  g.guide_profile ? (rules.profiles[g.guide_profile]?.label ?? null) : null
                }
              />
            </li>
          );
        })}
      </ul>
    </div>
  );
}
