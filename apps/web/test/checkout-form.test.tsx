// F-170...F-176, F-242 (TAKTYL-41): formularz zamowienia - sekcje, pola zalezne od dostawy (S17), walidacja i fokus (S18),
// zgody niezaznaczone, brak pol kart i BLIK, wysylka z Idempotency-Key, 409 brak towaru, pomiar bez danych osobowych.
import { nipCheckDigit } from "@taktyl/domain";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { axe } from "vitest-axe";
import { CheckoutForm, type CheckoutSettings } from "../src/components/checkout/checkout-form";
import { getOrderToken } from "../src/lib/cart/order-session";
import { cartStore } from "../src/lib/cart/store";
import { readItem } from "../src/lib/storage/safe-storage";
import { PROGRAMISTA, stubQuoteFetch } from "./cart-fixtures";
import { SHOP_SETTINGS } from "./fixtures";

const push = vi.fn();
vi.mock("next/navigation", () => ({
  usePathname: () => "/zamowienie",
  useRouter: () => ({ push, replace: () => {}, back: () => {}, prefetch: () => {} }),
}));

const SETTINGS: CheckoutSettings = {
  shippingMethods: SHOP_SETTINGS.shipping_methods.map((m) => ({
    id: m.id,
    label: m.label,
    priceGr: m.price_gr,
    fields: m.fields,
    address: m.address,
  })),
  paymentMethods: SHOP_SETTINGS.payment_methods,
  pickupPoints: [
    {
      id: "WAW-001",
      city: "Warszawa",
      label: "WAW-001 · przy stacji metra (lokalizacja fikcyjna)",
    },
    { id: "KRK-001", city: "Kraków", label: "KRK-001 · dworzec (lokalizacja fikcyjna)" },
    { id: "WRO-001", city: "Wrocław", label: "WRO-001 · osiedle (lokalizacja fikcyjna)" },
  ],
  demoLabel: SHOP_SETTINGS.demo.label,
  demoEmailDomain: "taktyl.example",
};

/** Poprawny NIP generowany w ttescie (nigdy wpisany na stale, docs/12 §2). */
function validNip(): string {
  for (;;) {
    const first9 = Array.from({ length: 9 }, () => Math.floor(Math.random() * 10)).join("");
    const d = nipCheckDigit(first9);
    if (d !== null) return first9 + String(d);
  }
}
function invalidNip(nip: string): string {
  const last = (Number(nip[9]) + 1) % 10;
  return nip.slice(0, 9) + String(last);
}

let orderCalls: { headers: Record<string, string>; body: Record<string, unknown> }[] = [];
function stubAll(orderResponse?: () => Response) {
  orderCalls = [];
  return stubQuoteFetch({
    extra: (url, init) => {
      if (url.endsWith("/api/orders")) {
        orderCalls.push({
          headers: init?.headers as Record<string, string>,
          body: JSON.parse(String(init?.body)),
        });
        return (
          orderResponse?.() ??
          Response.json(
            {
              number: "TK-261007-A7B2",
              status: "pending_payment",
              order_token: "t".repeat(32),
              currency: "PLN",
              items_total_gr: 120330,
              shipping_gr: 0,
              total_gr: 120330,
              payment: { type: "blik", simulate_url: "/zamowienie/platnosc?id=TK-261007-A7B2" },
              eta: { dispatch_date: "2026-10-08", delivery_date: "2026-10-09" },
            },
            { status: 201 },
          )
        );
      }
      return undefined;
    },
  });
}

beforeEach(() => {
  push.mockClear();
  window.dataLayer = [];
  cartStore.addSet({ skus: PROGRAMISTA, profile: "programowanie", id: "set-1" });
  stubAll();
});

async function ready() {
  render(<CheckoutForm settings={SETTINGS} />);
  await screen.findByRole("button", { name: "Zamawiam i płacę" });
  await waitFor(() =>
    expect(screen.getAllByTestId("zamowienie-razem")[0]).toHaveTextContent("1203,30 zł"),
  );
}

