// B-100, B-101, B-102, B-103, B-110 (TAKTYL-51): lista produktow (filtry w adresie, licznik z odmiana, stan pusty),
// tabela wariantow (okno edycji, viewer), edycja danych (blad pod polem, PATCH tylko zmienionych pol z If-Match).
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { axe } from "vitest-axe";
import { describe, expect, it } from "vitest";
import { ProductDataForm } from "../src/components/produkty/product-data-form";
import { ProductsList } from "../src/components/produkty/products-list";
import { VariantsTab } from "../src/components/produkty/variants-tab";
import { priceHistory, productRow, wrobel } from "./fixtures";
import { json, mockApi, nav, problem, renderWithProviders, session } from "./helpers";

const list = (items: unknown[], total = items.length) =>
  json({ items, page: 1, per_page: 25, total });

describe("B-100 lista produktow", () => {
  it("kolumny, licznik z odmiana, plakietki, status tekstem, sortowanie przyciskiem (aria-sort)", async () => {
    nav({ pathname: "/produkty", search: "" });
    mockApi({
      "GET /v1/admin/auth/me": json(session("editor")),
      "GET /v1/admin/products": list(
        [
          productRow(),
          productRow({
            id: "k-lupek-65",
            name: "Łupek 65",
            category: "klawiatury",
            on_sale: false,
            total_stock: 0,
            status: "archived",
          }),
        ],
        18,
      ),
    });
    const { container } = renderWithProviders(<ProductsList />);
    const table = await screen.findByRole("table", { name: "Lista produktów" });
    expect(screen.getByText("18 produktów")).toBeInTheDocument();
    expect(
      within(table)
        .getAllByRole("columnheader")
        .map((h) => h.textContent?.replace(/[↑↓]/, "")),
    ).toEqual([
      "Nazwa",
      "Kategoria",
      "Warianty",
      "Cena od",
      "Stan łącznie",
      "Plakietki",
      "Status",
      "Akcje",
    ]);
    expect(within(table).getByRole("link", { name: "Wróbel" })).toHaveAttribute(
      "href",
      "/produkty/m-wrobel",
    );
    expect(within(table).getAllByText("129,00 zł").length).toBeGreaterThan(0);
    expect(within(table).getByText("Ukryty")).toBeInTheDocument();
    expect(within(table).getByText("Promocja")).toBeInTheDocument();
    // domyslne sortowanie -updated_at nie oznacza zadnej z kolumn; klik ustawia sort w adresie
    await userEvent.setup().click(within(table).getByRole("button", { name: /Nazwa/ }));
    expect(nav().replace).toHaveBeenCalledWith("/produkty?sort=name", { scroll: false });
    expect(await axe(container)).toHaveNoViolations();
  });

  it("B-101: filtry z adresu trafiaja do zapytania; wyszukiwanie ustawia ?q= w adresie", async () => {
    nav({
      pathname: "/produkty",
      search: "category=myszki&status=active&promo=1&sort=-total_stock&page=2",
    });
    const calls = mockApi({
      "GET /v1/admin/auth/me": json(session("viewer")),
      "GET /v1/admin/products": list([productRow()], 1),
    });
    renderWithProviders(<ProductsList />);
    await screen.findByRole("table", { name: "Lista produktów" });
    const q = new URLSearchParams(
      calls.find((c) => c.url.startsWith("/v1/admin/products"))?.url.split("?")[1],
    );
    expect(Object.fromEntries(q)).toEqual({
      page: "2",
      per_page: "25",
      sort: "-total_stock",
      category: "myszki",
      status: "active",
      promo: "1",
    });
    expect(screen.getByText("1 produkt")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "W promocji" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );

    await userEvent.setup().type(screen.getByLabelText("Szukaj po nazwie lub SKU"), "lupek");
    await waitFor(
      () =>
        expect(nav().replace).toHaveBeenCalledWith(expect.stringContaining("q=lupek"), {
          scroll: false,
        }),
      { timeout: 2000 },
    );
  });

  it("brak wynikow: komunikat i 'Wyczysc filtry'", async () => {
    nav({ pathname: "/produkty", search: "q=zzz" });
    mockApi({ "GET /v1/admin/auth/me": json(session()), "GET /v1/admin/products": list([], 0) });
    renderWithProviders(<ProductsList />);
    expect(await screen.findByText("Nic tu nie pasuje do filtrów.")).toBeInTheDocument();
    await userEvent.setup().click(screen.getByRole("button", { name: "Wyczyść filtry" }));
    expect(nav().replace).toHaveBeenCalledWith("/produkty", { scroll: false });
  });

  it("blad pobierania: komunikat z docs/15 i 'Sprobuj ponownie'", async () => {
    nav({ pathname: "/produkty" });
    mockApi({
      "GET /v1/admin/auth/me": json(session()),
      "GET /v1/admin/products": problem(500, "internal_error"),
    });
    renderWithProviders(<ProductsList />);
    expect(await screen.findByText("Nie udało się pobrać produktów.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Spróbuj ponownie" })).toBeInTheDocument();
  });

  it("archiwizacja: PATCH status z If-Match i toast z 'Cofnij'; viewer ma przycisk nieaktywny", async () => {
    nav({ pathname: "/produkty", search: "" });
    const calls = mockApi({
      "GET /v1/admin/auth/me": json(session("editor")),
      "GET /v1/admin/products": list([productRow()]),
      "PATCH /v1/admin/products/m-wrobel": json(wrobel({ status: "archived", version: 6 }), {
        etag: 6,
      }),
    });
    renderWithProviders(<ProductsList />);
    await screen.findByRole("button", { name: "Archiwizuj" });
    await waitFor(() => expect(screen.getByRole("button", { name: "Archiwizuj" })).toBeEnabled());
    await userEvent.setup().click(screen.getByRole("button", { name: "Archiwizuj" }));
    const patch = await waitFor(() => {
      const c = calls.find((x) => x.method === "PATCH");
      if (!c) throw new Error("brak PATCH");
      return c;
    });
    expect(patch.body).toEqual({ status: "archived" });
    expect(patch.headers["If-Match"]).toBe('"5"');
    expect(await screen.findByRole("button", { name: "Cofnij" })).toBeInTheDocument();
  });

  it("viewer: Archiwizuj nieaktywny, brak przycisku Dodaj produkt", async () => {
    nav({ pathname: "/produkty" });
    mockApi({
      "GET /v1/admin/auth/me": json(session("viewer")),
      "GET /v1/admin/products": list([productRow()]),
    });
    renderWithProviders(<ProductsList />);
    expect(await screen.findByRole("button", { name: "Archiwizuj" })).toBeDisabled();
    expect(screen.queryByRole("link", { name: "Dodaj produkt" })).toBeNull();
    expect(screen.getByText(/tylko do odczytu/)).toBeInTheDocument();
  });
});

