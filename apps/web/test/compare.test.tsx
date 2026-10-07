// F-130, F-131, F-045 (TAKTYL-55): porownywarka - limit 4, inna kategoria (komunikat + wyczyszczenie), roznice,
// usuwanie, pasek "Porownaj (n)", tabela z przyklejona kolumna nazw, zdarzenie compare_add, wyjatek localStorage.
import { ToastProvider } from "@taktyl/ui";
import { act, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { axe } from "vitest-axe";
import { CompareBar } from "../src/components/compare/compare-bar";
import { CompareButton } from "../src/components/compare/compare-button";
import { ComparePage } from "../src/components/compare/compare-page";
import { buildCompareRows } from "../src/lib/compare/diff";
import { toLiteProduct, type LiteProduct } from "../src/lib/compare/lite";
import { COMPARE_KEY, compare } from "../src/lib/compare/store";
import { COLORS, productFixture, SWITCHES } from "./catalog-fixtures";

const lite = (slug: string): LiteProduct => toLiteProduct(productFixture(slug), COLORS, SWITCHES);
const CATALOG = [
  lite("bazalt-75"),
  lite("kwarc-60"),
  lite("granit-tkl"),
  lite("wrobel"),
  lite("lupek-65"),
];
const KEYBOARDS = CATALOG.filter((p) => p.category === "klawiatury");
const events = (name: string) => (window.dataLayer ?? []).filter((e) => e.event === name);

beforeEach(() => {
  window.dataLayer = [];
  document.documentElement.className = "";
});

describe("magazyn porownania (F-130)", () => {
  it("dodaje do 4 produktow jednej kategorii, piaty to 'full'", () => {
    expect(compare.add("a-1", "klawiatury")).toEqual({ status: "added", count: 1 });
    compare.add("a-2", "klawiatury");
    compare.add("a-3", "klawiatury");
    expect(compare.add("a-4", "klawiatury")).toEqual({ status: "added", count: 4 });
    expect(compare.add("a-5", "klawiatury")).toEqual({ status: "full" });
    expect(compare.add("a-4", "klawiatury")).toEqual({ status: "exists" });
    expect(compare.state().ids).toEqual(["a-1", "a-2", "a-3", "a-4"]);
  });

  it("inna kategoria nie wchodzi; replaceWith zastepuje porownanie", () => {
    compare.add("a-1", "klawiatury");
    expect(compare.add("m-1", "myszki")).toEqual({
      status: "other_category",
      current: "klawiatury",
    });
    expect(compare.state().ids).toEqual(["a-1"]);
    compare.replaceWith("m-1", "myszki");
    expect(compare.state()).toMatchObject({ category: "myszki", ids: ["m-1"] });
  });

  it("usuniecie ostatniego czysci kategorie; zapis w taktyl.compare.v1", () => {
    compare.add("a-1", "klawiatury");
    expect(JSON.parse(window.localStorage.getItem(COMPARE_KEY) ?? "null")).toMatchObject({
      category: "klawiatury",
      ids: ["a-1"],
    });
    compare.remove("a-1");
    expect(compare.state()).toMatchObject({ category: null, ids: [] });
  });

  it("uszkodzony zapis daje pusty stan, a wyjatek localStorage dziala z pamiecia", () => {
    window.localStorage.setItem(COMPARE_KEY, "{nie json");
    expect(compare.state().ids).toEqual([]);
    window.localStorage.removeItem(COMPARE_KEY);
    const spy = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("QuotaExceededError");
    });
    expect(compare.add("a-1", "klawiatury")).toEqual({ status: "added", count: 1 });
    expect(compare.state().ids).toEqual(["a-1"]);
    spy.mockRestore();
  });
});

describe("wiersze tabeli (F-131)", () => {
  it("etykiety z docs/04 §4, rozmiar po polsku i roznice", () => {
    const rows = buildCompareRows([lite("bazalt-75"), lite("kwarc-60")]);
    const byLabel = Object.fromEntries(rows.map((r) => [r.label, r]));
    expect(byLabel["Rozmiar"]?.values).toEqual(["75%", "60%"]);
    expect(byLabel["Rozmiar"]?.differs).toBe(true);
    expect(byLabel["Wymiana przełączników bez lutowania"]?.differs).toBe(false);
    expect(byLabel["Przełączniki"]).toBeDefined();
  });
});

