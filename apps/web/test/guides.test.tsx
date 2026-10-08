// F-220 (TAKTYL-58): poradnik - parser Markdownu, karta, artykul (spis tresci, CTA z profilem), JSON-LD Article.
import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { axe } from "vitest-axe";
import { Markdown } from "../src/components/content/markdown";
import { GuideArticle } from "../src/components/guides/guide-article";
import { GuideCard } from "../src/components/guides/guide-card";
import { articleJsonLd } from "../src/lib/content/article-json-ld";
import { extractToc, headingSlug, parseMarkdown } from "../src/lib/content/markdown";
import { builderHref, readingMinutes } from "../src/lib/content/reading";

const BODY = [
  "> Wzór treści dla sklepu demonstracyjnego Taktyl.",
  "",
  "Wstęp z **pogrubieniem**, [linkiem](/zbuduj-set) i [obcym](javascript:alert(1)).",
  "",
  "## Łupek i Próg",
  "",
  "| Model | Siła |",
  "| ----- | ---- |",
  "| Próg  | 45 g |",
  "",
  "## Drugi rozdział",
  "",
  "- jeden",
  "- dwa",
].join("\n");

describe("Markdown (F-220)", () => {
  it("adresy naglowkow nie maja polskich znakow (l osobno) i sa unikalne", () => {
    expect(headingSlug("Łupek: Próg i Szept")).toBe("lupek-prog-i-szept");
    const blocks = parseMarkdown("## A\n\n## A");
    expect(blocks.map((b) => (b.kind === "h" ? b.id : ""))).toEqual(["a", "a-2"]);
  });

  it("wyciaga spis tresci tylko z H2", () => {
    const toc = extractToc(parseMarkdown(`${BODY}\n\n### Pod`));
    expect(toc).toEqual([
      { id: "lupek-i-prog", text: "Łupek i Próg" },
      { id: "drugi-rozdzial", text: "Drugi rozdział" },
    ]);
  });

  it("renderuje tabele, liste, odnosnik wewnetrzny i odrzuca niebezpieczny adres", () => {
    render(<Markdown markdown={BODY} />);
    expect(screen.getByRole("columnheader", { name: "Siła" })).toBeInTheDocument();
    expect(screen.getByRole("cell", { name: "45 g" })).toBeInTheDocument();
    expect(screen.getAllByRole("listitem")).toHaveLength(2);
    expect(screen.getByRole("link", { name: "linkiem" })).toHaveAttribute("href", "/zbuduj-set");
    expect(screen.queryByRole("link", { name: "obcym" })).toBeNull();
    expect(screen.getByText(/obcym/)).toBeInTheDocument();
  });
});

describe("Czas czytania i adres kreatora (F-220)", () => {
  it("liczy ceil(slowa / 200)", () => {
    expect(readingMinutes(Array(401).fill("slowo").join(" "))).toBe(3);
    expect(readingMinutes("")).toBe(1);
  });
  it("wejscie do kreatora ma profil i wejscie=guide", () => {
    expect(builderHref("fps")).toBe("/zbuduj-set?profil=fps&wejscie=guide");
    expect(builderHref(null)).toBe("/zbuduj-set?wejscie=guide");
  });
});

describe("GuideCard (F-220)", () => {
  it("pokazuje tytul jako odnosnik, lead, czas czytania i profil", () => {
    render(
      <GuideCard
        slug="rozmiary-klawiatur"
        title="Rozmiary klawiatur"
        lead="Od 60% do 100%."
        minutes={4}
        profileLabel="Gry (inne)"
      />,
    );
    expect(screen.getByRole("heading", { level: 2 })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Rozmiary klawiatur" })).toHaveAttribute(
      "href",
      "/poradnik/rozmiary-klawiatur",
    );
    expect(screen.getByText("4 min czytania")).toBeInTheDocument();
    expect(screen.getByText("Profil: Gry (inne)")).toBeInTheDocument();
  });
  it("na stronie glownej moze miec naglowek h3", () => {
    render(<GuideCard slug="a" title="A" lead={null} headingLevel={3} />);
    expect(screen.getByRole("heading", { level: 3 })).toBeInTheDocument();
  });
});

describe("GuideArticle (F-220)", () => {
  it("ma H1, spis tresci z odnosnikami do H2 i CTA z profilem na koncu", async () => {
    const { container } = render(
      <GuideArticle
        slug="jak-wybrac-przelaczniki"
        title="Jak wybrać przełączniki"
        lead="Lead."
        body={BODY}
        profile="programowanie"
        profileLabel="Programowanie"
      />,
    );
    expect(screen.getByRole("heading", { level: 1, name: /Jak wybrać/ })).toBeInTheDocument();
    const toc = screen.getByRole("navigation", { name: "Spis treści" });
    expect(within(toc).getByRole("link", { name: "Łupek i Próg" })).toHaveAttribute(
      "href",
      "#lupek-i-prog",
    );
    expect(document.getElementById("lupek-i-prog")).not.toBeNull();
    const cta = screen.getByRole("link", { name: "Otwórz kreator z profilem „Programowanie”" });
    expect(cta).toHaveAttribute("href", "/zbuduj-set?profil=programowanie&wejscie=guide");
    expect(await axe(container)).toHaveNoViolations();
  });
});

describe("Article JSON-LD (F-220)", () => {
  it("wydawca to Taktyl, bez autora i bez aggregateRating", () => {
    const ld = articleJsonLd({
      slug: "x",
      title: "T",
      lead: "L",
      publishedAt: "2026-10-07T10:00:00+02:00",
    });
    expect(ld["@type"]).toBe("Article");
    expect(ld.publisher).toEqual({ "@type": "Organization", name: "Taktyl" });
    expect(JSON.stringify(ld)).not.toMatch(/author|aggregateRating|review/);
  });
});

describe("okladka artykulu i hero (docs/09 §7)", () => {
  it("okladka tylko dla znanych sluga, dekoracyjna, z wersja @2x", async () => {
    const { GuideCover } = await import("../src/components/guides/guide-cover");
    const known = render(<GuideCover slug="rozmiary-klawiatur" />);
    const img = known.container.querySelector("img");
    expect(img?.getAttribute("alt")).toBe("");
    expect(img?.getAttribute("srcset")).toContain("/img/poradnik/rozmiary-klawiatur@2x.webp 2400w");
    const unknown = render(<GuideCover slug="nie-ma" />);
    expect(unknown.container.querySelector("img")).toBeNull();
  });

  it("hero ma jeden H1 i zdjecie z alt pustym oraz zrodlem desktop", async () => {
    const { PageHero } = await import("../src/components/page-hero");
    const { container } = render(<PageHero slug="myszki" title="Myszki" />);
    expect(container.querySelectorAll("h1")).toHaveLength(1);
    expect(container.querySelector("img")?.getAttribute("alt")).toBe("");
    expect(container.querySelector("source")?.getAttribute("srcset")).toContain(
      "/img/hero/myszki-desktop-2400.webp 2400w",
    );
  });
});
