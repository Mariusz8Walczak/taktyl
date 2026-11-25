// B-610..B-627 (docs/25 par. 2-3): pulpit ze statystykami, ruch, "Jak to zrobione", dziennik po ludzku, zakres dat,
// paleta polecen i menu w grupach z licznikami. Dane z atrapy API (ksztalt z @taktyl/contracts).
import {
  operationsStatsSchema,
  salesStatsSchema,
  systemStatusSchema,
  trafficStatsSchema,
} from "@taktyl/contracts";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { axe } from "vitest-axe";
import { describe, expect, it } from "vitest";
import { DashboardView } from "../src/components/pulpit/dashboard-view";
import { TrafficView } from "../src/components/ruch/traffic-view";
import { PanelShell } from "../src/components/shell/panel-shell";
import { SystemView } from "../src/components/system/system-view";
import { humanize, parseMediaKey } from "../src/lib/audit-human";
import { deltaPercent, rangeFromParams } from "../src/lib/range";
import { json, mockApi, nav, problem, renderWithProviders, session } from "./helpers";

const NOW = "2026-10-07T12:00:00+02:00";
// Probki kolorow wylacznie z data/colors.json (regula 2: kolor jako dana, nie styl).
const COLORS = JSON.parse(
  readFileSync(join(process.cwd(), "../../data/colors.json"), "utf8"),
) as Record<string, { swatch: string; label: string; code: string }>;
const swatch = (id: string): string => COLORS[id]?.swatch ?? "";
const days = ["2026-10-05", "2026-10-06", "2026-10-07"];
const range = {
  from: "2026-10-05",
  to: "2026-10-07",
  days: 3,
  previous: { from: "2026-10-02", to: "2026-10-04" },
};

const sales = salesStatsSchema.parse({
  generated_at: NOW,
  range,
  demo_data: true,
  kpi: {
    revenue_gr: { value: 300000, previous: 250000 },
    orders: { value: 6, previous: 8 },
    paid_orders: { value: 5, previous: 4 },
    aov_gr: { value: 60000, previous: 62500 },
    set_share_bp: { value: 4250, previous: 4000 },
  },
  daily: days.map((d, i) => ({
    date: d,
    revenue_gr: (i + 1) * 50000,
    orders: 2,
    paid_orders: i + 1 > 2 ? 2 : 1,
    set_revenue_gr: 20000,
    items_revenue_gr: 50000,
    prev_date: `2026-10-0${i + 2}`,
    prev_revenue_gr: 40000,
    prev_orders: 2,
  })),
  funnel: {
    created: 6,
    reached: { paid: 5, processing: 4, shipped: 3, delivered: 2 },
    cancelled: 1,
    payment_failed_once: 1,
    waiting_payment: 0,
    transitions: [
      { from: "pending_payment", to: "paid", count: 5, median_minutes: 7 },
      { from: "paid", to: "processing", count: 4, median_minutes: 600 },
      { from: "processing", to: "shipped", count: 3, median_minutes: 1500 },
      { from: "shipped", to: "delivered", count: 2, median_minutes: 3000 },
    ],
  },
  heatmap: {
    cells: Array.from({ length: 168 }, (_, i) => ({
      dow: Math.floor(i / 24) + 1,
      hour: i % 24,
      orders: i === 43 ? 3 : 0,
    })),
    max: 3,
  },
  sets: {
    paid_orders: 5,
    orders_with_set: 2,
    sets_sold: 2,
    set_revenue_gr: 120000,
    single_revenue_gr: 160000,
    set_discount_gr: 13300,
    prev_set_revenue_gr: 100000,
    prev_set_discount_gr: 11000,
  },
  configurator: {
    items: 1,
    orders: 1,
    revenue_gr: 34900,
    surcharge_avg_gr: 2000,
    surcharge_total_gr: 2000,
    prev_items: 0,
    by_model: [{ model: "m-mewa", name: "Mewa", items: 1 }],
    top_colors: [{ color: "turkus", label: "Turkus", swatch: swatch("turkus"), parts: 2 }],
  },
  colors: [
    {
      color: "grafit",
      label: "Grafit",
      swatch: swatch("grafit"),
      units: 4,
      revenue_gr: 200000,
      prev_units: 3,
    },
  ],
  top_products: [
    {
      product_id: "k-bazalt-75",
      slug: "bazalt-75",
      name: "Bazalt 75",
      category: "klawiatury",
      thumb_url: "http://taktyl.localhost/media/img/produkty/k-bazalt-75_grafit_01-34-400.webp",
      units: 2,
      revenue_gr: 149800,
      prev_revenue_gr: 74900,
    },
  ],
});