async function fillContact(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText(/Adres e-mail/), "jan@taktyl.example");
  await user.type(screen.getByLabelText(/Telefon/), "500 000 000");
}

describe("struktura formularza (F-170, F-175, F-176)", () => {
  it("sekcje po kolei, zgody niezaznaczone, etykieta demo nad przyciskiem 'Zamawiam i płacę'", async () => {
    await ready();
    const headings = screen.getAllByText(/^[1-5]\. /).map((h) => h.textContent);
    expect(headings).toEqual(["1. Kontakt", "2. Dostawa", "3. Faktura", "4. Płatność", "5. Zgody"]);
    expect(screen.getByRole("checkbox", { name: /Akceptuję regulamin/ })).not.toBeChecked();
    expect(screen.getByRole("checkbox", { name: /newsletter/ })).not.toBeChecked();
    const demo = screen.getByTestId("zam-etykieta-demo");
    const button = screen.getByRole("button", { name: "Zamawiam i płacę" });
    expect(demo).toHaveTextContent("Taktyl to sklep demonstracyjny");
    expect(demo.compareDocumentPosition(button) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(button.textContent).toBe("Zamawiam i płacę");
  });

  it("platnosc tekstem, bez pol na dane karty, kody BLIK i hasla", async () => {
    await ready();
    const pay = screen.getByRole("group", { name: "4. Płatność" });
    expect(
      within(pay)
        .getAllByRole("radio")
        .map((r) => (r as HTMLInputElement).value),
    ).toEqual(["blik", "karta", "przelew-online", "przelew"]);
    expect(within(pay).queryAllByRole("textbox")).toHaveLength(0);
    expect(document.querySelector("input[type=password]")).toBeNull();
    expect(document.querySelector("[autocomplete^='cc-']")).toBeNull();
    expect(document.body.textContent).not.toMatch(/CVV|numer karty|kod BLIK:/i);
    expect(document.querySelector("img, svg")).toBeNull(); // bez logotypow platnosci
  });

  it("placeholder e-maila w domenie taktyl.example i ostrzezenie, ze to demo", async () => {
    await ready();
    const email = screen.getByLabelText(/Adres e-mail/);
    expect(email).toHaveAttribute("placeholder", "jan@taktyl.example");
    expect(screen.getByText(/nie wysyłamy e-maili/)).toBeInTheDocument();
  });

  it("telefon: podsumowanie zwiniete 'Pokaż podsumowanie · 1203,30 zł'", async () => {
    await ready();
    expect(screen.getByText("Pokaż podsumowanie · 1203,30 zł")).toBeInTheDocument();
  });
});

describe("pola zalezne od metody dostawy (F-171, F-172, S17)", () => {
  it("automat paczkowy: e-mail, telefon, punkt - bez pol adresu; lista punktow filtrowana po miescie", async () => {
    const user = userEvent.setup();
    await ready();
    await user.click(screen.getByRole("radio", { name: /Automat paczkowy/ }));
    expect(screen.queryByLabelText(/Ulica/)).toBeNull();
    expect(screen.queryByLabelText(/Kod pocztowy/)).toBeNull();
    expect(screen.queryByLabelText(/Miejscowość/)).toBeNull();
    expect(screen.queryByLabelText(/Imię i nazwisko/)).toBeNull();
    const list = screen.getByRole("radiogroup", { name: "Automat paczkowy" });
    expect(within(list).getAllByRole("radio")).toHaveLength(3);
    await user.type(screen.getByLabelText("Szukaj automatu po mieście"), "krak");
    expect(within(list).getAllByRole("radio")).toHaveLength(1);
    expect(within(list).getByRole("radio", { name: /KRK-001/ })).toBeInTheDocument();
    await user.clear(screen.getByLabelText("Szukaj automatu po mieście"));
    await user.type(screen.getByLabelText("Szukaj automatu po mieście"), "wroc");
    expect(within(list).getByRole("radio", { name: /WRO-001/ })).toBeInTheDocument();
    await user.clear(screen.getByLabelText("Szukaj automatu po mieście"));
    await user.type(screen.getByLabelText("Szukaj automatu po mieście"), "xyz");
    expect(
      screen.getByText("Brak automatów w tym mieście. Zmień wyszukiwanie."),
    ).toBeInTheDocument();
  });

  it("kurier: imie i nazwisko, ulica, kod pocztowy, miejscowosc; odbior: tylko imie i nazwisko", async () => {
    const user = userEvent.setup();
    await ready();
    await user.click(screen.getByRole("radio", { name: /Kurier/ }));
    for (const l of [/Imię i nazwisko/, /Ulica/, /Kod pocztowy/, /Miejscowość/]) {
      expect(screen.getByLabelText(l)).toBeInTheDocument();
    }
    expect(screen.queryByLabelText("Szukaj automatu po mieście")).toBeNull();
    await user.click(screen.getByRole("radio", { name: /Odbiór osobisty/ }));
    expect(screen.getByLabelText(/Imię i nazwisko/)).toBeInTheDocument();
    expect(screen.queryByLabelText(/Ulica/)).toBeNull();
  });
});

describe("walidacja (F-174, S18)", () => {
  it("po opuszczeniu pola: komunikat pod polem, aria-invalid i aria-describedby", async () => {
    const user = userEvent.setup();
    await ready();
    const email = screen.getByLabelText(/Adres e-mail/);
    await user.type(email, "to-nie-email");
    await user.tab();
    expect(email).toHaveAttribute("aria-invalid", "true");
    const msg = screen.getByText("Podaj adres e-mail w formacie nazwa@domena.pl.");
    expect(email.getAttribute("aria-describedby")).toContain(msg.closest("p")!.id);
    await user.clear(email);
    await user.type(email, "jan@taktyl.example");
    await user.tab();
    expect(email).not.toHaveAttribute("aria-invalid");
  });

  it("telefon: 9 cyfr, kod pocztowy 00-000", async () => {
    const user = userEvent.setup();
    await ready();
    const phone = screen.getByLabelText(/Telefon/);
    await user.type(phone, "12345");
    await user.tab();
    expect(screen.getByText(/Podaj numer telefonu: 9 cyfr/)).toBeInTheDocument();
    await user.click(screen.getByRole("radio", { name: /Kurier/ }));
    const post = screen.getByLabelText(/Kod pocztowy/);
    await user.type(post, "1234");
    await user.tab();
    expect(screen.getByText("Podaj kod pocztowy w formacie 00-000.")).toBeInTheDocument();
    await user.clear(post);
    await user.type(post, "00-000");
    await user.tab();
    expect(screen.queryByText("Podaj kod pocztowy w formacie 00-000.")).toBeNull();
  });

  it("wysylka pustego formularza: fokus na pierwszym bledzie (e-mail), zamowienie nie idzie do API", async () => {
    const user = userEvent.setup();
    await ready();
    await user.click(screen.getByRole("button", { name: "Zamawiam i płacę" }));
    expect(screen.getByLabelText(/Adres e-mail/)).toHaveFocus();
    expect(orderCalls).toHaveLength(0);
    expect(screen.getByText("Wybierz metodę dostawy.")).toBeInTheDocument();
    expect(screen.getByText("Wybierz metodę płatności.")).toBeInTheDocument();
    expect(screen.getByText("Aby złożyć zamówienie, zaakceptuj regulamin.")).toBeInTheDocument();
  });

  it("S18: faktura na firme z blednym NIP - komunikat pod polem i fokus na polu po probie wysylki", async () => {
    const user = userEvent.setup();
    await ready();
    await fillContact(user);
    await user.click(screen.getByRole("radio", { name: /Odbiór osobisty/ }));
    await user.click(screen.getByLabelText(/Imię i nazwisko/));
    await user.paste("Jan Przykładowy"); // wklejenie zamiast pisania znak po znaku: test nie przekracza 5 s w CI
    await user.click(screen.getByRole("checkbox", { name: /fakturę na firmę/ }));
    const nip = validNip();
    await user.type(screen.getByLabelText("NIP"), invalidNip(nip));
    await user.click(screen.getByLabelText("Nazwa firmy"));
    await user.paste("Firma Przykładowa");
    await user.click(screen.getByLabelText("Adres firmy"));
    await user.paste("ul. Klawiszowa 1, 00-000 Warszawa");
    await user.click(screen.getByRole("radio", { name: /BLIK/ }));
    await user.click(screen.getByRole("checkbox", { name: /Akceptuję regulamin/ }));
    await user.click(screen.getByRole("button", { name: "Zamawiam i płacę" }));
    const field = screen.getByLabelText("NIP");
    expect(field).toHaveFocus();
    expect(field).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByText(/Numer NIP jest nieprawidłowy/)).toBeInTheDocument();
    expect(orderCalls).toHaveLength(0);
    // poprawny NIP (z sumą kontrolną) przechodzi, a do API idzie sama cyfry
    await user.clear(field);
    await user.type(field, nip.slice(0, 3) + "-" + nip.slice(3));
    await user.click(screen.getByRole("button", { name: "Zamawiam i płacę" }));
    await waitFor(() => expect(orderCalls).toHaveLength(1));
    expect(orderCalls[0]?.body.invoice).toEqual({
      nip,
      name: "Firma Przykładowa",
      address: "ul. Klawiszowa 1, 00-000 Warszawa",
    });
  });
});

