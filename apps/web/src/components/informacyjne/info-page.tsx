// F-221, F-247, F-008 (docs/05 §8, docs/11 §1.3; wzorzec: strona tekstowa `blog-details` / `about-us`, docs/08 §6):
// strona informacyjna i prawna z API (GET /v1/content/pages/{slug}, tag content:{slug}). Komponent serwerowy, zero JS
// po stronie klienta. Jedna kolumna do 720 px, baner demo na gorze (z danych strony), jeden H1, okruszki, data
// aktualizacji, spis tresci z kotwicami przy dluzszych stronach. Tresc skladana w elementy React (bez HTML z wejscia).
import { applyNbsp } from "@taktyl/domain";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import "../../styles/tresc.css";
import { getContentPage } from "../../lib/api";
import { parseMarkdown } from "../../lib/content/markdown";
import {
  DEMO_NOTICE,
  formatUpdated,
  infoToc,
  pageDescription,
  stripDemoNotice,
  type InfoSlug,
} from "../../lib/informacyjne/view";
import { absoluteUrl } from "../../lib/site";
import { Breadcrumbs } from "../breadcrumbs";
import { Markdown } from "../content/markdown";

/** generateMetadata strony informacyjnej; nieistniejaca strona tresci to 404 (docs/12 S23). */
export async function infoMetadata(slug: InfoSlug): Promise<Metadata> {
  const page = await getContentPage(slug);
  if (!page) notFound();
  return {
    title: page.title,
    description: pageDescription(page.lead, parseMarkdown(page.body_md)),
    alternates: { canonical: absoluteUrl(`/${slug}`) },
    robots: { index: false, follow: false },
  };
}

export async function InfoPage({ slug }: { slug: InfoSlug }) {
  const page = await getContentPage(slug);
  if (!page) notFound();
  const blocks = stripDemoNotice(parseMarkdown(page.body_md), page.demo_notice);
  const toc = infoToc(blocks);
  return (
    <div className="kontener strona">
      <Breadcrumbs items={[{ label: "Strona główna", href: "/" }, { label: page.title }]} />
      <article className="info">
        {page.demo_notice ? (
          <p className="info__baner" role="note">
            {DEMO_NOTICE}
          </p>
        ) : null}
        <h1 className="naglowek-strony info__h1">{applyNbsp(page.title)}</h1>
        {page.lead ? <p className="wstep">{applyNbsp(page.lead)}</p> : null}
        {page.published_at ? (
          <p className="info__aktualnosc">
            Zaktualizowano:{" "}
            <time dateTime={page.published_at}>{formatUpdated(page.published_at)}</time>
          </p>
        ) : null}
        {toc.length > 0 ? (
          <nav className="info__spis" aria-labelledby="info-spis-tytul">
            <h2 id="info-spis-tytul" className="info__spis-tytul">
              Spis treści
            </h2>
            <ol className="lista info__spis-lista">
              {toc.map((t) => (
                <li key={t.id}>
                  <a href={`#${t.id}`} className="tk-link info__spis-link">
                    {applyNbsp(t.text)}
                  </a>
                </li>
              ))}
            </ol>
          </nav>
        ) : null}
        <Markdown blocks={blocks} />
      </article>
    </div>
  );
}