const ops = operationsStatsSchema.parse({
  generated_at: NOW,
  waiting_orders: {
    count: 1,
    items: [
      {
        number: "TK-261005-AB12",
        paid_at: "2026-10-05T10:00:00+02:00",
        total_gr: 74900,
        hours: 50,
      },
    ],
  },
  low_stock: {
    count: 2,
    out_of_stock: 1,
    items: [
      {
        sku: "K-BZL75-KOB-SZP",
        product_id: "k-bazalt-75",
        product_name: "Bazalt 75",
        stock: 0,
        sold_30d: 3,
        days_left: 0,
      },
      {
        sku: "M-JRZ-MGL",
        product_id: "m-jerzyk",
        product_name: "Jerzyk",
        stock: 2,
        sold_30d: 6,
        days_left: 10,
      },
    ],
  },
  messages_unhandled: 3,
  outbox: { pending: 0, failed: 0, last_revalidated_at: NOW },
  images: { p0_ready: 76, p0_total: 76, p1_ready: 100, p1_total: 114, ready: 290, total: 300 },
  omnibus: [
    {
      sku: "M-WRB-GRF",
      product_id: "m-wrobel",
      product_name: "Wróbel",
      price_gr: 11900,
      regular_price_gr: 13900,
      lowest_30d_gr: 13900,
    },
  ],
});

const audit = (i: number, over: Record<string, unknown> = {}) => ({
  id: String(100 - i),
  at: new Date(Date.parse("2026-10-07T10:00:00Z") - i * 20_000).toISOString(),
  actor_id: "u1",
  actor_role: "owner",
  action: "media.upload",
  entity: "media",
  entity_id: `p-tafla-m_mgla_0${i}-34`,
  before: null,
  after: null,
  request_id: `r${i}`,
  ...over,
});

const baseRoutes = () => ({
  "GET /v1/admin/auth/me": json(session("viewer")),
  "GET /v1/admin/stats/sales": json(sales),
  "GET /v1/admin/stats/operations": json(ops),
  "GET /v1/admin/audit": json({
    items: [
      audit(0),
      audit(1),
      audit(2),
      audit(3, {
        action: "variant.price.set",
        entity: "variant",
        entity_id: "M-WRB-GRF",
        at: "2026-10-06T08:00:00Z",
      }),
    ],
    page: 1,
    per_page: 100,
    total: 4,
  }),
  "GET /v1/admin/products": json({
    items: [
      {
        id: "p-tafla-m",
        slug: "tafla-m",
        category: "podkladki",
        name: "Tafla M",
        status: "active",
        variant_count: 2,
        from_price_gr: 9900,
        total_stock: 10,
        missing_images: 0,
        badges: [],
        on_sale: false,
        version: 1,
        updated_at: NOW,
      },
    ],
    page: 1,
    per_page: 100,
    total: 1,
  }),
  "GET /v1/colors": json({
    items: [{ id: "mgla", code: "MGL", label: "Mgła", harmony: "jasne", swatch: swatch("mgla") }],
  }),
});