describe("zlozenie zamowienia (F-176, F-180)", () => {
  async function submitValid(user: ReturnType<typeof userEvent.setup>) {
    await fillContact(user);
    await user.click(screen.getByRole("radio", { name: /Automat paczkowy/ }));
    await user.click(screen.getByRole("radio", { name: /KRK-001/ }));
    await user.click(screen.getByRole("radio", { name: /BLIK/ }));
    await user.click(screen.getByRole("checkbox", { name: /Akceptuję regulamin/ }));
    await user.click(screen.getByRole("button", { name: "Zamawiam i płacę" }));
  }

  it("POST /orders z Idempotency-Key (uuid), ciagiem SKU bez cen, kwota z wyceny; token zapisany; przejscie na platnosc", async () => {
    const user = userEvent.setup();
    await ready();
    await submitValid(user);
    await waitFor(() =>
      expect(push).toHaveBeenCalledWith("/zamowienie/platnosc?id=TK-261007-A7B2"),
    );
    const call = orderCalls[0]!;
    expect(call.headers["idempotency-key"]).toMatch(/^[0-9a-f-]{36}$/);
    expect(call.body).toEqual({
      items: [
        { type: "set", id: "set-1", qty: 1, profile: "programowanie", skus: [...PROGRAMISTA] },
      ],
      coupon: null,
      contact: { email: "jan@taktyl.example", phone: "500000000" },
      shipping: { method: "automat", point: "KRK-001" },
      invoice: null,
      payment_type: "blik",
      consents: { terms: true, newsletter: false },
      expected_total_gr: 120330,
    });
    expect(JSON.stringify(call.body)).not.toMatch(/price|cena|card|karta"/i);
    expect(getOrderToken("TK-261007-A7B2")).toBe("t".repeat(32));
    // klucz idempotencji sprzatany po jednoznacznej odpowiedzi
    expect(readItem("session", "taktyl.checkout.idem.v1")).toBeNull();
  });

  it("pomiar: begin_checkout, add_shipping_info (shipping_tier), add_payment_info (payment_type); zero danych osobowych", async () => {
    const user = userEvent.setup();
    await ready();
    await submitValid(user);
    await waitFor(() => expect(push).toHaveBeenCalled());
    const names = window.dataLayer!.filter((e) => e.event).map((e) => e.event);
    expect(names).toEqual(["begin_checkout", "add_shipping_info", "add_payment_info"]);
    const ship = window.dataLayer!.find((e) => e.event === "add_shipping_info") as {
      ecommerce: { shipping_tier: string; value: number };
    };
    expect(ship.ecommerce.shipping_tier).toBe("automat");
    expect(ship.ecommerce.value).toBe(1203.3);
    const pay = window.dataLayer!.find((e) => e.event === "add_payment_info") as {
      ecommerce: { payment_type: string };
    };
    expect(pay.ecommerce.payment_type).toBe("blik");
    const all = JSON.stringify(window.dataLayer);
    expect(all).not.toMatch(/taktyl\.example|500000000|KRK-001|Jan/);
  });

  it("409 brak towaru: lista SKU i powrot do koszyka, klucz idempotencji sprzatany", async () => {
    stubAll(() =>
      Response.json(
        {
          status: 409,
          code: "out_of_stock",
          title: "Brak towaru",
          errors: [
            { path: "items[0].skus[1]", code: "out_of_stock", message: "M-PST-GRF: dostepne 0" },
          ],
        },
        { status: 409 },
      ),
    );
    const user = userEvent.setup();
    await ready();
    await submitValid(user);
    const alert = await screen.findByTestId("zam-blad-formularza");
    expect(alert).toHaveTextContent("Część produktów skończyła się");
    expect(within(alert).getByText("SKU: M-PST-GRF")).toBeInTheDocument();
    expect(within(alert).getByRole("link", { name: "Wróć do koszyka" })).toHaveAttribute(
      "href",
      "/koszyk",
    );
    expect(push).not.toHaveBeenCalled();
    expect(readItem("session", "taktyl.checkout.idem.v1")).toBeNull();
  });

  it("blad sieci: dane zostaja, ten sam klucz idempotencji przy ponowieniu", async () => {
    let first = true;
    stubQuoteFetch({
      extra: (url, init) => {
        if (!url.endsWith("/api/orders")) return undefined;
        orderCalls.push({ headers: init?.headers as Record<string, string>, body: {} });
        if (first) {
          first = false;
          throw new TypeError("offline");
        }
        return Response.json(
          {
            number: "TK-261007-A7B2",
            status: "pending_payment",
            order_token: "t".repeat(32),
            currency: "PLN",
            items_total_gr: 1,
            shipping_gr: 0,
            total_gr: 1,
            payment: { type: "blik", simulate_url: "/x" },
            eta: { dispatch_date: "2026-10-08", delivery_date: "2026-10-09" },
          },
          { status: 201 },
        );
      },
    });
    orderCalls = [];
    const user = userEvent.setup();
    await ready();
    await submitValid(user);
    expect(await screen.findByText(/Nie udało się złożyć zamówienia/)).toBeInTheDocument();
    expect(screen.getByLabelText(/Adres e-mail/)).toHaveValue("jan@taktyl.example");
    await user.click(screen.getByRole("button", { name: "Zamawiam i płacę" }));
    await waitFor(() => expect(push).toHaveBeenCalled());
    expect(orderCalls[0]?.headers["idempotency-key"]).toBe(
      orderCalls[1]?.headers["idempotency-key"],
    );
  });

  it("blad 422 z serwera: komunikat przy polu z mapowania sciezki i fokus", async () => {
    stubAll(() =>
      Response.json(
        {
          status: 422,
          code: "validation_failed",
          title: "x",
          errors: [
            { path: "contact.email", code: "email", message: "Serwer nie przyjął tego adresu." },
          ],
        },
        { status: 422 },
      ),
    );
    const user = userEvent.setup();
    await ready();
    await submitValid(user);
    expect(await screen.findByText("Serwer nie przyjął tego adresu.")).toBeInTheDocument();
    expect(screen.getByLabelText(/Adres e-mail/)).toHaveFocus();
  });
});

describe("dostepnosc", () => {
  it("axe: formularz z automatem, faktura i bledami", async () => {
    const user = userEvent.setup();
    const { container } = render(<CheckoutForm settings={SETTINGS} />);
    await screen.findByRole("button", { name: "Zamawiam i płacę" });
    await user.click(screen.getByRole("radio", { name: /Automat paczkowy/ }));
    await user.click(screen.getByRole("checkbox", { name: /fakturę na firmę/ }));
    await user.click(screen.getByRole("button", { name: "Zamawiam i płacę" }));
    expect(await axe(container)).toHaveNoViolations();
  });
});
