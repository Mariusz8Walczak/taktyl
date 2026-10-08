// F-220 (wzorzec: karta wpisu `blog-grid`, docs/08 §6): karta poradnika - tytul, lead, czas czytania, profil CTA.
// Komponent serwerowy do ponownego uzycia (lista /poradnik, 3 karty na stronie glownej). Okladka z public/img/poradnik (docs/09 §7).
import { applyNbsp } from "@taktyl/domain";
import Link from "next/link";
import { readingLabel } from "../../lib/content/reading";
import { GuideCover } from "./guide-cover";
import "../../styles/poradnik.css";

export interface GuideCardProps {
  slug: string;
  title: string;
  lead: string | null;
  /** Czas czytania w minutach (pomijany, gdy nieznany). */
  minutes?: number | null;
  /** Etykieta profilu kreatora (np. "Gry (inne)"). */
  profileLabel?: string | null;
  /** Poziom naglowka karty (h2 na liscie, h3 pod H2 sekcji na stronie glownej). */
  headingLevel?: 2 | 3;
}

export function GuideCard({
  slug,
  title,
  lead,
  minutes,
  profileLabel,
  headingLevel = 2,
}: GuideCardProps) {
  const H = `h${headingLevel}` as "h2" | "h3";
  return (
    <article className="poradnik-karta">
      <GuideCover slug={slug} loading="lazy" />
      <H className="poradnik-karta__tytul">
        <Link href={`/poradnik/${slug}`} className="poradnik-karta__link">
          {applyNbsp(title)}
        </Link>
      </H>
      {lead ? <p className="poradnik-karta__lead">{applyNbsp(lead)}</p> : null}
      <p className="poradnik-karta__meta">
        {minutes ? <span>{readingLabel(minutes)}</span> : null}
        {profileLabel ? <span>Profil: {profileLabel}</span> : null}
      </p>
    </article>
  );
}