describe("B-610..B-619 pulpit", () => {
  it("KPI ze zmiana do poprzedniego okresu, lejek, mapa cieplna jako tabela, USP, operacje, aktywnosc; axe", async () => {
    nav({ pathname: "/", search: "zakres=7" });
    const calls = mockApi(baseRoutes());
    const { container } = renderWithProviders(<DashboardView />);
    const revenue = await screen.findByRole("region", { name: "Przychód (opłacone)" });
    expect(within(revenue).getByText(/3\s?000,00\szł/)).toBeInTheDocument();
    expect(within(revenue).getByText(/\+20%/)).toBeInTheDocument();
    expect(within(revenue).getByText("(wzrost)")).toBeInTheDocument();
    const orders = screen.getByRole("region", { name: "Zamówienia" });
    expect(within(orders).getByText(/-25%|−25%/)).toBeInTheDocument();
    expect(screen.getByText(/42,5\s?%/)).toBeInTheDocument();
    // zakres z adresu trafia do zapytania (7 dni do dzis, porownanie wlaczone)
    const q = new URLSearchParams(
      calls.find((c) => c.url.startsWith("/v1/admin/stats/sales"))?.url.split("?")[1],
    );
    expect(q.get("compare")).toBe("previous");
    expect(q.get("from")).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    // lejek z czasami przejsc
    const funnel = screen.getByRole("region", { name: "Droga zamówienia" });
    expect(within(funnel).getByText("Dostarczone")).toBeInTheDocument();
    expect(within(funnel).getByText(/7 min/)).toBeInTheDocument();
    // mapa cieplna: tabela z naglowkami dni
    const heat = screen.getByRole("table", { name: "Liczba zamówień wg dnia tygodnia i godziny" });
    expect(within(heat).getAllByRole("row")).toHaveLength(8);
    // sety, konfigurator, kolory z probka, top produkty z miniatura i odnosnikiem
    expect(screen.getByRole("region", { name: "Sety z rabatem" })).toHaveTextContent(/133,00\szł/);
    expect(screen.getByRole("region", { name: "Konfigurator 3D" })).toHaveTextContent("Turkus");
    const top = screen.getByRole("region", { name: "Najlepiej sprzedające się produkty" });
    expect(within(top).getByRole("link", { name: "Bazalt 75" })).toHaveAttribute(
      "href",
      "/produkty/k-bazalt-75",
    );
    // operacje: prognoza i Omnibus tylko do odczytu
    const stock = await screen.findByRole("region", { name: "Niski stan i prognoza" });
    expect(within(stock).getByText(/skończy się za ok\. 10 dni/)).toBeInTheDocument();
    expect(
      screen.getByRole("region", { name: "Promocje i najniższa cena z 30 dni" }),
    ).toHaveTextContent(/139,00\szł/);
    expect(screen.queryByRole("textbox")).toBeNull();
    // aktywnosc: seria trzech zdjec w jednym wpisie z nazwa produktu i koloru
    await waitFor(() =>
      expect(screen.getByText(/wgrał 3 zdjęcia, ostatnie: Tafla M \(Mgła\)/)).toBeInTheDocument(),
    );
    expect(screen.getByText(/zmienił cenę M-WRB-GRF/)).toBeInTheDocument();
    expect(screen.getByText(/generatora danych demonstracyjnych/)).toBeInTheDocument();
    expect(await axe(container)).toHaveNoViolations();
  });

  it("blad bloku sprzedazy: komunikat i ponowienie, operacje dzialaja dalej", async () => {
    nav({ pathname: "/", search: "" });
    mockApi({ ...baseRoutes(), "GET /v1/admin/stats/sales": problem(500, "internal_error") });
    renderWithProviders(<DashboardView />);
    expect(
      await screen.findByText("Nie udało się pobrać statystyk sprzedaży."),
    ).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "Spróbuj ponownie" }).length).toBeGreaterThan(0);
    expect(
      await screen.findByRole("region", { name: "Niski stan i prognoza" }),
    ).toBeInTheDocument();
  });
});

describe("B-620 ruch", () => {
  it("sesje, konwersja, lejek z udzialem kroku, kreator, wyszukiwania", async () => {
    nav({ pathname: "/ruch", search: "zakres=30&porownanie=nie" });
    const traffic = trafficStatsSchema.parse({
      generated_at: NOW,
      range: { ...range, previous: null },
      demo_data: true,
      kpi: {
        sessions: { value: 1000, previous: null },
        purchases: { value: 30, previous: null },
        conversion_bp: { value: 300, previous: null },
        abandoned_carts: { value: 70, previous: null },
        events: { value: 4200, previous: null },
      },
      funnel: [
        { step: "view_item", sessions: 600, previous: null },
        { step: "add_to_cart", sessions: 120, previous: null },
        { step: "begin_checkout", sessions: 45, previous: null },
        { step: "purchase", sessions: 30, previous: null },
      ],
      daily: days.map((d) => ({ date: d, sessions: 330, purchases: 10, prev_sessions: null })),
      builder: {
        starts: 50,
        completes: 20,
        add_to_cart: 12,
        entry_points: [{ entry_point: "hero", count: 30 }],
      },
      top_items: [
        { item_id: "K-BZL75-GRF-PRG", item_name: "Bazalt 75", views: 90, add_to_cart: 12 },
      ],
      searches: [{ term: "cicha klawiatura", count: 14 }],
      lists: [],
    });
    const calls = mockApi({
      "GET /v1/admin/auth/me": json(session("viewer")),
      "GET /v1/admin/stats/traffic": json(traffic),
    });
    const { container } = renderWithProviders(<TrafficView />);
    expect(await screen.findByRole("region", { name: "Konwersja" })).toHaveTextContent("3%");
    expect(screen.getByText(/120 \(20% z poprzedniego kroku\)/)).toBeInTheDocument();
    expect(screen.getByText("Strona główna")).toBeInTheDocument();
    expect(screen.getByText("cicha klawiatura")).toBeInTheDocument();
    const q = new URLSearchParams(
      calls.find((c) => c.url.startsWith("/v1/admin/stats/traffic"))?.url.split("?")[1],
    );
    expect(q.get("compare")).toBe("none");
    expect(await axe(container)).toHaveNoViolations();
  });
});

