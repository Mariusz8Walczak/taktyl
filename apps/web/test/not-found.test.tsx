// F-221 (TAKTYL-32, docs/12 S23): strona 404 - komunikat, wyszukiwarka (formularz GET), trzy kategorie, noindex,
// dzialanie przy niedostepnym API. Kod odpowiedzi 404 sprawdza scenariusz S23 na uruchomionym stosie.
import { render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { axe } from "vitest-axe";

const getCategories = vi.fn();
vi.mock("../src/lib/api", () => ({ getCategories: () => getCategories() }));

import NotFound, { metadata } from "../src/app/not-found";

const CATEGORIES = [
  { id: "klawiatury", slug: "klawiatury", name: "Klawiatury", position: 1 },
  { id: "myszki", slug: "myszki", name: "Myszki", position: 2 },
  { id: "podkladki", slug: "podkladki", name: "Podkładki", position: 3 },
];

beforeEach(() => {
  getCategories.mockReset();
  getCategories.mockResolvedValue(CATEGORIES);
});

describe("404 (S23)", () => {
  it("H1, wyszukiwarka GET do /szukaj z polem q i trzy kategorie", async () => {
    render(await NotFound());
    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
    expect(
      screen.getByRole("heading", { level: 1, name: "Nie ma takiej strony" }),
    ).toBeInTheDocument();
    const search = screen.getByRole("search");
    expect(search).toHaveAttribute("action", "/szukaj");
    expect(search).toHaveAttribute("method", "get");
    const input = within(search).getByLabelText("Czego szukasz?");
    expect(input).toHaveAttribute("name", "q");
    expect(within(search).getByRole("button", { name: "Szukaj" })).toBeInTheDocument();
    const list = screen.getByRole("heading", { level: 2, name: "Kategorie" }).nextElementSibling!;
    expect(
      within(list as HTMLElement)
        .getAllByRole("link")
        .map((a) => a.getAttribute("href")),
    ).toEqual(["/klawiatury", "/myszki", "/podkladki"]);
  });

  it("noindex w meta", () => {
    expect(metadata.robots).toEqual({ index: false, follow: false });
    expect(metadata.title).toBe("Nie ma takiej strony");
  });

  it("gdy API nie odpowiada, 404 nadal pokazuje trzy kategorie z nawigacji", async () => {
    getCategories.mockRejectedValue(new Error("API niedostepne"));
    render(await NotFound());
    const list = screen.getByRole("heading", { level: 2, name: "Kategorie" }).nextElementSibling!;
    expect(within(list as HTMLElement).getAllByRole("link")).toHaveLength(3);
  });

  it("bez naruszen dostepnosci", async () => {
    const { container } = render(<main>{await NotFound()}</main>);
    expect(await axe(container)).toHaveNoViolations();
  });
});
