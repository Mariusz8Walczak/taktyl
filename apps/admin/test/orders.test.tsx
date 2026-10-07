// B-200..B-205, B-208 (TAKTYL-52): lista zamowien (filtry w adresie, maskowanie, odmiana), szczegoly (kwoty, grupy setow,
// historia), zmiana statusu wylacznie z allowed_transitions[], anulowanie z powodem w oknie, notatki, viewer tylko odczyt.
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { axe } from "vitest-axe";
import { describe, expect, it } from "vitest";
import { OrderDetail } from "../src/components/zamowienia/order-detail";
import { OrdersList } from "../src/components/zamowienia/orders-list";
import { orderDetail } from "./fixtures";
import { json, mockApi, nav, problem, renderWithProviders, session } from "./helpers";

const NUM = "TK-261007-AB12";
const row = (over: Record<string, unknown> = {}) => ({
  number: NUM,
  status: "paid",
  created_at: "2026-10-07T12:00:00+02:00",
  total_gr: 81609,
  payment_type: "blik",
  shipping_method: "kurier",
  contact_email: "j***@taktyl.example",
  items_count: 2,
  ...over,
});
const page = (items: unknown[], total = items.length) =>
  json({ items, page: 1, per_page: 25, total });

describe("B-200 lista zamowien", () => {
  it("kolumny, zamaskowany kontakt, kwoty przez Intl, licznik z odmiana, link do szczegolow", async () => {
    nav({ pathname: "/zamowienia", search: "" });
    mockApi({
      "GET /v1/admin/auth/me": json(session("editor")),
      "GET /v1/admin/orders": page(
        [row(), row({ number: "TK-261007-ZZ99", status: "cancelled", items_count: 1 })],
        22,
      ),
    });
    const { container } = renderWithProviders(<OrdersList />);
    const table = await screen.findByRole("table", { name: "Lista zamówień" });
    expect(screen.getByText("22 zamówienia")).toBeInTheDocument();
    expect(
      within(table)
        .getAllByRole("columnheader")
        .map((h) => h.textContent?.replace(/[↑↓]/, "")),
    ).toEqual(["Numer", "Data", "Status", "Dostawa", "Płatność", "Wartość", "Pozycje", "Kontakt"]);
    expect(within(table).getByRole("link", { name: NUM })).toHaveAttribute(
      "href",
      `/zamowienia/${NUM}`,
    );
    expect(within(table).getAllByText("j***@taktyl.example")).toHaveLength(2);
    expect(within(table).getAllByText("816,09 zł")[0]).toBeInTheDocument();
    expect(within(table).getByText("Anulowane")).toBeInTheDocument();
    expect(await axe(container)).toHaveNoViolations();
  });

  it("B-201: filtry z adresu trafiaja do zapytania; zeton statusu ustawia ?status=", async () => {
    nav({
      pathname: "/zamowienia",
      search:
        "status=paid&shipping_method=kurier&from=2026-10-01&to=2026-10-07&number=TK-26&page=2&sort=total_gr",
    });
    const calls = mockApi({
      "GET /v1/admin/auth/me": json(session("viewer")),
      "GET /v1/admin/orders": page([row()], 1),
    });
    renderWithProviders(<OrdersList />);
    await screen.findByRole("table", { name: "Lista zamówień" });
    const q = Object.fromEntries(
      new URLSearchParams(
        calls.find((c) => c.url.startsWith("/v1/admin/orders"))?.url.split("?")[1],
      ),
    );
    expect(q).toEqual({
      page: "2",
      per_page: "25",
      sort: "total_gr",
      status: "paid",
      shipping_method: "kurier",
      from: "2026-10-01",
      to: "2026-10-07",
      number: "TK-26",
    });
    expect(screen.getByText("1 zamówienie")).toBeInTheDocument();
    const chip = screen.getByRole("button", { name: "Opłacone" });
    expect(chip).toHaveAttribute("aria-pressed", "true");
    await userEvent.setup().click(screen.getByRole("button", { name: "Wysłane" }));
    expect(nav().replace).toHaveBeenCalledWith(expect.stringContaining("status=shipped"), {
      scroll: false,
    });
  });

  it("pusta lista bez filtrow: komunikat z odnosnikiem do sklepu", async () => {
    nav({ pathname: "/zamowienia", search: "" });
    mockApi({ "GET /v1/admin/auth/me": json(session()), "GET /v1/admin/orders": page([], 0) });
    renderWithProviders(<OrdersList />);
    expect(
      await screen.findByText(
        /Nie ma jeszcze zamówień\. Złóż pierwsze w sklepie demonstracyjnym\./,
      ),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Otwórz sklep" })).toBeInTheDocument();
  });
});

function detailRoutes(
  role: "owner" | "editor" | "viewer",
  order = orderDetail(),
  extra: Parameters<typeof mockApi>[0] = {},
) {
  return mockApi({
    "GET /v1/admin/auth/me": json(session(role)),
    [`GET /v1/admin/orders/${NUM}`]: json(order),
    ...extra,
  });
}

async function renderDetail(
  role: "owner" | "editor" | "viewer" = "editor",
  order = orderDetail(),
  extra = {},
) {
  const calls = detailRoutes(role, order, extra);
  const view = renderWithProviders(<OrderDetail number={NUM} />);
  await screen.findByRole("heading", { level: 1, name: NUM });
  if (role !== "viewer")
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Rozpocznij realizację" })).toBeEnabled(),
    );
  return { calls, ...view };
}

