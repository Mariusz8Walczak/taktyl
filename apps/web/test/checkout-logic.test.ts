// F-171, F-173, F-174, F-178, F-180, F-242 (TAKTYL-41, TAKTYL-42): logika kasy bez Reacta - walidacja, tresc zamowienia,
// klucz idempotencji i token zamowienia, parametry purchase / payment_failed z zamowienia API.
import type { OrderDetail } from "@taktyl/contracts";
import { describe, expect, it } from "vitest";
import {
  EMPTY_CHECKOUT,
  buildOrderBody,
  fieldsOf,
  firstError,
  normalizePhone,
  validateAll,
  validateField,
} from "../src/lib/cart/checkout-validation";
import {
  clearIdempotencyKey,
  getIdempotencyKey,
  getOrderToken,
  saveOrderToken,
} from "../src/lib/cart/order-session";
import { orderValueGr, paymentFailedParams, purchaseParams } from "../src/lib/cart/order-tracking";
import { SHOP_SETTINGS } from "./fixtures";

const METHODS = SHOP_SETTINGS.shipping_methods;

describe("normalizePhone", () => {
  it("9 cyfr, spacje, myslniki i +48 dopuszczone; reszta odrzucona", () => {
    expect(normalizePhone("500 000 000")).toBe("500000000");
    expect(normalizePhone("+48 500-000-000")).toBe("500000000");
    expect(normalizePhone("50000000")).toBeNull();
    expect(normalizePhone("5000000000")).toBeNull();
    expect(normalizePhone("abc")).toBeNull();
  });
});

describe("pola wg metody dostawy z ustawien (F-171)", () => {
  it("automat: punkt, bez adresu; kurier: imie, ulica, kod, miasto; odbior: imie", () => {
    expect(fieldsOf(METHODS, "automat")).toEqual(["email", "phone", "point"]);
    expect(fieldsOf(METHODS, "kurier")).toContain("street");
    expect(fieldsOf(METHODS, "odbior")).toContain("name");
    expect(fieldsOf(METHODS, "odbior")).not.toContain("street");
    expect(fieldsOf(METHODS, "brak")).toEqual([]);
  });

  it("automat nie wymaga pol adresu, kurier tak", () => {
    const base = {
      ...EMPTY_CHECKOUT,
      email: "jan@taktyl.example",
      phone: "500000000",
      payment: "blik",
      terms: true,
    };
    const automat = validateAll(
      { ...base, shipping: "automat", point: "WAW-001" },
      fieldsOf(METHODS, "automat"),
    );
    expect(automat).toEqual({});
    const kurier = validateAll({ ...base, shipping: "kurier" }, fieldsOf(METHODS, "kurier"));
    expect(Object.keys(kurier)).toEqual(["name", "street", "postcode", "city"]);
    expect(firstError(kurier)).toBe("name");
  });
});

describe("walidacja pol", () => {
  const f = fieldsOf(METHODS, "kurier");
  it("kod pocztowy 00-000, e-mail, zgoda regulaminu", () => {
    expect(validateField("postcode", { ...EMPTY_CHECKOUT, postcode: "00-000" }, f)).toBeNull();
    expect(validateField("postcode", { ...EMPTY_CHECKOUT, postcode: "00000" }, f)).toMatch(
      /00-000/,
    );
    expect(validateField("email", { ...EMPTY_CHECKOUT, email: "a@b" }, f)).toBeTruthy();
    expect(validateField("terms", EMPTY_CHECKOUT, f)).toMatch(/regulamin/);
  });
  it("pola faktury sprawdzane tylko przy zaznaczonej fakturze", () => {
    expect(validateField("nip", { ...EMPTY_CHECKOUT, nip: "123" }, f)).toBeNull();
    expect(validateField("nip", { ...EMPTY_CHECKOUT, invoice: true, nip: "123" }, f)).toMatch(
      /NIP/,
    );
  });
});

