// F-242, F-069 (TAKTYL-39, TAKTYL-40): items[] koszyka z wyceny (discount z rozbicia setu, promotion_name) i "Dokończ set".
import { ToastProvider } from "@taktyl/ui";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it } from "vitest";
import { CompleteSet } from "../src/components/cart/complete-set";
import { MINUS, setPercentOf } from "../src/lib/cart/messages";
import { quoteItems, quoteValueGr } from "../src/lib/cart/tracking";
import { cartStore, getCart } from "../src/lib/cart/store";
import { EMPTY_CART } from "../src/lib/cart/types";
import { fakeQuote, PROGRAMISTA, stubQuoteFetch } from "./cart-fixtures";

beforeEach(() => stubQuoteFetch());

describe("items[] z wyceny koszyka (docs/10 §3)", () => {
  const quote = fakeQuote({
    items: [
      { type: "set", id: "set-1", qty: 1, skus: [...PROGRAMISTA] },
      { type: "item", sku: "P-TFL-M-GRF", qty: 2 },
    ],
  });
  it("pozycje setu maja discount z rozbicia (suma = rabat setu) i promotion_name, pozycje poza setem discount 0", () => {
    const items = quoteItems(quote);
    expect(items).toHaveLength(4);
    const setItems = items.filter((i) => i.promotion_name);
    expect(setItems.map((i) => i.discount)).toEqual([74.9, 39.9, 18.9]);
    expect(setItems.reduce((s, i) => s + Math.round(i.discount * 100), 0)).toBe(
      quote.summary.set_discount_gr,
    );
    expect(setItems[0]?.promotion_name).toBe("Rabat za set 10%");
    expect(items[3]).toMatchObject({
      item_id: "P-TFL-M-GRF",
      quantity: 2,
      discount: 0,
      price: 69,
      item_category: "podkladki",
    });
    expect(items.every((i) => i.item_brand === "Taktyl")).toBe(true);
  });
  it("value po rabacie bez dostawy; procent setu z wyceny", () => {
    expect(quoteValueGr(quote)).toBe(120330 + 13800);
    const set = quote.lines[0];
    expect(set?.type === "set" && setPercentOf(set)).toBe(10);
    expect(MINUS).toBe("−");
  });
});

describe("Dokończ set (F-069)", () => {
  const response = {
    profile: "programowanie",
    items: [
      { sku: "K-BZL75-GRF-PRG", name: "Bazalt 75", price_gr: 74900 },
      { sku: "M-PST-GRF", name: "Pustułka", price_gr: 39900 },
      { sku: "P-SZR-XL-GRF", name: "Szron", price_gr: 18900 },
    ],
    sum_gr: 133700,
    set_discount_gr: 13370,
    total_gr: 120330,
  };

  function setup() {
    stubQuoteFetch({
      extra: (url) =>
        url.includes("/api/cart/complete-set") ? Response.json(response) : undefined,
    });
    cartStore.addItem("K-BZL75-GRF-PRG", 1);
    const cart = getCart();
    const quote = fakeQuote({ items: [{ type: "item", sku: "K-BZL75-GRF-PRG", qty: 1 }] });
    return { cart, quote };
  }

  it("pokazuje propozycje z cena po rabacie i odnosnik do kreatora", async () => {
    const { cart, quote } = setup();
    render(
      <ToastProvider>
        <CompleteSet cart={cart} quote={quote} percent={10} />
      </ToastProvider>,
    );
    expect(await screen.findByRole("heading", { name: "Dokończ set" })).toBeInTheDocument();
    expect(screen.getByText("1203,30 zł")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Otwórz w kreatorze" }).getAttribute("href")).toContain(
      "krok=podsumowanie",
    );
  });

  it("'Dodaj set do koszyka' dodaje grupe, zdejmuje jedna sztuke pozycji wyjsciowej i wysyla add_to_cart z rabatem", async () => {
    window.dataLayer = [];
    const { cart, quote } = setup();
    const user = userEvent.setup();
    render(
      <ToastProvider>
        <CompleteSet cart={cart} quote={quote} percent={10} />
      </ToastProvider>,
    );
    await user.click(await screen.findByRole("button", { name: "Dodaj set do koszyka" }));
    expect(getCart().lines.map((l) => l.type)).toEqual(["set"]);
    const ev = window.dataLayer!.find((e) => e.event === "add_to_cart") as {
      ecommerce: { value: number; items: { discount: number }[] };
    };
    expect(ev.ecommerce.value).toBe(1203.3);
    expect(ev.ecommerce.items.reduce((s, i) => s + Math.round(i.discount * 100), 0)).toBe(13370);
  });

  it("nie pokazuje sie, gdy w koszyku jest juz set albo pusty koszyk", async () => {
    stubQuoteFetch();
    const { container } = render(
      <ToastProvider>
        <CompleteSet cart={EMPTY_CART} quote={null} percent={10} />
      </ToastProvider>,
    );
    await waitFor(() => expect(container.querySelector(".koszyk-dokoncz")).toBeNull());
  });
});
