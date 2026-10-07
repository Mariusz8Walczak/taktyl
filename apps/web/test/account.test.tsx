// F-114, F-200, F-201, F-202, F-203 (TAKTYL-56): konto demo bez hasla, lista zamowien z taktyl.orders.v1 + status z API
// (w tym 401), szczegoly zamowienia, zapisane sety (maks. 10, zmiana nazwy, usun + Cofnij), "Zapisz set" w kreatorze.
import type { OrderDetail } from "@taktyl/contracts";
import { ToastProvider } from "@taktyl/ui";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { axe } from "vitest-axe";
import { AccountGate } from "../src/components/account/account-gate";
import { OrderDetailView } from "../src/components/account/order-detail";
import { OrdersList } from "../src/components/account/orders-list";
import { AccountOverview } from "../src/components/account/overview";
import { SaveSetButton } from "../src/components/account/save-set-button";
import { SavedSetsPage } from "../src/components/account/saved-sets";
import type { OrderPageSettings } from "../src/components/checkout/order-pages";
import { DEMO_SESSION_KEY } from "../src/lib/account/demo";
import { ORDERS_KEY } from "../src/lib/account/orders";
import { SETS_KEY, SETS_MAX, builderHref, savedSets } from "../src/lib/account/sets";
import { toLiteProduct } from "../src/lib/compare/lite";
import { saveOrderToken } from "../src/lib/cart/order-session";
import { COLORS, productFixture, SWITCHES } from "./catalog-fixtures";

const NUMBER = "TK-261007-A7B2";
const TOKEN = "t".repeat(32);
const TZ = "Europe/Warsaw";
const SETTINGS: OrderPageSettings = {
  paymentLabels: { blik: "BLIK", karta: "Karta płatnicza" },
  shippingLabels: { kurier: "Kurier", automat: "Automat paczkowy", odbior: "Odbiór osobisty" },
  shippingAddresses: { kurier: null, automat: null, odbior: null },
  timeZone: TZ,
  demoLabel: "Taktyl to sklep demonstracyjny. Nie pobieramy płatności.",
};
const CATALOG = ["bazalt-75", "wrobel", "tafla"].map((s) =>
  toLiteProduct(productFixture(s), COLORS, SWITCHES),
);
const events = (name: string) => (window.dataLayer ?? []).filter((e) => e.event === name);

function order(status: OrderDetail["status"] = "paid"): OrderDetail {
  return {
    number: NUMBER,
    status,
    currency: "PLN",
    created_at: "2026-10-07T16:00:00.000Z",
    items: [
      {
        group_id: "set-1",
        sku: "K-BZL75-GRF-PRG",
        name: "Bazalt 75",
        variant_label: "Grafit · Próg",
        qty: 1,
        unit_price_gr: 74900,
        set_discount_gr: 7490,
        coupon_discount_gr: 0,
      },
    ],
    items_gr: 74900,
    set_discount_gr: 7490,
    coupon_discount_gr: 0,
    shipping_gr: 0,
    total_gr: 67410,
    coupon_code: null,
    shipping_method: "kurier",
    payment: { type: "blik", status: "paid", attempts: 1 },
    eta: { dispatch_date: "2026-10-08", delivery_date: "2026-10-09" },
  } as OrderDetail;
}

function mockFetch(handler: (url: string, init?: RequestInit) => Response) {
  const fn = vi.fn(async (url: RequestInfo | URL, init?: RequestInit) =>
    handler(String(url), init),
  );
  vi.stubGlobal("fetch", fn);
  return fn;
}
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

beforeEach(() => {
  window.dataLayer = [];
  vi.unstubAllGlobals();
});

const wrap = (ui: ReactNode) => <ToastProvider>{ui}</ToastProvider>;

