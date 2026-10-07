// F-150...F-157, F-024 (B-218): integracyjne testy wyceny koszyka - S12-S16 z docs/12 i przyklad z docs/16 par. 6.1.
import { problemSchema, quoteResponseSchema } from "@taktyl/contracts";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { bootApp, hasDb, type TestEnv } from "./helpers.js";

const SET = {
  type: "set",
  id: "set-1696676400000",
  qty: 1,
  profile: "programowanie",
  skus: ["K-BZL75-GRF-PRG", "M-PST-GRF", "P-SZR-XL-GRF"],
};
const TAFLA = { type: "item", sku: "P-TFL-M-GRF", qty: 1 };
const WROBEL = { type: "item", sku: "M-WRB-GRF", qty: 1 };

describe.skipIf(!hasDb)("B-218 wycena koszyka (PostgreSQL)", () => {
  let t: TestEnv;
  beforeAll(async () => {
    t = await bootApp();
  });
  afterAll(async () => {
    await t.close();
  });

  const quote = async (body: unknown) => {
    const res = await t
      .http()
      .post("/v1/cart/quote")
      .send(body as object)
      .expect(200);
    return { res, body: quoteResponseSchema.parse(res.body) };
  };

  it("S12: set Programista = 1203,30 zl, rabat 133,70 zl, dostawa darmowa; bez cache", async () => {
    const { res, body } = await quote({ items: [SET] });
    expect(body.summary).toMatchObject({
      products_gr: 133700,
      set_discount_gr: 13370,
      coupon_discount_gr: 0,
      total_gr: 120330,
      free_shipping_remaining_gr: 0,
    });
    expect(res.headers["cache-control"]).toBe("no-store");
    const line = body.lines[0];
    expect(line?.type).toBe("set");
    if (line?.type === "set") {
      expect(line.items.map((i) => i.set_discount_gr)).toEqual([7490, 3990, 1890]);
      expect(line.items.every((i) => i.available)).toBe(true);
    }
    expect(body.problems).toEqual([]);
  });

  it("S13: TAKTYL10 przy samym secie nie obejmuje setow", async () => {
    const { body } = await quote({ items: [SET], coupon: "TAKTYL10" });
    expect(body.summary.coupon_discount_gr).toBe(0);
    expect(body.summary.total_gr).toBe(120330);
    expect(body.coupon).toEqual({
      code: "TAKTYL10",
      applied: false,
      message_code: "coupon_not_for_sets",
    });
  });

  it("S14: + Tafla M Grafit i TAKTYL10: kod -6,90 zl, razem 1265,40 zl (przyklad z docs/16)", async () => {
    const { body } = await quote({ items: [SET, TAFLA], coupon: "TAKTYL10" });
    expect(body.summary).toEqual({
      products_gr: 140600,
      set_discount_gr: 13370,
      coupon_discount_gr: 690,
      shipping_from_gr: 1299,
      total_gr: 126540,
      free_shipping_remaining_gr: 0,
    });
    expect(body.coupon).toEqual({
      code: "TAKTYL10",
      applied: true,
      message_code: "coupon_applies_outside_sets",
    });
    const item = body.lines[1];
    expect(item).toMatchObject({
      type: "item",
      sku: "P-TFL-M-GRF",
      price_gr: 6900,
      coupon_discount_gr: 690,
    });
  });

  it("S16: koszyk z samym Wrobelem - brakuje 170,00 zl do darmowej dostawy", async () => {
    const { body } = await quote({ items: [WROBEL] });
    expect(body.summary.products_gr).toBe(12900);
    expect(body.summary.free_shipping_remaining_gr).toBe(17000);
  });

  it("dostawa: wybrana metoda dolicza cene, DOSTAWA0 i prog zwalniaja", async () => {
    const paid = await quote({ items: [WROBEL], shipping_method: "kurier" });
    expect(paid.body.summary.total_gr).toBe(12900 + 1699);
    const code = await quote({ items: [WROBEL], shipping_method: "kurier", coupon: "DOSTAWA0" });
    expect(code.body.summary.total_gr).toBe(12900);
    expect(code.body.summary.free_shipping_remaining_gr).toBe(0);
    expect(code.body.coupon).toEqual({
      code: "DOSTAWA0",
      applied: true,
      message_code: "coupon_free_shipping",
    });
    const free = await quote({ items: [SET], shipping_method: "kurier" });
    expect(free.body.summary.total_gr).toBe(120330);
  });

  it("nieznany kod: applied false, nieznany SKU: problem unknown_sku (200, nie 404)", async () => {
    const { body } = await quote({
      items: [WROBEL, { type: "item", sku: "M-ZZZ-GRF", qty: 1 }],
      coupon: "NIEMA",
    });
    expect(body.coupon).toEqual({ code: "NIEMA", applied: false, message_code: "coupon_unknown" });
    expect(body.problems).toEqual([{ sku: "M-ZZZ-GRF", code: "unknown_sku" }]);
    expect(body.lines).toHaveLength(1);
  });

  it("brak towaru (K-BZL75-KOB-SZP) i ilosc ponad stan zwracaja liste SKU w problems", async () => {
    const { body } = await quote({
      items: [
        { type: "item", sku: "K-BZL75-KOB-SZP", qty: 1 },
        { type: "item", sku: "M-JRZ-MGL", qty: 3 },
      ],
    });
    expect(body.problems).toEqual([
      { sku: "K-BZL75-KOB-SZP", code: "out_of_stock", available_qty: 0 },
      { sku: "M-JRZ-MGL", code: "out_of_stock", available_qty: 2 },
    ]);
    expect(body.lines.every((l) => l.type !== "item" || !l.available)).toBe(true);
  });

  it("zapotrzebowanie liczone lacznie: ten sam SKU w secie i osobno", async () => {
    const { body } = await quote({
      items: [
        { ...SET, skus: ["K-BZL75-GRF-PRG", "M-JRZ-MGL", "P-SZR-XL-GRF"] },
        { type: "item", sku: "M-JRZ-MGL", qty: 2 },
      ],
    });
    expect(body.problems).toEqual([{ sku: "M-JRZ-MGL", code: "out_of_stock", available_qty: 2 }]);
  });

  it("nie ufa klientowi: ceny i nieznane pola w zadaniu sa odrzucane (422 problem+json)", async () => {
    const res = await t
      .http()
      .post("/v1/cart/quote")
      .send({ items: [{ type: "item", sku: "M-WRB-GRF", qty: 1, price_gr: 1 }] })
      .expect(422);
    expect(res.headers["content-type"]).toContain("application/problem+json");
    const p = problemSchema.parse(res.body);
    expect(p.code).toBe("validation_failed");
    await t
      .http()
      .post("/v1/cart/quote")
      .send({ items: [{ type: "item", sku: "M-WRB-GRF", qty: 11 }] })
      .expect(422);
    await t.http().post("/v1/cart/quote").send({ items: [] }).expect(422);
    await t
      .http()
      .post("/v1/cart/quote")
      .send({ items: [WROBEL], total_gr: 1 })
      .expect(422);
  });

  it("zepsuty JSON: 400 problem+json", async () => {
    const res = await t
      .http()
      .post("/v1/cart/quote")
      .set("Content-Type", "application/json")
      .send("{zly")
      .expect(400);
    expect(problemSchema.parse(res.body).code).toBe("validation_failed");
  });
});
