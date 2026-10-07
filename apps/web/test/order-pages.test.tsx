// F-177...F-180, F-242 (TAKTYL-42): symulacja platnosci, potwierdzenie, blad platnosci; S19, S20.
// `purchase` raz na transaction_id, koszyk czyszczony dopiero po paid, token zamowienia z przegladarki, zero pol kart i BLIK.
import type { OrderDetail } from "@taktyl/contracts";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { axe } from "vitest-axe";
import {
  ConfirmationPage,
  FailurePage,
  PaymentPage,
  type OrderPageSettings,
} from "../src/components/checkout/order-pages";
import { saveOrderToken } from "../src/lib/cart/order-session";
import { cartStore, getCart } from "../src/lib/cart/store";
import { resetMemoryStorage } from "../src/lib/storage/safe-storage";
import { PROGRAMISTA } from "./cart-fixtures";

const push = vi.fn();
const replace = vi.fn();
vi.mock("next/navigation", () => ({
  usePathname: () => "/zamowienie/platnosc",
  useRouter: () => ({ push, replace, back: () => {}, prefetch: () => {} }),
}));

const NUMBER = "TK-261007-A7B2";
const TOKEN = "t".repeat(32);
const SETTINGS: OrderPageSettings = {
  paymentLabels: {
    blik: "BLIK",
    karta: "Karta płatnicza",
    "przelew-online": "Szybki przelew",
    przelew: "Przelew tradycyjny",
  },
  shippingLabels: {
    automat: "Automat paczkowy",
    kurier: "Kurier",
    odbior: "Odbiór osobisty (Warszawa)",
  },
  shippingAddresses: {
    automat: null,
    kurier: null,
    odbior: "ul. Klawiszowa 87, 00-000 Warszawa (adres fikcyjny)",
  },
  timeZone: "Europe/Warsaw",
  demoLabel: "Taktyl to sklep demonstracyjny. Nie realizujemy zamówień i nie pobieramy płatności.",
};

function order(status: OrderDetail["status"]): OrderDetail {
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
        variant_label: "Grafit / Próg",
        qty: 1,
        unit_price_gr: 74900,
        set_discount_gr: 7490,
        coupon_discount_gr: 0,
      },
      {
        group_id: "set-1",
        sku: "M-PST-GRF",
        name: "Pustułka",
        variant_label: "Grafit",
        qty: 1,
        unit_price_gr: 39900,
        set_discount_gr: 3990,
        coupon_discount_gr: 0,
      },
      {
        group_id: "set-1",
        sku: "P-SZR-XL-GRF",
        name: "Szron",
        variant_label: "XL / Grafit",
        qty: 1,
        unit_price_gr: 18900,
        set_discount_gr: 1890,
        coupon_discount_gr: 0,
      },
    ],
    items_gr: 133700,
    set_discount_gr: 13370,
    coupon_discount_gr: 0,
    shipping_gr: 0,
    total_gr: 120330,
    coupon_code: null,
    shipping_method: "automat",
    payment: {
      type: "blik",
      status: status === "paid" ? "paid" : status === "payment_failed" ? "failed" : "created",
      attempts: 0,
    },
    eta: { dispatch_date: "2026-10-08", delivery_date: "2026-10-09" },
  };
}

let current: OrderDetail;
let simulated: { outcome: string; token: string | null }[] = [];
function stubApi(initial: OrderDetail["status"]) {
  current = order(initial);
  simulated = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const headers = (init?.headers ?? {}) as Record<string, string>;
      if (url.endsWith(`/api/orders/${NUMBER}`)) {
        if (headers["x-order-token"] !== TOKEN)
          return Response.json({ status: 401 }, { status: 401 });
        return Response.json(current);
      }
      if (url.endsWith(`/api/orders/${NUMBER}/payment`)) {
        const outcome = JSON.parse(String(init?.body)).outcome as "paid" | "failed";
        simulated.push({ outcome, token: headers["x-order-token"] ?? null });
        current = order(outcome === "paid" ? "paid" : "payment_failed");
        return Response.json({
          status: outcome === "paid" ? "paid" : "payment_failed",
          transaction_id: NUMBER,
        });
      }
      return new Response("{}", { status: 404 });
    }),
  );
}

const purchases = () => (window.dataLayer ?? []).filter((e) => e.event === "purchase");

beforeEach(() => {
  push.mockClear();
  replace.mockClear();
  window.dataLayer = [];
  saveOrderToken(NUMBER, TOKEN);
  cartStore.addSet({ skus: PROGRAMISTA, profile: "programowanie", id: "set-1" });
});

