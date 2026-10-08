// B-104, B-105, B-106, B-107, B-108 (TAKTYL-51): formularz ceny i stanu wariantu - zl -> grosze, podglad Omnibus, lowest_30d
// tylko do odczytu, If-Match i obsluga 412, viewer nieaktywny z powodem, a11y.
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { axe } from "vitest-axe";
import { describe, expect, it } from "vitest";
import { VariantForm } from "../src/components/produkty/variant-form";
import { priceHistory, wrobel } from "./fixtures";
import { json, mockApi, problem, renderWithProviders, session } from "./helpers";

const NOW = () => new Date("2026-10-07T12:00:00+02:00");
const SKU = "M-WRB-GRF";

function routes(
  role: "owner" | "editor" | "viewer" = "editor",
  extra: Parameters<typeof mockApi>[0] = {},
) {
  return mockApi({
    "GET /v1/admin/auth/me": json(session(role)),
    [`GET /v1/admin/variants/${SKU}/price-history`]: json(priceHistory),
    ...extra,
  });
}

async function renderForm(role: "editor" | "viewer" = "editor") {
  const view = renderWithProviders(<VariantForm product={wrobel()} sku={SKU} now={NOW} />);
  await screen.findByText("Najniższa z 30 dni");
  await waitFor(() => expect(screen.getByTestId("lowest-30d")).toHaveTextContent("139,00"));
  if (role !== "viewer") {
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Zapisz wariant" })).toBeEnabled(),
    );
  }
  return view;
}

describe("B-104 zmiana ceny wariantu", () => {
  it("konwertuje zlote z przecinkiem na grosze i wysyla If-Match z wersja wariantu", async () => {
    const calls = routes("editor", {
      [`PUT /v1/admin/variants/${SKU}/price`]: json(wrobel({ version: 6 }), { etag: 6 }),
    });
    await renderForm();
    const user = userEvent.setup();
    const price = screen.getByLabelText("Nowa cena (zł)");
    await user.clear(price);
    await user.type(price, "119,00");
    await user.click(screen.getByRole("button", { name: "Zapisz wariant" }));

    const put = await waitFor(() => {
      const c = calls.find((x) => x.method === "PUT" && x.url.endsWith("/price"));
      if (!c) throw new Error("brak PUT");
      return c;
    });
    expect(put.body).toEqual({ price_gr: 11900 });
    expect(put.headers["If-Match"]).toBe('"3"');
    expect(put.headers["X-CSRF-Token"]).toBeTruthy();
    // skutek w sklepie: komunikat i odnosnik
    expect(
      await screen.findByText(/Zapisano\. Sklep odświeży stronę w kilka sekund\./),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Zobacz w sklepie" })).toHaveAttribute(
      "href",
      expect.stringContaining("/myszki/wrobel"),
    );
  });

  it.each([
    ["749", 74900],
    ["749.5", 74950],
    ["1 299,99", 129999],
  ])("%s zl to %i gr w zapytaniu", async (text, gr) => {
    const calls = routes("editor", {
      [`PUT /v1/admin/variants/${SKU}/price`]: json(wrobel(), { etag: 4 }),
    });
    await renderForm();
    const user = userEvent.setup();
    const price = screen.getByLabelText("Nowa cena (zł)");
    await user.clear(price);
    await user.type(price, text);
    await user.click(screen.getByRole("button", { name: "Zapisz wariant" }));
    await waitFor(() => expect(calls.some((c) => c.method === "PUT")).toBe(true));
    expect(calls.find((c) => c.method === "PUT")?.body).toMatchObject({ price_gr: gr });
  });

  it("zla kwota: komunikat pod polem z aria-describedby, fokus na polu, brak zapytania", async () => {
    const calls = routes();
    await renderForm();
    const user = userEvent.setup();
    const price = screen.getByLabelText("Nowa cena (zł)");
    await user.clear(price);
    await user.type(price, "12,345");
    await user.click(screen.getByRole("button", { name: "Zapisz wariant" }));
    expect(await screen.findByText("Wpisz cenę w złotych, np. 749,00.")).toBeInTheDocument();
    expect(price).toHaveAttribute("aria-invalid", "true");
    expect(price).toHaveAccessibleDescription(/Wpisz cenę w złotych/);
    await waitFor(() => expect(price).toHaveFocus());
    expect(calls.some((c) => c.method === "PUT")).toBe(false);
  });

  it("412: komunikat o zmianie przez kogos i przycisk 'Wczytaj zmiany'", async () => {
    const calls = routes("editor", {
      [`PUT /v1/admin/variants/${SKU}/price`]: problem(412, "conflict"),
      "GET /v1/admin/products/m-wrobel": json(wrobel({ version: 9 })),
    });
    await renderForm();
    const user = userEvent.setup();
    const price = screen.getByLabelText("Nowa cena (zł)");
    await user.clear(price);
    await user.type(price, "100");
    await user.click(screen.getByRole("button", { name: "Zapisz wariant" }));
    expect(
      await screen.findByText(/Ktoś zmienił ten produkt\. Odśwież i spróbuj ponownie\./),
    ).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Wczytaj zmiany" }));
    await waitFor(() =>
      expect(calls.some((c) => c.method === "GET" && c.url === "/v1/admin/products/m-wrobel")).toBe(
        true,
      ),
    );
    await waitFor(() => expect(screen.queryByText(/Ktoś zmienił/)).toBeNull());
  });
});

