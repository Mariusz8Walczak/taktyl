// F-002: naglowek (nawigacja, akcje, licznik koszyka).
import { act, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { axe } from "vitest-axe";
import { Header } from "../src/components/layout/header";
import { CART_CHANGED_EVENT, CART_STORAGE_KEY, parseCartCount } from "../src/lib/cart/count";

const setCart = (value: unknown) =>
  window.localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(value));

describe("Header (F-002)", () => {
  it("ma landmark banner, wordmark jako link do / i nawigacje z adresami z docs/05", () => {
    render(<Header />);
    expect(screen.getByRole("banner")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Taktyl, strona główna" })).toHaveAttribute(
      "href",
      "/",
    );
    const nav = screen.getByRole("navigation", { name: "Główna" });
    // skroty filtrow (F-003) sa w panelach menu kategorii; tu sprawdzamy glowne pozycje
    const links = within(nav)
      .getAllByRole("link")
      .filter((l) => !l.closest(".menu-kat__panel"));
    expect(links.map((l) => [l.textContent, l.getAttribute("href")])).toEqual([
      ["Klawiatury", "/klawiatury"],
      ["Myszki", "/myszki"],
      ["Podkładki", "/podkladki"],
      ["Zbuduj set", "/zbuduj-set"],
      ["Poradnik", "/poradnik"],
    ]);
  });

  it("akcje maja widoczne etykiety tekstowe: szukaj, ulubione, porownaj, koszyk", () => {
    render(<Header />);
    for (const [name, href] of [
      ["Szukaj", "/szukaj"],
      ["Ulubione", "/ulubione"],
      ["Porównaj", "/porownaj"],
      ["Konto", "/konto"],
      ["Koszyk", "/koszyk"],
    ] as const) {
      expect(screen.getByRole("link", { name })).toHaveAttribute("href", href);
    }
    expect(screen.getByRole("button", { name: "Menu" })).toHaveAttribute("aria-expanded", "false");
  });

  it("oznacza biezaca strone aria-current", () => {
    (globalThis as { __pathname?: string }).__pathname = "/myszki";
    render(<Header />);
    const nav = screen.getByRole("navigation", { name: "Główna" });
    expect(within(nav).getByRole("link", { name: "Myszki" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(within(nav).getByRole("link", { name: "Klawiatury" })).not.toHaveAttribute(
      "aria-current",
    );
  });

  it("pusty koszyk: bez licznika", () => {
    render(<Header />);
    expect(screen.queryByTestId("licznik-koszyka")).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Koszyk" })).toBeInTheDocument();
  });

  it("licznik liczy sztuki, set = 1, i ma tekst dla czytnika z odmiana", () => {
    setCart({
      v: 1,
      lines: [
        { type: "item", sku: "K-BAZ-75-GRA-SLI", qty: 2 },
        { type: "set", id: "g1", qty: 1, skus: ["a", "b", "c"] },
      ],
    });
    render(<Header />);
    expect(screen.getByTestId("licznik-koszyka")).toHaveTextContent("3");
    expect(screen.getByRole("link", { name: /Koszyk\s*, 3 produkty/ })).toBeInTheDocument();
  });

  it("licznik reaguje na zmiane koszyka w tej samej karcie", () => {
    render(<Header />);
    act(() => {
      setCart([{ type: "item", sku: "x", qty: 5 }]);
      window.dispatchEvent(new Event(CART_CHANGED_EVENT));
    });
    expect(screen.getByTestId("licznik-koszyka")).toHaveTextContent("5");
    expect(screen.getByRole("link", { name: /Koszyk\s*, 5 produktów/ })).toBeInTheDocument();
  });

  it("wyjatek localStorage nie psuje naglowka (licznik 0)", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new DOMException("zablokowane", "SecurityError");
    });
    render(<Header />);
    expect(screen.getByRole("link", { name: "Koszyk" })).toBeInTheDocument();
    expect(screen.queryByTestId("licznik-koszyka")).not.toBeInTheDocument();
  });

  it("nie ma bledow axe", async () => {
    const { container } = render(<Header />);
    expect(await axe(container)).toHaveNoViolations();
  });
});

describe("parseCartCount", () => {
  it.each([
    [null, 0],
    ["", 0],
    ["nie json", 0],
    ["{}", 0],
    ['{"lines":"x"}', 0],
    ['[{"qty":2},{"qty":-1},{"qty":1.5},{"qty":"3"},null]', 2],
    ['{"items":[{"qty":1},{"qty":4}]}', 5],
  ])("%s -> %s", (raw, expected) => {
    expect(parseCartCount(raw)).toBe(expected);
  });
});