describe("B-202 szczegoly zamowienia", () => {
  it("pozycje (grupa setu), kwoty co do grosza, dostawa, platnosc symulowana, historia, naglowki tabeli", async () => {
    const { container } = await renderDetail();
    const items = screen.getByRole("table", { name: /Pozycje zamówienia/ });
    expect(
      within(items)
        .getAllByRole("columnheader")
        .map((h) => h.textContent),
    ).toEqual(["Produkt", "SKU", "Ilość", "Cena", "Rabat setu"]);
    expect(within(items).getByText(/Grafit, Próg, w secie/)).toBeInTheDocument();
    expect(within(items).getByText("−74,90 zł")).toBeInTheDocument();
    const sums = screen.getByLabelText("Kwoty");
    expect(within(sums).getByText("878,00 zł")).toBeInTheDocument(); // produkty
    expect(within(sums).getByText("−74,90 zł")).toBeInTheDocument(); // rabat setu
    expect(within(sums).getByText("12,99 zł")).toBeInTheDocument(); // dostawa
    expect(within(sums).getByText("816,09 zł")).toBeInTheDocument(); // razem
    expect(screen.getByText("Płatność (symulacja)")).toBeInTheDocument();
    expect(screen.getByText("j***@taktyl.example")).toBeInTheDocument();
    expect(screen.getAllByText(/Opłacone/).length).toBeGreaterThan(0);
    expect(screen.getByText(/Symulacja płatności/)).toBeInTheDocument();
    expect(await axe(container)).toHaveNoViolations();
  });

  it("nieznany numer: strona 404 z komunikatem", async () => {
    mockApi({ "GET /v1/admin/auth/me": json(session()) });
    renderWithProviders(<OrderDetail number={NUM} />);
    expect(await screen.findByText("Nie ma takiego zamówienia.")).toBeInTheDocument();
  });
});

