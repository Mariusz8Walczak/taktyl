// F-007 (TAKTYL-58): strona wynikow /szukaj - karty z /v1/search, licznik z odmiana, brak wynikow (komunikat + 3 produkty),
// zdarzenia view_item_list / select_item z TrackedGrid.
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { axe } from "vitest-axe";

const getSearch = vi.fn();
const getListing = vi.fn();
vi.mock("../src/lib/api", () => ({
  ApiError: class ApiError extends Error {
    status: number | null;
    constructor(message: string, status: number | null = null) {
      super(message);
      this.status = status;
    }
  },
  getSearch: (...a: unknown[]) => getSearch(...a),
  getListing: (...a: unknown[]) => getListing(...a),
}));
// Karty to osobny, async komponent serwerowy (testowany w listingu): tu tylko <li> z data-track-item.
vi.mock("../src/components/listing/cards", () => ({
  Cards: ({ cards }: { cards: { slug: string; name: string }[] }): ReactNode =>
    cards.map((c, i) => (
      <li
        key={c.slug}
        data-track-item={JSON.stringify({ item_id: `SKU-${i}`, item_name: c.name, price: 100 })}
      >
        <a href={`/klawiatury/${c.slug}`}>{c.name}</a>
      </li>
    )),
}));

import SearchResultsPage from "../src/app/szukaj/page";

const card = (slug: string, name: string) => ({ slug, name, category: "klawiatury" });
async function renderPage(q?: string) {
  const ui = await SearchResultsPage({
    searchParams: Promise.resolve(q === undefined ? {} : { q }),
  });
  return render(ui);
}

beforeEach(() => {
  window.dataLayer = [];
  getSearch.mockReset();
  getListing.mockReset();
  getListing.mockImplementation(async ({ category }: { category: string }) => ({
    items: [card(`polecany-${category}`, `Polecany ${category}`)],
  }));
});

describe("Strona wynikow /szukaj (F-007)", () => {
  it("wyniki: karty produktow i licznik z odmiana (PluralRules)", async () => {
    getSearch.mockResolvedValue({
      products: [card("lupek-65", "Łupek 65"), card("granit-tkl", "Granit TKL")],
      categories: [],
      guides: [],
    });
    const { container } = await renderPage("lupek");
    expect(getSearch).toHaveBeenCalledWith("lupek", 20);
    expect(
      screen.getByRole("heading", { level: 1, name: "Wyniki wyszukiwania" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("2 wyniki dla „lupek”");
    expect(screen.getByRole("link", { name: "Łupek 65" })).toBeInTheDocument();
    expect(getListing).not.toHaveBeenCalled();
    expect(await axe(container)).toHaveNoViolations();
  });

  it("jeden wynik: forma pojedyncza", async () => {
    getSearch.mockResolvedValue({ products: [card("a", "A")], categories: [], guides: [] });
    await renderPage("a");
    expect(screen.getByRole("status")).toHaveTextContent("1 wynik dla „a”");
  });

  it("brak wynikow: komunikat i 3 najpopularniejsze produkty (Polecane)", async () => {
    getSearch.mockResolvedValue({ products: [], categories: [], guides: [] });
    const { container } = await renderPage("xyz");
    expect(screen.getByText("Brak wyników dla „xyz”")).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 2, name: "Polecane" })).toBeInTheDocument();
    expect(container.querySelectorAll("[data-track-item]")).toHaveLength(3);
    expect(await axe(container)).toHaveNoViolations();
  });

  it("bez frazy: zacheta do wpisania i formularz, bez wolania API", async () => {
    await renderPage();
    expect(getSearch).not.toHaveBeenCalled();
    expect(screen.getByRole("search")).toBeInTheDocument();
    expect(screen.getByLabelText("Czego szukasz?")).toBeInTheDocument();
  });

  it("view_item_list z lista 'szukaj' i select_item po kliknieciu karty", async () => {
    // jsdom nie ma IntersectionObserver: TrackedGrid wysyla view_item_list od razu
    getSearch.mockResolvedValue({
      products: [card("lupek-65", "Łupek 65")],
      categories: [],
      guides: [],
    });
    await renderPage("lupek");
    const list = (window.dataLayer ?? []).find((e) => e.event === "view_item_list") as {
      ecommerce: { item_list_id: string; items: { index: number }[] };
    };
    expect(list.ecommerce.item_list_id).toBe("szukaj");
    expect(list.ecommerce.items[0]?.index).toBe(0);
    const user = userEvent.setup();
    const link = screen.getByRole("link", { name: "Łupek 65" });
    link.addEventListener("click", (e) => e.preventDefault());
    await user.click(link);
    expect((window.dataLayer ?? []).some((e) => e.event === "select_item")).toBe(true);
  });
});