describe("B-103 tabela wariantow", () => {
  it("wiersze z SKU, kolorem, cena, stanem i statusem; 'Edytuj' otwiera okno z formularzem, Esc zamyka i oddaje fokus", async () => {
    mockApi({
      "GET /v1/admin/auth/me": json(session("editor")),
      "GET /v1/admin/variants/M-WRB-MGL/price-history": json({ ...priceHistory, sku: "M-WRB-MGL" }),
    });
    const { container } = renderWithProviders(<VariantsTab product={wrobel()} />);
    const table = screen.getByRole("table", { name: "Warianty i ceny" });
    expect(
      within(table)
        .getAllByRole("columnheader")
        .map((h) => h.textContent),
    ).toEqual(["SKU", "Kolor", "Przełącznik", "Cena", "Stan", "Status", "Akcje"]);
    const row = within(table)
      .getByRole("rowheader", { name: "M-WRB-MGL" })
      .closest("tr") as HTMLElement;
    expect(within(row).getByText("Mgła")).toBeInTheDocument();
    expect(
      within(row).getByText("Ostatnie sztuki", { selector: "span.tk-plakietka" }),
    ).toBeInTheDocument();
    expect(await axe(container)).toHaveNoViolations();

    const user = userEvent.setup();
    const edit = await within(row).findByRole("button", { name: "Edytuj wariant M-WRB-MGL" });
    await user.click(edit);
    const dialog = await screen.findByRole("dialog", { name: "Wariant M-WRB-MGL" });
    expect(within(dialog).getByLabelText("Nowa cena (zł)")).toHaveValue("129,00");
    await user.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    await waitFor(() => expect(edit).toHaveFocus());
  });

  it("viewer: przyciski 'Zobacz', 'Dodaj wariant' nieaktywny z powodem", async () => {
    mockApi({ "GET /v1/admin/auth/me": json(session("viewer")) });
    renderWithProviders(<VariantsTab product={wrobel()} />);
    expect(await screen.findAllByRole("button", { name: /Zobacz wariant/ })).toHaveLength(2);
    const add = screen.getByRole("button", { name: "Dodaj wariant" });
    expect(add).toBeDisabled();
    await waitFor(() => expect(add).toHaveAccessibleDescription(/tylko do odczytu/));
  });
});

