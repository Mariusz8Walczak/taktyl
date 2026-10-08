// F-020, F-100, F-220 (docs/09 §7): hero podstrony ze zdjeciem od czlowieka (render, public/img/hero/{slug}-*.webp).
// Zdjecie jest dekoracja (alt=""), tresc niesie H1 i wstep. Telefon: tekst nad zdjeciem 4:5; komputer: tekst w panelu
// na zdjeciu 12:5 (kontrast z tokenow, nie z kadru). Komponent serwerowy, bez JS; zdjecie to kandydat LCP, wiec
// fetchpriority="high" i srcset z trzech szerokosci.
import { applyNbsp } from "@taktyl/domain";
import type { ReactNode } from "react";
import "../styles/page-hero.css";

export type HeroSlug = "klawiatury" | "myszki" | "podkladki" | "zbuduj-set" | "poradnik";

const base = (slug: HeroSlug, kind: "desktop" | "mobile", w: number) =>
  `/img/hero/${slug}-${kind}-${w}.webp ${w}w`;

export function PageHero({
  slug,
  title,
  titleId,
  children,
}: {
  slug: HeroSlug;
  title: string;
  titleId?: string;
  /** Wstep i dodatkowe akcje pod H1. */
  children?: ReactNode;
}) {
  return (
    <header className="page-hero">
      <picture className="page-hero__zdjecie">
        <source
          media="(min-width: 576px)"
          srcSet={[960, 1600, 2400].map((w) => base(slug, "desktop", w)).join(", ")}
          sizes="(min-width: 1344px) 1280px, 100vw"
          width={2400}
          height={1000}
        />
        <img
          src={`/img/hero/${slug}-mobile-720.webp`}
          srcSet={[720, 1080].map((w) => base(slug, "mobile", w)).join(", ")}
          sizes="100vw"
          width={1080}
          height={1350}
          alt=""
          decoding="async"
          fetchPriority="high"
        />
      </picture>
      <div className="page-hero__tekst">
        <h1 id={titleId} className="naglowek-strony page-hero__h1">
          {applyNbsp(title)}
        </h1>
        {children}
      </div>
    </header>
  );
}
