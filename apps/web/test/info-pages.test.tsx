// F-221, F-247 (TAKTYL-32): strony informacyjne i prawne - baner demo z danych strony, jeden H1, okruszki, aktualnosc
// przez Intl (Europe/Warsaw), spis tresci z kotwicami przy dluzszych, sanityzacja XSS w renderze, 404 dla brakujacej
// strony. Tresci z content/pages/*.md (zrodlo seedu), bez recznie przepisanych tekstow.
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { axe } from "vitest-axe";

const getContentPage = vi.fn();
vi.mock("../src/lib/api", () => ({ getContentPage: (...a: unknown[]) => getContentPage(...a) }));
vi.mock("next/navigation", () => ({
  usePathname: () => "/",
  useRouter: () => ({ push: () => {}, replace: () => {}, back: () => {}, prefetch: () => {} }),
  notFound: () => {
    throw new Error("NEXT_HTTP_ERROR_FALLBACK;404");
  },
}));

import { InfoPage, infoMetadata } from "../src/components/informacyjne/info-page";
import { parseMarkdown } from "../src/lib/content/markdown";
import {
  DEMO_NOTICE,
  INFO_PAGES,
  formatUpdated,
  infoToc,
  pageDescription,
  stripDemoNotice,
} from "../src/lib/informacyjne/view";

const norm = (t: string | null | undefined) => (t ?? "").replace(/\u00A0/g, " ");
const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");

/** Strona w ksztalcie odpowiedzi API, ze zrodla seedu (frontmatter -> pola). */
function pageFromSeed(slug: string) {
  const src = readFileSync(join(root, "content", "pages", `${slug}.md`), "utf8").replace(
    /\r\n/g,
    "\n",
  );
  const m = /^---\n([\s\S]*?)\n---\n([\s\S]*)$/.exec(src)!;
  const fm = Object.fromEntries(
    (m[1] as string)
      .split("\n")
      .map((l) => [l.slice(0, l.indexOf(":")), l.slice(l.indexOf(":") + 1).trim()]),
  ) as Record<string, string>;
  return {
    slug,
    type: "page" as const,
    title: fm.title as string,
    lead: null,
    body_md: (m[2] as string).trim(),
    demo_notice: fm.demo === "true",
    guide_profile: null,
    published_at: `${fm.updated}T00:00:00.000Z`,
  };
}

beforeEach(() => {
  getContentPage.mockReset();
  getContentPage.mockImplementation(async (slug: string) => pageFromSeed(slug));
});

async function renderInfo(slug: (typeof INFO_PAGES)[number]) {
  const ui = await InfoPage({ slug });
  return render(ui);
}