describe("tresc zamowienia (docs/16 §6.2)", () => {
  it("bez pol kart, BLIK i hasel; adres tylko dla kuriera; kwota oczekiwana z wyceny", () => {
    const v = {
      ...EMPTY_CHECKOUT,
      email: " jan@taktyl.example ",
      phone: "+48 500 000 000",
      shipping: "kurier",
      name: "Jan Przykładowy",
      street: "ul. Przykładowa 1",
      postcode: "00-000",
      city: "Warszawa",
      payment: "karta",
      terms: true,
    };
    const body = buildOrderBody({
      values: v,
      fields: fieldsOf(METHODS, "kurier"),
      items: [],
      coupon: "TAKTYL10",
      expectedTotalGr: 126540,
    });
    expect(body).toEqual({
      items: [],
      coupon: "TAKTYL10",
      contact: { email: "jan@taktyl.example", phone: "500000000" },
      shipping: {
        method: "kurier",
        name: "Jan Przykładowy",
        street: "ul. Przykładowa 1",
        postcode: "00-000",
        city: "Warszawa",
      },
      invoice: null,
      payment_type: "karta",
      consents: { terms: true, newsletter: false },
      expected_total_gr: 126540,
    });
  });
});

describe("klucz idempotencji i token zamowienia", () => {
  it("ta sama proba = ten sam uuid, po wyczyszczeniu nowy", () => {
    const a = getIdempotencyKey();
    expect(a).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    expect(getIdempotencyKey()).toBe(a);
    clearIdempotencyKey();
    expect(getIdempotencyKey()).not.toBe(a);
  });
  it("zapis zamowien: token po numerze, ostatnie 10, bez danych osobowych", () => {
    for (let i = 0; i < 12; i++)
      saveOrderToken(`TK-261007-A${String(i).padStart(3, "0")}`, `token-${i}-xxxxxxxxxxxxxxxx`);
    expect(getOrderToken("TK-261007-A000")).toBeNull();
    expect(getOrderToken("TK-261007-A011")).toBe("token-11-xxxxxxxxxxxxxxxx");
    expect(window.localStorage.getItem("taktyl.orders.v1")).not.toMatch(/@|email|phone/i);
  });
});

const ORDER: OrderDetail = {
  number: "TK-261007-A7B2",
  status: "paid",
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
    {
      group_id: null,
      sku: "P-TFL-M-GRF",
      name: "Tafla",
      variant_label: "M / Grafit",
      qty: 1,
      unit_price_gr: 6900,
      set_discount_gr: 0,
      coupon_discount_gr: 690,
    },
  ],
  items_gr: 140600,
  set_discount_gr: 13370,
  coupon_discount_gr: 690,
  shipping_gr: 0,
  total_gr: 126540,
  coupon_code: "TAKTYL10",
  shipping_method: "automat",
  payment: { type: "blik", status: "paid", attempts: 2 },
  eta: { dispatch_date: "2026-10-08", delivery_date: "2026-10-09" },
};

describe("purchase i payment_failed z zamowienia (docs/10 §4)", () => {
  it("value po rabatach bez dostawy, tax = value * 23 / 123, discount setu w pozycjach, coupon", () => {
    expect(orderValueGr(ORDER)).toBe(126540);
    const p = purchaseParams(ORDER);
    expect(p).toMatchObject({
      transaction_id: "TK-261007-A7B2",
      currency: "PLN",
      value: 1265.4,
      shipping: 0,
      tax: 236.62,
      coupon: "TAKTYL10",
    });
    expect(p.items).toHaveLength(4);
    const setItems = p.items.filter((i) => i.promotion_name);
    expect(setItems.reduce((s, i) => s + Math.round(i.discount * 100), 0)).toBe(13370);
    expect(setItems[0]?.promotion_name).toBe("Rabat za set 10%");
    expect(p.items[3]).toMatchObject({ discount: 0, item_variant: "M / Grafit" });
  });
  it("payment_failed: numer, typ platnosci, wartosc", () => {
    expect(paymentFailedParams(ORDER)).toEqual({
      transaction_id: "TK-261007-A7B2",
      payment_type: "blik",
      value: 1265.4,
    });
  });
});