describe("B-102 edycja danych produktu", () => {
  it("blad pod polem (nazwa za krotka): aria-invalid, aria-describedby, fokus; bez zapytania", async () => {
    const calls = mockApi({ "GET /v1/admin/auth/me": json(session("editor")) });
    renderWithProviders(<ProductDataForm product={wrobel()} />);
    const name = await screen.findByLabelText("Nazwa");
    await waitFor(() => expect(screen.getByRole("button", { name: "Zapisz" })).toBeEnabled());
    const user = userEvent.setup();
    await user.clear(name);
    await user.type(name, "W");
    await user.click(screen.getByRole("button", { name: "Zapisz" }));
    expect(await screen.findByText("Wpisz nazwę produktu (2 do 80 znaków).")).toBeInTheDocument();
    expect(name).toHaveAttribute("aria-invalid", "true");
    expect(name).toHaveAccessibleDescription(/Wpisz nazwę produktu/);
    await waitFor(() => expect(name).toHaveFocus());
    expect(calls.some((c) => c.method === "PATCH")).toBe(false);
  });

  it("zapis: PATCH tylko zmienionych pol z If-Match, potem pasek 'Zapisano' i link do sklepu", async () => {
    const calls = mockApi({
      "GET /v1/admin/auth/me": json(session("editor")),
      "PATCH /v1/admin/products/m-wrobel": json(wrobel({ name: "Wróbel 2", version: 6 }), {
        etag: 6,
      }),
    });
    renderWithProviders(<ProductDataForm product={wrobel()} />);
    const name = await screen.findByLabelText("Nazwa");
    await waitFor(() => expect(screen.getByRole("button", { name: "Zapisz" })).toBeEnabled());
    const user = userEvent.setup();
    await user.clear(name);
    await user.type(name, "Wróbel 2");
    expect(screen.getByText("Niezapisane zmiany")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Zapisz" }));
    await screen.findByText(/Zapisano \d{2}:\d{2}\. Sklep odświeży stronę w kilka sekund\./);
    const patch = calls.find((c) => c.method === "PATCH");
    expect(patch?.body).toEqual({ name: "Wróbel 2" });
    expect(patch?.headers["If-Match"]).toBe('"5"');
    expect(screen.getByRole("link", { name: "Zobacz w sklepie" })).toBeInTheDocument();
  });

  it("viewer: wszystkie pola nieaktywne, 'Zapisz' z powodem", async () => {
    mockApi({ "GET /v1/admin/auth/me": json(session("viewer")) });
    renderWithProviders(<ProductDataForm product={wrobel()} />);
    expect(await screen.findByLabelText("Nazwa")).toBeDisabled();
    expect(screen.getByLabelText("Adres (slug)")).toBeDisabled();
    expect(screen.getByLabelText("Waga (g)")).toBeDisabled();
    const save = screen.getByRole("button", { name: "Zapisz" });
    expect(save).toBeDisabled();
    await waitFor(() => expect(save).toHaveAccessibleDescription(/tylko do odczytu/));
  });
});