describe("CompareButton (F-045, F-130)", () => {
  function renderButtons() {
    return render(
      <ToastProvider>
        <CompareButton id="k-bazalt-75" category="klawiatury" name="Bazalt 75" />
        <CompareButton id="m-wrobel" category="myszki" name="Wróbel" />
      </ToastProvider>,
    );
  }

  it("aria-pressed, etykieta tekstowa i zdarzenie compare_add", async () => {
    const user = userEvent.setup();
    renderButtons();
    const btn = screen.getByRole("button", { name: /Porównaj: Bazalt 75/ });
    expect(btn).toHaveAttribute("aria-pressed", "false");
    await user.click(btn);
    expect(screen.getByRole("button", { name: /Usuń z porównania: Bazalt 75/ })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(events("compare_add")).toEqual([
      { event: "compare_add", item_id: "k-bazalt-75", compare_count: 1 },
    ]);
  });

  it("inna kategoria: komunikat z propozycja wyczyszczenia, bez zdarzenia dopoki nie zgodzi sie uzytkownik", async () => {
    const user = userEvent.setup();
    renderButtons();
    await user.click(screen.getByRole("button", { name: /Porównaj: Bazalt 75/ }));
    await user.click(screen.getByRole("button", { name: /Porównaj: Wróbel/ }));
    expect(screen.getByText(/W porównaniu są klawiatury/)).toBeInTheDocument();
    expect(compare.state().ids).toEqual(["k-bazalt-75"]);
    expect(events("compare_add")).toHaveLength(1);
    await user.click(screen.getByRole("button", { name: "Wyczyść i dodaj" }));
    expect(compare.state()).toMatchObject({ category: "myszki", ids: ["m-wrobel"] });
    expect(events("compare_add")).toHaveLength(2);
  });

  it("piaty produkt: komunikat o limicie", async () => {
    const user = userEvent.setup();
    for (const id of ["a-1", "a-2", "a-3", "a-4"]) compare.add(id, "klawiatury");
    render(
      <ToastProvider>
        <CompareButton id="a-5" category="klawiatury" name="Piąty" />
      </ToastProvider>,
    );
    await user.click(screen.getByRole("button", { name: /Porównaj: Piąty/ }));
    expect(screen.getByText(/maksymalnie 4 produkty/)).toBeInTheDocument();
    expect(compare.state().ids).toHaveLength(4);
  });
});

describe("CompareBar (F-130)", () => {
  it("pojawia sie od 1 produktu jako 'Porównaj (n)' i rezerwuje miejsce na dole", async () => {
    render(<CompareBar />);
    expect(screen.queryByRole("region", { name: "Porównanie produktów" })).toBeNull();
    act(() => void compare.add("a-1", "klawiatury"));
    act(() => void compare.add("a-2", "klawiatury"));
    const link = await screen.findByRole("link", { name: "Porównaj (2)" });
    expect(link).toHaveAttribute("href", "/porownaj");
    expect(document.documentElement).toHaveClass("ma-pasek-porownaj");
    await userEvent.setup().click(screen.getByRole("button", { name: "Wyczyść" }));
    expect(document.documentElement).not.toHaveClass("ma-pasek-porownaj");
  });

  it("na /porownaj pasek jest ukryty", () => {
    (globalThis as { __pathname?: string }).__pathname = "/porownaj";
    compare.add("a-1", "klawiatury");
    render(<CompareBar />);
    expect(screen.queryByRole("link", { name: /Porównaj \(1\)/ })).toBeNull();
  });
});

describe("ComparePage (F-131)", () => {
  it("pusty stan z zaproszeniem", async () => {
    render(<ComparePage catalog={CATALOG} />);
    expect(await screen.findByText(/Nie masz jeszcze nic w porównaniu/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Zobacz klawiatury" })).toHaveAttribute(
      "href",
      "/klawiatury",
    );
  });

  it("tabela: th w wierszach i kolumnach, nazwa, cena, atrybuty; bez bledow axe", async () => {
    const [a, b] = KEYBOARDS as [LiteProduct, LiteProduct];
    compare.add(a.id, a.category);
    compare.add(b.id, b.category);
    const { container } = render(<ComparePage catalog={CATALOG} />);
    const table = await screen.findByRole("table");
    expect(within(table).getAllByRole("columnheader")).toHaveLength(3);
    expect(within(table).getByRole("rowheader", { name: "Rozmiar" })).toBeInTheDocument();
    expect(within(table).getByRole("link", { name: a.name })).toHaveAttribute("href", a.href);
    expect(within(table).getAllByText(/^od \d/)).toHaveLength(2);
    expect(container.querySelector('th[scope="row"]')).not.toBeNull();
    expect(await axe(container)).toHaveNoViolations();
  });

  it("'Pokaż tylko różnice' chowa wiersze o identycznych wartosciach", async () => {
    const user = userEvent.setup();
    const [a, b] = KEYBOARDS as [LiteProduct, LiteProduct];
    compare.add(a.id, a.category);
    compare.add(b.id, b.category);
    render(<ComparePage catalog={CATALOG} />);
    const hotswap = await screen.findByRole("rowheader", {
      name: "Wymiana przełączników bez lutowania",
    });
    expect(hotswap).toBeInTheDocument();
    await user.click(screen.getByRole("checkbox", { name: "Pokaż tylko różnice" }));
    expect(
      screen.queryByRole("rowheader", { name: "Wymiana przełączników bez lutowania" }),
    ).toBeNull();
    expect(screen.getByRole("rowheader", { name: "Rozmiar" })).toBeInTheDocument();
  });

  it("usuwanie produktu z tabeli i 'Wyczyść'", async () => {
    const user = userEvent.setup();
    const [a, b] = KEYBOARDS as [LiteProduct, LiteProduct];
    compare.add(a.id, a.category);
    compare.add(b.id, b.category);
    render(<ComparePage catalog={CATALOG} />);
    await screen.findByRole("table");
    await user.click(
      screen.getByRole("button", { name: new RegExp(`Usuń z porównania: ${a.name}`) }),
    );
    expect(compare.state().ids).toEqual([b.id]);
    expect(screen.getByText(/Dodaj kolejny produkt/)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Wyczyść" }));
    expect(await screen.findByText(/Nie masz jeszcze nic w porównaniu/)).toBeInTheDocument();
    expect(compare.state().ids).toEqual([]);
  });

  it("zdarzenie storage z innej karty odswieza tabele", async () => {
    render(<ComparePage catalog={CATALOG} />);
    await screen.findByText(/Nie masz jeszcze nic w porównaniu/);
    const [a] = KEYBOARDS as [LiteProduct];
    act(() => {
      window.localStorage.setItem(
        COMPARE_KEY,
        JSON.stringify({ v: 1, category: a.category, ids: [a.id] }),
      );
      window.dispatchEvent(new StorageEvent("storage", { key: COMPARE_KEY }));
    });
    expect(await screen.findByRole("table")).toBeInTheDocument();
  });
});
