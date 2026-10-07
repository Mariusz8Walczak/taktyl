// F-170, F-176, F-157 (TAKTYL-80): "Zamawiam i placze" przed pierwsza wycena koszyka - widoczny powod i stan ladowania
// (aria-busy, aria-describedby), zamowienie czeka w kolejce i rusza po wycenie; blad wyceny = komunikat i "Spróbuj ponownie".
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { CheckoutForm, type CheckoutSettings } from "../src/components/checkout/checkout-form";
import { cartStore } from "../src/lib/cart/store";
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
    { id: "KRK-001", city: "Kraków", label: "KRK-001 · dworzec (lokalizacja fikcyjna)" },
  ],
  demoLabel: SHOP_SETTINGS.demo.label,
  demoEmailDomain: "taktyl.example",
};

let orderCalls = 0;
let failing = false;
// Bramka wyceny: dopoki test jej nie otworzy, POST /api/cart/quote wisi (bez zaleznosci od czasu).
let openGate: () => void = () => {};
function stub(gated: boolean) {
  orderCalls = 0;
  const gate = gated ? new Promise<void>((r) => (openGate = r)) : Promise.resolve();
  const stubbed = stubQuoteFetch({
    fail: () => failing,
    extra: (url) => {
      if (!url.endsWith("/api/orders")) return undefined;
      orderCalls += 1;
      return Response.json(
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
      );
    },
  });
  const inner = stubbed.fn.getMockImplementation();
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      if (String(input).endsWith("/api/cart/quote")) await gate;
      return inner?.(input, init);
    }),
  );
}

async function fillAll(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText(/Adres e-mail/), "jan@taktyl.example");
  await user.type(screen.getByLabelText(/Telefon/), "500 000 000");
  await user.click(screen.getByRole("radio", { name: /Automat paczkowy/ }));
  await user.click(screen.getByRole("radio", { name: /KRK-001/ }));
  await user.click(screen.getByRole("radio", { name: /BLIK/ }));
  await user.click(screen.getByRole("checkbox", { name: /Akceptuję regulamin/ }));
}

beforeEach(() => {
  push.mockClear();
  failing = false;
  cartStore.addSet({ skus: PROGRAMISTA, profile: "programowanie", id: "set-1" });
});

describe("TAKTYL-80: klikniecie przed wycena", () => {
  it("pokazuje powod i stan ladowania, nie wysyla; po wycenie wysyla jedno zamowienie", async () => {
    stub(true);
    const user = userEvent.setup();
    render(<CheckoutForm settings={SETTINGS} />);
    const button = await screen.findByRole("button", { name: "Zamawiam i płacę" });
    expect(screen.getByText("Czekamy na wycenę koszyka...")).toBeInTheDocument();
    expect(button).not.toHaveAttribute("aria-busy"); // jeszcze nie kliknieto: powod jest w tresci i opisie
    const reason = screen.getByText("Czekamy na wycenę koszyka...");
    expect(button.getAttribute("aria-describedby")).toBe(reason.id);

    await fillAll(user);
    await user.click(button);
    expect(orderCalls).toBe(0);
    expect(button).toHaveAttribute("aria-busy", "true");
    expect(button).toHaveAttribute("aria-disabled", "true");
    expect(screen.getByText("Czekamy na wycenę koszyka...")).toBeInTheDocument();

    openGate(); // wycena wraca: zamowienie z kolejki rusza samo
    await waitFor(() => expect(orderCalls).toBe(1));
    await waitFor(() =>
      expect(push).toHaveBeenCalledWith("/zamowienie/platnosc?id=TK-261007-A7B2"),
    );
    expect(orderCalls).toBe(1);
  });

  it("po wycenie przycisk nie jest zajety i wysyla od razu", async () => {
    stub(false);
    const user = userEvent.setup();
    render(<CheckoutForm settings={SETTINGS} />);
    const button = await screen.findByRole("button", { name: "Zamawiam i płacę" });
    await waitFor(() => expect(button).not.toHaveAttribute("aria-busy"));
    await waitFor(() => expect(screen.queryByText("Czekamy na wycenę koszyka...")).toBeNull());
    await fillAll(user);
    await waitFor(() => expect(button).not.toHaveAttribute("aria-busy"));
    await user.click(button);
    await waitFor(() => expect(orderCalls).toBe(1));
  });

  it("blad wyceny: komunikat, wylaczony przycisk i 'Spróbuj ponownie' wznawia wycene", async () => {
    stub(false);
    failing = true;
    const user = userEvent.setup();
    render(<CheckoutForm settings={SETTINGS} />);
    const retry = await screen.findByRole("button", { name: "Spróbuj ponownie" });
    expect(screen.getByRole("alert")).toHaveTextContent(/Nie udało się sprawdzić cen/);
    const submit = screen.getByRole("button", { name: "Zamawiam i płacę" });
    expect(submit).toBeDisabled();
    expect(submit.getAttribute("aria-describedby")).toBeTruthy();

    failing = false;
    await user.click(retry);
    await waitFor(() =>
      expect(screen.queryByRole("button", { name: "Spróbuj ponownie" })).toBeNull(),
    );
    await waitFor(() => expect(submit).toBeEnabled());
    expect(submit).not.toHaveAttribute("aria-busy");
  });
});