describe("B-203 zmiana statusu", () => {
  it("przyciski wylacznie dla allowed_transitions: opłacone -> Rozpocznij realizację + Anuluj, bez Oznacz jako wysłane", async () => {
    await renderDetail();
    expect(screen.getByRole("button", { name: "Rozpocznij realizację" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Anuluj zamówienie" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Oznacz jako wysłane" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Oznacz jako dostarczone" })).toBeNull();
  });

  it("w realizacji: tylko 'Oznacz jako wysłane'", async () => {
    const calls = detailRoutes(
      "owner",
      orderDetail({ status: "processing", allowed_transitions: ["shipped", "cancelled"] }),
    );
    renderWithProviders(<OrderDetail number={NUM} />);
    await screen.findByRole("heading", { level: 1, name: NUM });
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Oznacz jako wysłane" })).toBeEnabled(),
    );
    expect(screen.queryByRole("button", { name: "Rozpocznij realizację" })).toBeNull();
    expect(calls.length).toBeGreaterThan(0);
  });

  it("zmiana statusu: POST transition z CSRF, fokus na naglowku, komunikat role=status", async () => {
    const after = orderDetail({
      status: "processing",
      allowed_transitions: ["shipped", "cancelled"],
      history: [
        ...orderDetail().history,
        {
          from: "paid",
          to: "processing",
          actor: "editor@taktyl.example",
          note: null,
          at: "2026-10-07T13:00:00+02:00",
        },
      ],
    });
    const { calls } = await renderDetail("editor", orderDetail(), {
      [`POST /v1/admin/orders/${NUM}/transition`]: json(after),
    });
    await userEvent.setup().click(screen.getByRole("button", { name: "Rozpocznij realizację" }));
    const post = await waitFor(() => {
      const c = calls.find((x) => x.method === "POST");
      if (!c) throw new Error("brak POST");
      return c;
    });
    expect(post.url).toBe(`/v1/admin/orders/${NUM}/transition`);
    expect(post.body).toEqual({ to: "processing" });
    expect(post.headers["X-CSRF-Token"]).toBeTruthy();
    expect(await screen.findByRole("button", { name: "Oznacz jako wysłane" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Rozpocznij realizację" })).toBeNull();
    expect(screen.getByText("Status zmieniony: W realizacji.")).toBeInTheDocument();
    await waitFor(() => expect(screen.getByRole("heading", { level: 1, name: NUM })).toHaveFocus());
  });

  it("409 invalid_transition: komunikat z docs/15 i odswiezenie zamowienia", async () => {
    const { calls } = await renderDetail("editor", orderDetail(), {
      [`POST /v1/admin/orders/${NUM}/transition`]: problem(409, "invalid_transition"),
    });
    await userEvent.setup().click(screen.getByRole("button", { name: "Rozpocznij realizację" }));
    expect(
      await screen.findByText("Z tego statusu nie da się przejść do wybranego. Odśwież stronę."),
    ).toBeInTheDocument();
    await waitFor(() =>
      expect(calls.filter((c) => c.method === "GET" && c.url.endsWith(NUM)).length).toBeGreaterThan(
        1,
      ),
    );
  });
});

describe("B-205 anulowanie", () => {
  it("okno z trescia o zwrocie stanow; powod min. 5 znakow; POST cancelled z powodem; fokus wraca", async () => {
    const cancelled = orderDetail({
      status: "cancelled",
      allowed_transitions: [],
      history: [
        ...orderDetail().history,
        {
          from: "paid",
          to: "cancelled",
          actor: "editor@taktyl.example",
          note: "Klient zrezygnował",
          at: "2026-10-07T13:00:00+02:00",
        },
      ],
    });
    const { calls } = await renderDetail("editor", orderDetail(), {
      [`POST /v1/admin/orders/${NUM}/transition`]: json(cancelled),
    });
    const user = userEvent.setup();
    const trigger = screen.getByRole("button", { name: "Anuluj zamówienie" });
    await user.click(trigger);
    const dialog = await screen.findByRole("dialog", { name: "Anulowanie zamówienia" });
    expect(
      within(dialog).getByText(/Stany magazynowe zamówionych sztuk wrócą do magazynu\./),
    ).toBeInTheDocument();
    // bez powodu: blad pod polem, brak zapytania
    await user.click(within(dialog).getByRole("button", { name: "Anuluj zamówienie" }));
    expect(await within(dialog).findByText("Podaj powód anulowania.")).toBeInTheDocument();
    expect(calls.some((c) => c.method === "POST")).toBe(false);
    await user.type(within(dialog).getByLabelText("Powód anulowania"), "abc");
    await user.click(within(dialog).getByRole("button", { name: "Anuluj zamówienie" }));
    expect(await within(dialog).findByText("Podaj powód anulowania.")).toBeInTheDocument();
    await user.clear(within(dialog).getByLabelText("Powód anulowania"));
    await user.type(within(dialog).getByLabelText("Powód anulowania"), "Klient zrezygnował");
    await user.click(within(dialog).getByRole("button", { name: "Anuluj zamówienie" }));
    const post = await waitFor(() => {
      const c = calls.find((x) => x.method === "POST");
      if (!c) throw new Error("brak POST");
      return c;
    });
    expect(post.body).toEqual({ to: "cancelled", note: "Klient zrezygnował" });
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(await screen.findByText("Zamówienie anulowane.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Anuluj zamówienie" })).toBeNull();
  });

  it("Esc zamyka okno bez anulowania, fokus wraca na przycisk", async () => {
    const { calls } = await renderDetail();
    const user = userEvent.setup();
    const trigger = screen.getByRole("button", { name: "Anuluj zamówienie" });
    await user.click(trigger);
    await screen.findByRole("dialog");
    await user.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    await waitFor(() => expect(trigger).toHaveFocus());
    expect(calls.some((c) => c.method === "POST")).toBe(false);
  });
});

describe("B-204 notatki", () => {
  it("dodanie notatki: POST note, lista z autorem", async () => {
    const withNote = orderDetail({
      notes: [
        {
          id: "1",
          author: "editor@taktyl.example",
          body: "Zadzwonić do klienta",
          at: "2026-10-07T13:00:00+02:00",
        },
      ],
    });
    const { calls } = await renderDetail("editor", orderDetail(), {
      [`POST /v1/admin/orders/${NUM}/note`]: json(withNote),
    });
    const user = userEvent.setup();
    await user.type(screen.getByLabelText("Nowa notatka"), "Zadzwonić do klienta");
    await user.click(screen.getByRole("button", { name: "Dodaj notatkę" }));
    expect(await screen.findByText("Zadzwonić do klienta")).toBeInTheDocument();
    expect(calls.find((c) => c.method === "POST")?.body).toEqual({ note: "Zadzwonić do klienta" });
    expect(screen.getByText("Klient ich nie widzi.")).toBeInTheDocument();
  });
});

describe("viewer: tylko odczyt", () => {
  it("brak przyciskow zmiany statusu, powod, notatka nieaktywna, dane zamaskowane", async () => {
    const { calls } = await renderDetail("viewer", orderDetail({ allowed_transitions: [] }));
    expect(screen.queryByRole("button", { name: "Rozpocznij realizację" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Anuluj zamówienie" })).toBeNull();
    expect(await screen.findAllByText(/tylko do odczytu/)).not.toHaveLength(0);
    expect(screen.getByLabelText("Nowa notatka")).toBeDisabled();
    expect(screen.getByRole("button", { name: "Dodaj notatkę" })).toBeDisabled();
    expect(screen.getByText("j***@taktyl.example")).toBeInTheDocument();
    expect(calls.some((c) => c.method !== "GET")).toBe(false);
  });
});