describe("strony informacyjne (F-221)", () => {
  it.each(INFO_PAGES)("%s: jeden H1 z tytulu, okruszki i baner demo", async (slug) => {
    await renderInfo(slug);
    const page = pageFromSeed(slug);
    const h1 = screen.getAllByRole("heading", { level: 1 });
    expect(h1).toHaveLength(1);
    expect(norm(h1[0]?.textContent)).toBe(norm(page.title));
    expect(screen.getByRole("navigation", { name: "Okruszki" })).toBeInTheDocument();
    expect(screen.getByText(DEMO_NOTICE)).toBeInTheDocument();
  });

  it("baner jest raz: cytat z tresci zrodlowej nie dubluje go (docs/05 §8)", async () => {
    const { container } = await renderInfo("regulamin");
    expect(container.textContent?.split(DEMO_NOTICE).length).toBe(2);
    expect(screen.getAllByRole("note")).toHaveLength(1);
  });

  it("baner wynika z danych strony: bez demo_notice nie ma banera", async () => {
    getContentPage.mockResolvedValue({ ...pageFromSeed("cookies"), demo_notice: false });
    await renderInfo("cookies");
    expect(screen.queryByRole("note")).toBeNull();
  });

  it("aktualnosc: 'Zaktualizowano: data' w polskim formacie, strefa Europe/Warsaw", async () => {
    await renderInfo("regulamin");
    const p = screen.getByText(/Zaktualizowano:/);
    expect(p).toHaveTextContent("Zaktualizowano: 7 października 2026");
    expect(p.querySelector("time")).toHaveAttribute("datetime", "2026-10-07T00:00:00.000Z");
    // 23:30 UTC to juz nastepny dzien w Warszawie
    expect(formatUpdated("2026-10-07T23:30:00.000Z")).toBe("8 października 2026");
  });

  it("regulamin ma spis tresci z kotwicami wskazujacymi istniejace naglowki", async () => {
    const { container } = await renderInfo("regulamin");
    const nav = screen.getByRole("navigation", { name: "Spis treści" });
    const links = within(nav).getAllByRole("link");
    expect(links).toHaveLength(9);
    for (const a of links) {
      const id = (a.getAttribute("href") ?? "").slice(1);
      const target = container.querySelector(`[id="${id}"]`);
      expect(target?.tagName).toBe("H2");
      expect(norm(target?.textContent)).toBe(norm(a.textContent));
    }
    expect(links[0]).toHaveAttribute("href", "#1-postanowienia-ogolne");
  });

  it("krotkie strony (zuzyty-sprzet) nie maja spisu tresci", async () => {
    await renderInfo("zuzyty-sprzet");
    expect(screen.queryByRole("navigation", { name: "Spis treści" })).toBeNull();
  });

  it("tabela z tresci (dostawa) ma naglowki kolumn, a tresc nie zawiera ODR ani obcych domen", async () => {
    const { container } = await renderInfo("dostawa-i-platnosci");
    expect(screen.getAllByRole("columnheader").length).toBeGreaterThanOrEqual(3);
    expect(container.textContent).not.toMatch(/\bODR\b|ec\.europa\.eu/);
    for (const a of container.querySelectorAll("a[href]")) {
      expect(a.getAttribute("href")).toMatch(/^(\/|#|mailto:[^@]+@taktyl\.example$)/);
    }
  });

  it("brakujaca strona z API to notFound (404)", async () => {
    getContentPage.mockResolvedValue(null);
    await expect(InfoPage({ slug: "regulamin" })).rejects.toThrow("NEXT_HTTP_ERROR_FALLBACK;404");
    await expect(infoMetadata("regulamin")).rejects.toThrow("NEXT_HTTP_ERROR_FALLBACK;404");
  });

  it("generateMetadata: tytul, opis z pierwszego akapitu, noindex", async () => {
    const meta = await infoMetadata("o-sklepie");
    expect(norm(String(meta.title))).toBe("O sklepie");
    expect(String(meta.description).length).toBeGreaterThan(20);
    expect(String(meta.description).length).toBeLessThanOrEqual(161);
    expect(meta.robots).toEqual({ index: false, follow: false });
  });

  it("tagi cache: strona pobierana po slugu (znacznik content:{slug} ustawia klient API)", async () => {
    await renderInfo("polityka-prywatnosci");
    expect(getContentPage).toHaveBeenCalledWith("polityka-prywatnosci");
  });
});

describe("sanityzacja w renderze (XSS)", () => {
  const hostile = [
    'Wstęp <script>window.hacked = 1</script> i <img src=x onerror="window.hacked = 2"> oraz <b onclick="x()">tekst</b>.',
    "",
    "[zly](javascript:alert(1)) [obcy](https://evil.example.com/x) [dobry](/zbuduj-set) [poczta](mailto:ktos@taktyl.example)",
    "",
    "![obraz](https://evil.example.com/p.png)",
    "",
    "## Sekcja <i>z</i> znacznikiem",
    "",
    '- pozycja <iframe src="https://evil.example.com"></iframe>',
  ].join("\n");

  it("surowy HTML jest tylko tekstem; zadnych script, img, iframe ani atrybutow zdarzen", async () => {
    getContentPage.mockResolvedValue({ ...pageFromSeed("cookies"), body_md: hostile });
    const { container } = await renderInfo("cookies");
    expect(container.querySelector("article script, iframe, style, object, embed")).toBeNull();
    expect(container.querySelector("img")).toBeNull();
    for (const el of container.querySelectorAll("*")) {
      for (const attr of el.getAttributeNames()) expect(attr).not.toMatch(/^on/i);
    }
    expect((window as unknown as { hacked?: number }).hacked).toBeUndefined();
    expect(container.textContent).toContain("<script>window.hacked = 1</script>");
  });

  it("odnosniki: tylko z allowlisty (wzgledne, kotwice, taktyl.example), reszta to sam tekst", async () => {
    getContentPage.mockResolvedValue({ ...pageFromSeed("cookies"), body_md: hostile });
    const { container } = await renderInfo("cookies");
    const hrefs = [...container.querySelectorAll("article a[href]")].map((a) =>
      a.getAttribute("href"),
    );
    expect(hrefs).toContain("/zbuduj-set");
    expect(hrefs).toContain("mailto:ktos@taktyl.example");
    expect(hrefs.some((h) => /javascript:|evil/.test(h ?? ""))).toBe(false);
    expect(screen.getByText(/zly/)).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "zly" })).toBeNull();
    expect(screen.queryByRole("link", { name: "obcy" })).toBeNull();
  });
});

describe("widok pomocniczy", () => {
  it("stripDemoNotice usuwa tylko pierwszy cytat rowny banerowi", () => {
    const blocks = parseMarkdown(`> ${DEMO_NOTICE}\n\nAkapit.\n\n> Inny cytat.`);
    const out = stripDemoNotice(blocks, true);
    expect(out.map((b) => b.kind)).toEqual(["p", "quote"]);
    expect(stripDemoNotice(blocks, false)).toHaveLength(3);
  });

  it("spis tresci od 6 sekcji H2", () => {
    const md = (n: number) =>
      Array.from({ length: n }, (_, i) => `## Sekcja ${i + 1}\n\ntekst`).join("\n\n");
    expect(infoToc(parseMarkdown(md(5)))).toHaveLength(0);
    expect(infoToc(parseMarkdown(md(6)))).toHaveLength(6);
  });

  it("opis meta ze lead, bez znacznikow Markdown, do 160 znakow", () => {
    expect(pageDescription("Krótki **lead**.", [])).toBe("Krótki lead.");
    expect(
      pageDescription(null, parseMarkdown(`${"słowo ".repeat(60)}`)).length,
    ).toBeLessThanOrEqual(161);
  });
});

describe("dostepnosc (axe)", () => {
  it.each(["regulamin", "dostawa-i-platnosci", "cookies"] as const)(
    "%s bez naruszen",
    async (slug) => {
      const ui = await InfoPage({ slug });
      const { container } = render(<main>{ui}</main>);
      expect(await axe(container)).toHaveNoViolations();
    },
  );
});
