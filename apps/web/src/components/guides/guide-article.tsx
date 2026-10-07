// F-220 (wzorzec: `blog-details`, docs/08 §6): artykul poradnika - H1, czas czytania, spis tresci z H2, tresc,
// wejscie do kreatora z profilem na koncu. Komponent serwerowy.
import { applyNbsp } from "@taktyl/domain";
import Link from "next/link";
import { extractToc, parseMarkdown } from "../../lib/content/markdown";
import { builderHref, readingLabel, readingMinutes } from "../../lib/content/reading";
import { Markdown } from "../content/markdown";
import "../../styles/poradnik.css";

export interface GuideArticleProps {
  title: string;
  lead: string | null;
  body: string;
  profile: string | null;
  profileLabel: string | null;
}

export function GuideArticle({ title, lead, body, profile, profileLabel }: GuideArticleProps) {
  const blocks = parseMarkdown(body);
  const toc = extractToc(blocks);
  return (
    <article className="poradnik">
      <header className="poradnik__naglowek">
        <h1 className="naglowek-strony">{applyNbsp(title)}</h1>
        {lead ? <p className="wstep">{applyNbsp(lead)}</p> : null}
        <p className="poradnik-karta__meta">
          <span>{readingLabel(readingMinutes(body))}</span>
        </p>
      </header>
      {toc.length >= 2 ? (
        <nav className="poradnik__spis" aria-labelledby="spis-tresci">
          <h2 id="spis-tresci" className="poradnik__spis-tytul">
            Spis treści
          </h2>
          <ol className="lista">
            {toc.map((t) => (
              <li key={t.id}>
                <a href={`#${t.id}`} className="tk-link poradnik__spis-link">
                  {t.text}
                </a>
              </li>
            ))}
          </ol>
        </nav>
      ) : null}
      <Markdown blocks={blocks} />
      <aside className="poradnik__cta" aria-labelledby="poradnik-cta">
        <h2 id="poradnik-cta" className="poradnik__cta-tytul">
          Sprawdź to na własnym zestawie
        </h2>
        <Link href={builderHref(profile)} className="tk-btn tk-btn--glowny">
          {profileLabel ? `Otwórz kreator z profilem „${profileLabel}”` : "Otwórz kreator setu"}
        </Link>
      </aside>
    </article>
  );
}