describe("logowanie demo (F-200)", () => {
  it("jeden przycisk, zero pol hasla; po kliknieciu flaga i nawigacja konta", async () => {
    const user = userEvent.setup();
    const { container } = render(
      wrap(
        <AccountGate current="przeglad">
          <p>Tresc konta</p>
        </AccountGate>,
      ),
    );
    const login = await screen.findByRole("button", { name: "Zaloguj jako użytkownika demo" });
    expect(container.querySelector('input[type="password"], input[type="email"]')).toBeNull();
    expect(container.querySelectorAll("input")).toHaveLength(0);
    expect(screen.queryByText("Tresc konta")).toBeNull();
    expect(await axe(container)).toHaveNoViolations();
    await user.click(login);
    expect(screen.getByText("Tresc konta")).toBeInTheDocument();
    expect(JSON.parse(window.localStorage.getItem(DEMO_SESSION_KEY) ?? "{}")).toMatchObject({
      demo: true,
    });
    const nav = screen.getByRole("navigation", { name: "Konto" });
    expect(within(nav).getByRole("link", { name: "Przegląd" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    await user.click(screen.getByRole("button", { name: "Wyloguj" }));
    expect(
      await screen.findByRole("button", { name: "Zaloguj jako użytkownika demo" }),
    ).toBeVisible();
  });
});

describe("zamowienia (F-202)", () => {
  it("lista z taktyl.orders.v1 odswieza status z API tokenem; kwota w groszach -> Intl", async () => {
    saveOrderToken(NUMBER, TOKEN, new Date("2026-10-07T16:00:00.000Z"));
    const fetchFn = mockFetch(() => json(order("shipped")));
    const { container } = render(<OrdersList timeZone={TZ} />);
    const link = await screen.findByRole("link", { name: `Zamówienie ${NUMBER}` });
    expect(link).toHaveAttribute("href", `/konto/zamowienia/${NUMBER}`);
    expect(await screen.findByText("Wysłane")).toBeInTheDocument();
    expect(screen.getByText(/674,10/)).toBeInTheDocument();
    const [url, init] = fetchFn.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(`/api/orders/${NUMBER}`);
    expect((init.headers as Record<string, string>)["x-order-token"]).toBe(TOKEN);
    expect(await axe(container)).toHaveNoViolations();
  });

  it("w zapisie zamowien nie ma danych adresowych ani cen", () => {
    saveOrderToken(NUMBER, TOKEN);
    const raw = window.localStorage.getItem(ORDERS_KEY) ?? "";
    expect(Object.keys(JSON.parse(raw).orders[0]).sort()).toEqual(["at", "number", "token"]);
  });

  it("401 z API: komunikat przy zamowieniu, lista dziala", async () => {
    saveOrderToken(NUMBER, TOKEN);
    mockFetch(() => json({ status: 401, code: "unauthorized" }, 401));
    render(<OrdersList timeZone={TZ} />);
    expect(await screen.findByRole("alert")).toHaveTextContent(
      /Nie możemy odczytać tego zamówienia/,
    );
    expect(screen.getByRole("link", { name: `Zamówienie ${NUMBER}` })).toBeInTheDocument();
  });

  it("blad serwera: komunikat o odswiezeniu, nie o tokenie", async () => {
    saveOrderToken(NUMBER, TOKEN);
    mockFetch(() => json({ status: 500 }, 500));
    render(<OrdersList timeZone={TZ} />);
    expect(await screen.findByRole("alert")).toHaveTextContent(/Nie udało się odświeżyć statusu/);
  });

  it("brak zamowien: zaproszenie do sklepu", async () => {
    render(<OrdersList timeZone={TZ} />);
    expect(await screen.findByText(/Nie ma jeszcze zamówień/)).toBeInTheDocument();
  });

  it("szczegoly: pozycje, kwoty, dostawa, platnosc, status i przebieg", async () => {
    saveOrderToken(NUMBER, TOKEN);
    mockFetch(() => json(order("paid")));
    const { container } = render(<OrderDetailView number={NUMBER} settings={SETTINGS} />);
    expect(
      await screen.findByRole("heading", { name: `Zamówienie ${NUMBER}` }),
    ).toBeInTheDocument();
    expect(screen.getByText(/Bazalt 75/)).toBeInTheDocument();
    expect(screen.getByText("Rabat za set")).toBeInTheDocument();
    expect(screen.getByText("Darmowa")).toBeInTheDocument();
    expect(screen.getByText("Kurier")).toBeInTheDocument();
    expect(screen.getByText(/BLIK \(symulacja\)/)).toBeInTheDocument();
    expect(screen.getByText(/czwartek, 8 października/)).toBeInTheDocument();
    expect(screen.getByText("Obecny status: Opłacone")).toBeInTheDocument();
    expect(await axe(container)).toHaveNoViolations();
  });

  it("szczegoly bez tokenu w tej przegladarce: komunikat", async () => {
    render(<OrderDetailView number={NUMBER} settings={SETTINGS} />);
    expect(await screen.findByRole("alert")).toHaveTextContent(/Nie możemy odczytać/);
  });
});

describe("przeglad konta (F-201)", () => {
  it("ostatnie zamowienie, zapisane sety i ulubione", async () => {
    saveOrderToken(NUMBER, TOKEN);
    savedSets.save({
      name: "Biurko",
      k: "K-BZL75-GRF-PRG",
      m: null,
      p: null,
      profile: null,
      handCm: null,
    });
    window.localStorage.setItem(
      "taktyl.wishlist.v1",
      JSON.stringify({ v: 1, skus: ["M-WRB-GRF", "P-TFL-M-GRF"] }),
    );
    mockFetch(() => json(order("processing")));
    render(<AccountOverview timeZone={TZ} />);
    expect(await screen.findByText("W realizacji")).toBeInTheDocument();
    expect(screen.getByText("Masz 1 set.")).toBeInTheDocument();
    expect(screen.getByText("Biurko")).toBeInTheDocument();
    expect(screen.getByText("Zapisane: 2 produkty.")).toBeInTheDocument();
  });
});

describe("zapisane sety (F-203, F-114)", () => {
  const input = (n: number) => ({
    name: `Set ${n}`,
    k: "K-BZL75-GRF-PRG",
    m: "M-WRB-GRF",
    p: "P-TFL-M-GRF",
    profile: "programista",
    handCm: 18.5,
  });

  it("maks. 10: jedenasty zapis odrzucony", () => {
    for (let i = 1; i <= SETS_MAX; i++) expect(savedSets.save(input(i)).ok).toBe(true);
    expect(savedSets.save(input(11))).toEqual({ ok: false, reason: "limit" });
    expect(savedSets.list()).toHaveLength(SETS_MAX);
  });

  it("adres kreatora odtwarza set", () => {
    const res = savedSets.save(input(1));
    if (!res.ok) throw new Error("zapis");
    const href = builderHref(res.set);
    expect(href).toContain("k=K-BZL75-GRF-PRG");
    expect(href).toContain("profil=programista");
    expect(href).toContain("dlon=18.5");
    expect(href).toContain("wejscie=account");
  });

  it("lista: otworz w kreatorze, zmiana nazwy, usuniecie z Cofnij (to samo miejsce)", async () => {
    const user = userEvent.setup();
    savedSets.save(input(1));
    savedSets.save(input(2));
    render(wrap(<SavedSetsPage catalog={CATALOG} timeZone={TZ} />));
    // najnowszy pierwszy
    const names = (await screen.findAllByRole("heading", { level: 3 })).map((h) => h.textContent);
    expect(names).toEqual(["Set 2", "Set 1"]);
    expect(screen.getAllByRole("link", { name: /Otwórz w kreatorze/ })[0]).toHaveAttribute(
      "href",
      expect.stringContaining("/zbuduj-set?"),
    );
    expect(screen.getAllByText(/Suma pozycji/)[0]).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /Zmień nazwę: Set 2/ }));
    const field = screen.getByLabelText("Nowa nazwa setu");
    await user.clear(field);
    await user.type(field, "Praca");
    await user.click(screen.getByRole("button", { name: "Zapisz nazwę" }));
    expect(screen.getByRole("heading", { name: "Praca" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /Usuń set: Praca/ }));
    expect(savedSets.list().map((s) => s.name)).toEqual(["Set 1"]);
    await user.click(screen.getByRole("button", { name: "Cofnij" }));
    expect(savedSets.list().map((s) => s.name)).toEqual(["Praca", "Set 1"]);
  });

  it("pusty stan i komunikat przy limicie; bez bledow axe", async () => {
    const { container, unmount } = render(wrap(<SavedSetsPage catalog={CATALOG} timeZone={TZ} />));
    expect(await screen.findByText(/Nie masz jeszcze zapisanych setów/)).toBeInTheDocument();
    unmount();
    for (let i = 1; i <= SETS_MAX; i++) savedSets.save(input(i));
    const second = render(wrap(<SavedSetsPage catalog={CATALOG} timeZone={TZ} />));
    expect(await screen.findByText(/Masz komplet 10 setów/)).toBeInTheDocument();
    expect(await axe(second.container)).toHaveNoViolations();
    void container;
  });

  it("uszkodzony zapis nie psuje strony", async () => {
    window.localStorage.setItem(SETS_KEY, "[[[");
    render(wrap(<SavedSetsPage catalog={CATALOG} timeZone={TZ} />));
    expect(await screen.findByText(/Nie masz jeszcze zapisanych setów/)).toBeInTheDocument();
  });
});

