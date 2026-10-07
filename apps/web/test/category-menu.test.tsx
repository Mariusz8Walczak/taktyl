// F-003 (TAKTYL-59): menu rozwijane kategorii ze skrotami filtrow. Adresy sa czytane parserem listingu na wartosciach
// z data/facets.json: kazdy skrot ma dac USTAWIONY filtr w adresie (kryterium F-003).
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { axe } from "vitest-axe";
import { CategoryMenuItem } from "../src/components/layout/category-menu";
import { Header } from "../src/components/layout/header";
import { facetDefs, parseQuery, type Facet } from "../src/lib/catalog/listing-query";
import { CATEGORY_SHORTCUTS } from "../src/lib/category-shortcuts";
import { NAV_MAIN } from "../src/lib/nav";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
const facets = JSON.parse(readFileSync(join(root, "data/facets.json"), "utf8")) as Record<
  string,
  Facet[]
>;

describe("skroty filtrow (F-003)", () => {
  const all = Object.entries(CATEGORY_SHORTCUTS).flatMap(([cat, items]) =>
    items.map((s) => ({ cat: cat.slice(1), ...s })),
  );

  it("zawiera dokladnie skroty z docs/02: 60-65%, Bezprzewodowe, Ciche, Do 60 g, Maty na biurko", () => {
    expect(all.map((s) => s.label)).toEqual([
      "60–65%",
      "Bezprzewodowe",
      "Ciche",
      "Do 60 g",
      "Maty na biurko",
    ]);
  });

  it.each(all.map((s) => [s.label, s] as const))(
    "%s: adres ustawia filtr z facets.json",
    (_l, s) => {
      const [path, search = ""] = s.href.split("?");
      expect(path).toBe(`/${s.cat}`);
      const defs = facetDefs((facets[s.cat] ?? []).map(withValues));
      const q = parseQuery(Object.fromEntries(new URLSearchParams(search)), defs, s.cat);
      const set = Object.entries(q.filters).filter(([, v]) => v !== undefined && v !== false);
      expect(set).toHaveLength(1);
      const [id, value] = set[0] as [string, string[]];
      const facet = (facets[s.cat] ?? []).find((f) => f.id === id) as unknown as {
        values: { v: string }[];
      };
      for (const v of value) expect(facet.values.map((x) => x.v)).toContain(v);
    },
  );
});

/** facets.json ma ksztalt zrodlowy; parser listingu potrzebuje pol z odpowiedzi API (dla multi/buckets: values). */
function withValues(f: Facet): Facet {
  return "values" in f ? f : ({ ...f, values: [] } as unknown as Facet);
}

describe("CategoryMenuItem", () => {
  it("odnosnik kategorii + lista skrotow z nazwa dostepna", () => {
    render(
      <CategoryMenuItem item={NAV_MAIN[0]!} shortcuts={CATEGORY_SHORTCUTS["/klawiatury"] ?? []} />,
    );
    expect(screen.getByRole("link", { name: "Klawiatury" })).toHaveAttribute("href", "/klawiatury");
    const list = screen.getByRole("list", { name: "Skróty: Klawiatury", hidden: true });
    const hrefs = within(list)
      .getAllByRole("link", { hidden: true })
      .map((a) => a.getAttribute("href"));
    expect(hrefs).toEqual([
      "/klawiatury?rozmiar=60,65",
      "/klawiatury?lacznosc=2.4ghz,bt",
      "/klawiatury?przelacznik=cichy",
    ]);
  });

  it("naglowek: Klawiatury, Myszki i Podkladki maja panel skrotow, Zbuduj set i Poradnik nie", () => {
    const { container } = render(<Header />);
    const panels = container.querySelectorAll(".menu-kat__panel");
    expect(panels).toHaveLength(3);
    for (const label of ["Zbuduj set", "Poradnik"]) {
      expect(screen.getByRole("link", { name: label }).closest(".menu-kat__pozycja")).toBeNull();
    }
  });

  it("axe: naglowek z menu bez naruszen", async () => {
    const { container } = render(<Header />);
    expect(await axe(container)).toHaveNoViolations();
  });
});