describe("platnosc (F-177)", () => {
  it("numer, metoda, kwota, dwa przyciski symulacji i zero pol kart i BLIK", async () => {
    stubApi("pending_payment");
    render(<PaymentPage number={NUMBER} settings={SETTINGS} />);
    expect(await screen.findByTestId("platnosc-kwota")).toHaveTextContent("1203,30 zł");
    expect(screen.getByTestId("numer-zamowienia")).toHaveTextContent(NUMBER);
    expect(screen.getByText("BLIK")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Symuluj udaną płatność" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Symuluj odrzuconą płatność" })).toBeInTheDocument();
    expect(screen.queryAllByRole("textbox")).toHaveLength(0);
    expect(document.querySelector("input")).toBeNull();
    expect(screen.getByText(/nie wpisujesz tu danych karty ani kodu BLIK/)).toBeInTheDocument();
    expect(screen.getByText(/Taktyl to sklep demonstracyjny/)).toBeInTheDocument();
  });

  it("odrzucona platnosc: token w naglowku, payment_failed, przejscie na blad, koszyk nietkniety", async () => {
    stubApi("pending_payment");
    const user = userEvent.setup();
    render(<PaymentPage number={NUMBER} settings={SETTINGS} />);
    await user.click(await screen.findByRole("button", { name: "Symuluj odrzuconą płatność" }));
    await waitFor(() =>
      expect(push).toHaveBeenCalledWith(`/zamowienie/blad-platnosci?id=${NUMBER}`),
    );
    expect(simulated).toEqual([{ outcome: "failed", token: TOKEN }]);
    const ev = window.dataLayer!.find((e) => e.event === "payment_failed") as Record<
      string,
      unknown
    >;
    expect(ev).toMatchObject({ transaction_id: NUMBER, payment_type: "blik", value: 1203.3 });
    expect(getCart().lines).toHaveLength(1);
    expect(purchases()).toHaveLength(0);
  });

  it("udana platnosc: przejscie na potwierdzenie (koszyk czyszczony dopiero tam)", async () => {
    stubApi("pending_payment");
    const user = userEvent.setup();
    render(<PaymentPage number={NUMBER} settings={SETTINGS} />);
    await user.click(await screen.findByRole("button", { name: "Symuluj udaną płatność" }));
    await waitFor(() =>
      expect(push).toHaveBeenCalledWith(`/zamowienie/potwierdzenie?id=${NUMBER}`),
    );
    expect(simulated[0]?.outcome).toBe("paid");
    expect(getCart().lines).toHaveLength(1);
  });

  it("brak tokenu w tej przegladarce: komunikat i powrot do koszyka", async () => {
    stubApi("pending_payment");
    window.localStorage.clear();
    resetMemoryStorage();
    render(<PaymentPage number={NUMBER} settings={SETTINGS} />);
    expect(
      await screen.findByRole("heading", { name: "Nie znaleziono zamówienia" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Wróć do koszyka" })).toHaveAttribute(
      "href",
      "/koszyk",
    );
  });

  it("oplacone zamowienie na stronie platnosci przekierowuje na potwierdzenie", async () => {
    stubApi("paid");
    render(<PaymentPage number={NUMBER} settings={SETTINGS} />);
    await waitFor(() =>
      expect(replace).toHaveBeenCalledWith(`/zamowienie/potwierdzenie?id=${NUMBER}`),
    );
  });
});