describe("B-105, B-106 Omnibus", () => {
  it("lowest_30d jest tylko do odczytu: brak pola edycji, objasnienie z docs/15", async () => {
    routes();
    await renderForm();
    expect(screen.queryByLabelText(/najniższa/i)).toBeNull();
    expect(screen.queryByRole("textbox", { name: /30 dni/i })).toBeNull();
    expect(screen.getByTestId("lowest-30d")).toHaveTextContent("139,00");
    expect(screen.getByTestId("lowest-30d")).toHaveTextContent("−7%");
    expect(
      screen.getByText("Liczone z historii cen z ostatnich 30 dni. Nie wpisujesz tego ręcznie."),
    ).toBeInTheDocument();
  });

  it("B-S2: nowa cena 119,00 zl pokazuje -14% i 'najnizsza z 30 dni' 139,00 zl przed zapisem", async () => {
    routes();
    await renderForm();
    const user = userEvent.setup();
    const price = screen.getByLabelText("Nowa cena (zł)");
    await user.clear(price);
    await user.type(price, "119,00");
    const note = await screen.findByText(
      /Obniżka pokaże przekreśloną najniższą cenę z 30 dni: 139,00/,
    );
    expect(note).toHaveTextContent("−14%");
    expect(note).toHaveTextContent("Najniższa cena z 30 dni przed obniżką: 139,00");
  });

  it("podwyzka nie pokazuje ostrzezenia o obnizce", async () => {
    routes();
    await renderForm();
    const user = userEvent.setup();
    const price = screen.getByLabelText("Nowa cena (zł)");
    await user.clear(price);
    await user.type(price, "150,00");
    expect(screen.queryByText(/Obniżka pokaże/)).toBeNull();
  });

  it("historia cen: tabela z naglowkami, link do pelnej historii", async () => {
    routes();
    await renderForm();
    const table = await screen.findByRole("table", { name: /Historia cen wariantu/ });
    expect(
      within(table)
        .getAllByRole("columnheader")
        .map((h) => h.textContent),
    ).toEqual(["Data", "Cena", "Zmienił"]);
    expect(within(table).getByText("129,00 zł")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Historia cen (pełna)" })).toHaveAttribute(
      "href",
      "/produkty/m-wrobel/ceny?sku=M-WRB-GRF",
    );
  });
});

describe("B-108 stan magazynowy", () => {
  it("zmiana stanu wymaga powodu; z powodem wysyla PUT stock z If-Match", async () => {
    const calls = routes("editor", {
      [`PUT /v1/admin/variants/${SKU}/stock`]: json(wrobel(), { etag: 4 }),
    });
    await renderForm();
    const user = userEvent.setup();
    const stock = screen.getByLabelText("Stan (szt.)");
    await user.clear(stock);
    await user.type(stock, "0");
    expect(screen.getByText("Etykieta w sklepie: Brak.")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Zapisz wariant" }));
    expect(
      await screen.findByText("Podaj powód korekty stanu (do 200 znaków)."),
    ).toBeInTheDocument();
    expect(calls.some((c) => c.method === "PUT")).toBe(false);

    await user.type(screen.getByLabelText("Powód korekty"), "inwentaryzacja");
    await user.click(screen.getByRole("button", { name: "Zapisz wariant" }));
    await waitFor(() => expect(calls.some((c) => c.method === "PUT")).toBe(true));
    const put = calls.find((c) => c.method === "PUT");
    expect(put?.url).toBe(`/v1/admin/variants/${SKU}/stock`);
    expect(put?.body).toEqual({ stock: 0, reason: "inwentaryzacja" });
    expect(put?.headers["If-Match"]).toBe('"3"');
  });

  it("stan niecalkowity daje komunikat z docs/15", async () => {
    routes();
    await renderForm();
    const user = userEvent.setup();
    const stock = screen.getByLabelText("Stan (szt.)");
    await user.clear(stock);
    await user.type(stock, "2,5");
    await user.click(screen.getByRole("button", { name: "Zapisz wariant" }));
    expect(await screen.findByText("Wpisz całkowitą liczbę sztuk, np. 17.")).toBeInTheDocument();
  });
});

describe("role", () => {
  it("viewer: pola i przycisk nieaktywne z powodem, nic nie jest wysylane", async () => {
    const calls = routes("viewer");
    await renderForm("viewer");
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Zapisz wariant" })).toBeDisabled(),
    );
    expect(screen.getByLabelText("Nowa cena (zł)")).toBeDisabled();
    expect(screen.getByLabelText("Stan (szt.)")).toBeDisabled();
    expect(screen.getByRole("button", { name: "Zapisz wariant" })).toHaveAccessibleDescription(
      /tylko do odczytu/,
    );
    expect(calls.some((c) => c.method !== "GET")).toBe(false);
  });

  it("brak naruszen axe", async () => {
    routes();
    const { container } = await renderForm();
    expect(await axe(container)).toHaveNoViolations();
  });
});

describe("B-105 kolejnosc historii cen (TAKTYL-82)", () => {
  it("okno wariantu pokazuje 5 najnowszych wpisow, najnowszy pierwszy", async () => {
    const entries = Array.from({ length: 7 }, (_, i) => ({
      price_gr: (66 - i) * 100,
      valid_from: `2026-10-0${7 - i}T10:00:00+02:00`,
      valid_to: null,
      changed_by: "owner@taktyl.example",
      reason: null,
    }));
    routes("editor", {
      [`GET /v1/admin/variants/${SKU}/price-history`]: json({ ...priceHistory, entries }),
    });
    await renderForm();
    const region = screen.getByRole("region", { name: "Historia cen (ostatnie wpisy)" });
    const rows = within(region).getAllByRole("row");
    expect(rows).toHaveLength(6);
    expect(rows[1]).toHaveTextContent("66,00");
    expect(rows[5]).toHaveTextContent("62,00");
  });
});