describe("Zapisz set w kreatorze (F-114)", () => {
  const props = {
    k: "K-BZL75-GRF-PRG",
    m: "M-WRB-GRF",
    p: "P-TFL-M-GRF",
    profile: "programista",
    handCm: 18.5,
    totalGr: 123456,
  };

  it("dialog z polem nazwy, 'Set zapisany' i set_save z wartoscia", async () => {
    const user = userEvent.setup();
    render(wrap(<SaveSetButton {...props} />));
    await user.click(screen.getByRole("button", { name: "Zapisz set" }));
    const dialog = await screen.findByRole("dialog", { name: "Zapisz set" });
    const field = within(dialog).getByLabelText("Nazwa setu");
    await user.clear(field);
    await user.type(field, "Do pracy");
    await user.click(within(dialog).getByRole("button", { name: "Zapisz" }));
    expect(screen.getByText("Set zapisany")).toBeInTheDocument();
    expect(savedSets.list()[0]).toMatchObject({ name: "Do pracy", k: props.k, handCm: 18.5 });
    expect(events("set_save")).toEqual([{ event: "set_save", value: 1234.56 }]);
  });

  it("pusta nazwa: blad pod polem, nic nie zapisane", async () => {
    const user = userEvent.setup();
    render(wrap(<SaveSetButton {...props} />));
    await user.click(screen.getByRole("button", { name: "Zapisz set" }));
    const dialog = await screen.findByRole("dialog");
    await user.clear(within(dialog).getByLabelText("Nazwa setu"));
    await user.click(within(dialog).getByRole("button", { name: "Zapisz" }));
    expect(within(dialog).getByText("Wpisz nazwę setu.")).toBeInTheDocument();
    expect(savedSets.list()).toHaveLength(0);
    expect(events("set_save")).toHaveLength(0);
  });

  it("limit 10: komunikat z odnosnikiem do zapisanych setow", async () => {
    const user = userEvent.setup();
    for (let i = 1; i <= SETS_MAX; i++) savedSets.save({ ...props, name: `Set ${i}` });
    render(wrap(<SaveSetButton {...props} />));
    await user.click(screen.getByRole("button", { name: "Zapisz set" }));
    const dialog = await screen.findByRole("dialog");
    await user.click(within(dialog).getByRole("button", { name: "Zapisz" }));
    expect(within(dialog).getByText(/Masz już 10 zapisanych setów/)).toBeInTheDocument();
    expect(within(dialog).getByRole("link", { name: "zapisanych setach" })).toHaveAttribute(
      "href",
      "/konto/sety",
    );
    expect(savedSets.list()).toHaveLength(SETS_MAX);
  });

  it("pusty set: przycisk nieaktywny", () => {
    render(wrap(<SaveSetButton {...props} k={null} m={null} p={null} />));
    expect(screen.getByRole("button", { name: "Zapisz set" })).toBeDisabled();
  });

  it("wyjatek localStorage: zapis w pamieci", async () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("SecurityError");
    });
    expect(savedSets.save({ ...props, name: "Pamiec" }).ok).toBe(true);
    expect(savedSets.list()[0]?.name).toBe("Pamiec");
    await waitFor(() => expect(savedSets.list()).toHaveLength(1));
  });
});