describe("potwierdzenie (F-178, F-180, S19, S20)", () => {
  it("numer, pozycje, dostawa, termin, co dalej; purchase raz z poprawnymi liczbami; koszyk wyczyszczony", async () => {
    stubApi("paid");
    render(<ConfirmationPage number={NUMBER} settings={SETTINGS} />);
    expect(
      await screen.findByRole("heading", { name: "Dziękujemy za zamówienie" }),
    ).toBeInTheDocument();
    expect(screen.getByTestId("numer-zamowienia")).toHaveTextContent(NUMBER);
    expect(screen.getByText(/Bazalt 75/)).toBeInTheDocument();
    expect(
      screen.getByText(/Wyślemy: czwartek, 8 października\. Dostawa: piątek, 9 października\./),
    ).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Co dalej" })).toBeInTheDocument();
    await waitFor(() => expect(purchases()).toHaveLength(1));
    const p = purchases()[0] as {
      ecommerce: {
        transaction_id: string;
        value: number;
        shipping: number;
        tax: number;
        items: { discount: number }[];
      };
    };
    expect(p.ecommerce).toMatchObject({
      transaction_id: NUMBER,
      value: 1203.3,
      shipping: 0,
      tax: 225.01,
    });
    expect(p.ecommerce.items.reduce((s, i) => s + Math.round(i.discount * 100), 0)).toBe(13370);
    expect(getCart().lines).toHaveLength(0);
  });

  it("S20: odswiezenie potwierdzenia nie wysyla drugiego purchase i nie kasuje nowego koszyka", async () => {
    stubApi("paid");
    const first = render(<ConfirmationPage number={NUMBER} settings={SETTINGS} />);
    await waitFor(() => expect(purchases()).toHaveLength(1));
    first.unmount();
    cartStore.addItem("P-TFL-M-GRF", 1); // nowe zakupy po zamowieniu
    render(<ConfirmationPage number={NUMBER} settings={SETTINGS} />);
    await screen.findByRole("heading", { name: "Dziękujemy za zamówienie" });
    expect(purchases()).toHaveLength(1);
    expect(getCart().lines).toEqual([{ type: "item", sku: "P-TFL-M-GRF", qty: 1 }]);
  });

  it("zamowienie nieoplacone nie liczy purchase i nie czysci koszyka (przekierowanie na platnosc)", async () => {
    stubApi("pending_payment");
    render(<ConfirmationPage number={NUMBER} settings={SETTINGS} />);
    await waitFor(() => expect(replace).toHaveBeenCalledWith(`/zamowienie/platnosc?id=${NUMBER}`));
    expect(purchases()).toHaveLength(0);
    expect(getCart().lines).toHaveLength(1);
  });

  it("zamowienie z bledem platnosci przekierowuje na blad i nie czysci koszyka", async () => {
    stubApi("payment_failed");
    render(<ConfirmationPage number={NUMBER} settings={SETTINGS} />);
    await waitFor(() =>
      expect(replace).toHaveBeenCalledWith(`/zamowienie/blad-platnosci?id=${NUMBER}`),
    );
    expect(purchases()).toHaveLength(0);
    expect(getCart().lines).toHaveLength(1);
  });

  it("axe: strona potwierdzenia", async () => {
    stubApi("paid");
    const { container } = render(<ConfirmationPage number={NUMBER} settings={SETTINGS} />);
    await screen.findByRole("heading", { name: "Dziękujemy za zamówienie" });
    expect(await axe(container)).toHaveNoViolations();
  });
});

describe("blad platnosci (F-179)", () => {
  it("co sie stalo, 'Spróbuj ponownie' wraca na platnosc z add_payment_info, 'Zmień metodę płatności'; koszyk nie czyszczony", async () => {
    stubApi("payment_failed");
    const user = userEvent.setup();
    render(<FailurePage number={NUMBER} settings={SETTINGS} />);
    expect(
      await screen.findByRole("heading", { name: "Płatność nie powiodła się" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Zmień metodę płatności" })).toHaveAttribute(
      "href",
      "/zamowienie",
    );
    await user.click(screen.getByRole("button", { name: "Spróbuj ponownie" }));
    expect(push).toHaveBeenCalledWith(`/zamowienie/platnosc?id=${NUMBER}`);
    const ev = window.dataLayer!.find((e) => e.event === "add_payment_info") as {
      ecommerce: { payment_type: string; value: number };
    };
    expect(ev.ecommerce).toMatchObject({ payment_type: "blik", value: 1203.3 });
    expect(getCart().lines).toHaveLength(1);
  });

  it("S19: odrzucona -> ponowna proba -> udana: jeden purchase, koszyk pusty", async () => {
    stubApi("pending_payment");
    const user = userEvent.setup();
    const pay = render(<PaymentPage number={NUMBER} settings={SETTINGS} />);
    await user.click(await screen.findByRole("button", { name: "Symuluj odrzuconą płatność" }));
    await waitFor(() =>
      expect(push).toHaveBeenCalledWith(`/zamowienie/blad-platnosci?id=${NUMBER}`),
    );
    pay.unmount();
    const fail = render(<FailurePage number={NUMBER} settings={SETTINGS} />);
    await user.click(await screen.findByRole("button", { name: "Spróbuj ponownie" }));
    fail.unmount();
    const again = render(<PaymentPage number={NUMBER} settings={SETTINGS} />);
    await user.click(await screen.findByRole("button", { name: "Symuluj udaną płatność" }));
    await waitFor(() =>
      expect(push).toHaveBeenCalledWith(`/zamowienie/potwierdzenie?id=${NUMBER}`),
    );
    again.unmount();
    render(<ConfirmationPage number={NUMBER} settings={SETTINGS} />);
    await screen.findByRole("heading", { name: "Dziękujemy za zamówienie" });
    expect(simulated.map((s) => s.outcome)).toEqual(["failed", "paid"]);
    await waitFor(() => expect(purchases()).toHaveLength(1));
    expect(
      window
        .dataLayer!.map((e) => e.event)
        .filter((e) => ["payment_failed", "add_payment_info", "purchase"].includes(String(e))),
    ).toEqual(["payment_failed", "add_payment_info", "purchase"]);
    expect(getCart().lines).toHaveLength(0);
  });
});