describe("B-623 jak to jest zrobione", () => {
  it("kondycja uslug tekstem, wersje stosu z API, liczby danych", async () => {
    nav({ pathname: "/system" });
    const sys = systemStatusSchema.parse({
      generated_at: NOW,
      demo_mode: true,
      services: [
        {
          id: "db",
          label: "Baza PostgreSQL",
          status: "ok",
          detail: "SELECT 1 bez bledu.",
          latency_ms: 2,
        },
        {
          id: "web",
          label: "Sklep (Next.js)",
          status: "awaria",
          detail: "Brak odpowiedzi.",
          latency_ms: null,
        },
      ],
      stack: [{ name: "NestJS", version: "12.1.2", role: "API" }],
      data: [{ id: "orders", label: "Zamowienia", count: 635 }],
      migrations: { applied: 6, last: "20261125000100_analytics_events" },
    });
    mockApi({
      "GET /v1/admin/auth/me": json(session("viewer")),
      "GET /v1/admin/system": json(sys),
    });
    const { container } = renderWithProviders(<SystemView />);
    expect(await screen.findByRole("region", { name: "Sklep (Next.js)" })).toHaveTextContent(
      "awaria",
    );
    expect(screen.getByRole("rowheader", { name: "NestJS" })).toBeInTheDocument();
    expect(screen.getByText("635")).toBeInTheDocument();
    expect(await axe(container)).toHaveNoViolations();
  });
});

describe("B-624..B-627 powloka", () => {
  it("menu w grupach z licznikami, paleta polecen z wyszukiwaniem (Ctrl+K), przelacznik motywu", async () => {
    nav({ pathname: "/" });
    mockApi({
      "GET /v1/admin/auth/me": json(session("editor")),
      "GET /v1/admin/stats/operations": json(ops),
      "GET /v1/admin/search": json({
        products: [
          {
            id: "k-bazalt-75",
            name: "Bazalt 75",
            category: "klawiatury",
            sku: null,
            status: "active",
          },
        ],
        orders: [{ number: "TK-261005-AB12", status: "paid", total_gr: 74900, created_at: NOW }],
      }),
    });
    renderWithProviders(
      <PanelShell>
        <p>Treść</p>
      </PanelShell>,
    );
    await screen.findByText("Treść");
    const nav1 = screen.getByRole("navigation", { name: "Główna" });
    expect(within(nav1).getByRole("heading", { name: "Sprzedaż" })).toBeInTheDocument();
    expect(within(nav1).getByRole("link", { name: "Pulpit" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    await waitFor(() => expect(within(nav1).getByText("3 bez odpowiedzi")).toBeInTheDocument());
    const user = userEvent.setup();
    await user.keyboard("{Control>}k{/Control}");
    const dialog = await screen.findByRole("dialog", { name: "Szukaj i przejdź" });
    const box = within(dialog).getByRole("combobox");
    expect(box).toHaveFocus();
    await user.type(box, "baz");
    expect(await within(dialog).findByRole("option", { name: /Bazalt 75/ })).toBeInTheDocument();
    await user.keyboard("{Enter}");
    expect(nav().push).toHaveBeenCalledWith("/produkty/k-bazalt-75");
    await user.click(screen.getByRole("button", { name: "Włącz motyw ciemny" }));
    expect(document.documentElement.getAttribute("data-motyw")).toBe("ciemny");
    await user.click(screen.getByRole("button", { name: "Włącz motyw jasny" }));
    expect(document.documentElement.hasAttribute("data-motyw")).toBe(false);
  });
});

describe("pomocnicze B-619, B-624", () => {
  it("humanize grupuje serie, nazywa produkt i kolor, linkuje encje", () => {
    const items = humanize(
      [audit(0), audit(1), audit(2, { actor_id: "u2", actor_role: "editor" })],
      { products: new Map([["p-tafla-m", "Tafla M"]]), colors: new Map([["mgla", "Mgła"]]) },
    );
    expect(items).toHaveLength(2);
    expect(items[0]).toMatchObject({
      count: 2,
      actor: "Właściciel",
      kind: "zdjecie",
      href: "/media",
    });
    expect(items[1]?.text).toBe("wgrał zdjęcia Tafla M (Mgła)");
    expect(parseMediaKey("m-pustulka_kowalik_01-34")).toEqual({
      productId: "m-pustulka",
      color: "kowalik",
    });
  });

  it("zakres z adresu: preset, wlasny, porownanie; zmiana procentowa", () => {
    const r = rangeFromParams(new URLSearchParams("zakres=7"), "2026-10-07");
    expect(r).toMatchObject({ preset: "7", from: "2026-10-01", to: "2026-10-07", compare: true });
    const c = rangeFromParams(
      new URLSearchParams("od=2026-09-01&do=2026-09-30&porownanie=nie"),
      "2026-10-07",
    );
    expect(c.query).toEqual({ from: "2026-09-01", to: "2026-09-30", compare: "none" });
    expect(rangeFromParams(new URLSearchParams(""), "2026-10-07").from).toBe("2026-09-08");
    expect(deltaPercent(120, 100)).toBe(20);
    expect(deltaPercent(5, 0)).toBeNull();
    expect(deltaPercent(5, null)).toBeNull();
  });
});
