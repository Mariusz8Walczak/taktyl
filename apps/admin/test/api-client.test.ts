// B-003, docs/16 par. 1 (TAKTYL-50): testy kontraktowe klienta API - odpowiedzi parsowane schematami z @taktyl/contracts,
// naglowki CSRF i If-Match, bledy problem+json, bledy niezgodnosci kontraktu.
import { describe, expect, it } from "vitest";
import { ApiError, apiRequest, buildUrl, ContractError } from "../src/lib/api/client";
import { authApi, catalogApi, ordersApi, settingsApi } from "../src/lib/api/endpoints";
import { describeError } from "../src/lib/api/messages";
import { CSRF, json, mockApi, problem, session } from "./helpers";
import { orderDetail, priceHistory, productRow, settings, wrobel } from "./fixtures";

describe("klient API: kontrakt odpowiedzi", () => {
  it("me/login: sesja parsowana schematem, token CSRF zapamietany w pamieci", async () => {
    mockApi({ "POST /v1/admin/auth/login": json(session("editor")) });
    const s = await authApi.login("editor@taktyl.example", "haslo");
    expect(s.user.role).toBe("editor");
    mockApi({ "PUT /v1/admin/variants/M-WRB-GRF/price": json(wrobel(), { etag: 5 }) });
    const calls = mockApi({
      "PUT /v1/admin/variants/M-WRB-GRF/price": json(wrobel(), { etag: 5 }),
    });
    await catalogApi.setPrice("M-WRB-GRF", { price_gr: 11900 }, 3);
    expect(calls[0]?.headers["X-CSRF-Token"]).toBe(CSRF);
    expect(calls[0]?.headers["If-Match"]).toBe('"3"');
    expect(calls[0]?.body).toEqual({ price_gr: 11900 });
  });

  it("GET nie wysyla CSRF; lista produktow, szczegoly, historia cen, zamowienia i ustawienia przechodza przez schematy", async () => {
    const calls = mockApi({
      "GET /v1/admin/products": json({ items: [productRow()], page: 1, per_page: 25, total: 1 }),
      "GET /v1/admin/products/m-wrobel": json(wrobel(), { etag: 5 }),
      "GET /v1/admin/variants/M-WRB-GRF/price-history": json(priceHistory),
      "GET /v1/admin/orders": json({
        items: [
          {
            number: "TK-261007-AB12",
            status: "paid",
            created_at: "2026-10-07T12:00:00+02:00",
            total_gr: 81609,
            payment_type: "blik",
            shipping_method: "kurier",
            contact_email: "j***@taktyl.example",
            items_count: 2,
          },
        ],
        page: 1,
        per_page: 25,
        total: 1,
      }),
      "GET /v1/admin/orders/TK-261007-AB12": json(orderDetail()),
      "GET /v1/admin/settings": json(settings(), { etag: 4 }),
    });
    expect((await catalogApi.list({ q: "lupek", page: 1 })).total).toBe(1);
    expect(calls[0]?.url).toBe("/v1/admin/products?q=lupek&page=1");
    expect((await catalogApi.get("m-wrobel")).variants[0]?.regular_price_gr).toBe(14900);
    expect((await catalogApi.priceHistory("M-WRB-GRF")).lowest_30d_gr).toBe(13900);
    expect((await ordersApi.list({})).items[0]?.items_count).toBe(2);
    expect((await ordersApi.get("TK-261007-AB12")).allowed_transitions).toEqual([
      "processing",
      "cancelled",
    ]);
    expect((await settingsApi.get()).version).toBe(4);
    for (const c of calls) expect(c.headers["X-CSRF-Token"]).toBeUndefined();
  });

  it("odpowiedz niezgodna z kontraktem to ContractError (nie cichy blad)", async () => {
    mockApi({ "GET /v1/admin/products/m-wrobel": json({ ...wrobel(), status: "weird" }) });
    await expect(catalogApi.get("m-wrobel")).rejects.toBeInstanceOf(ContractError);
  });

  it("ETag jest zwracany jako wersja liczbowa", async () => {
    mockApi({ "GET /v1/admin/settings": json(settings(), { etag: 4 }) });
    const r = await apiRequest({
      path: "/v1/admin/settings",
      schema: (await import("@taktyl/contracts")).adminSettingsSchema,
    });
    expect(r.version).toBe(4);
  });

  it("buildUrl pomija puste parametry", () => {
    expect(buildUrl("/v1/x", { a: 1, b: "", c: undefined, d: null, e: "tak" })).toBe(
      "/v1/x?a=1&e=tak",
    );
  });
});

describe("klient API: bledy problem+json", () => {
  it("412 to konflikt wersji z komunikatem i przyciskiem odswiezenia", async () => {
    mockApi({
      "PATCH /v1/admin/products/m-wrobel": problem(412, "conflict", {
        detail: "Wersja zmieniona.",
      }),
    });
    const err = await catalogApi
      .patch("m-wrobel", 1, { name: "Wróbel 2" })
      .catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect((err as ApiError).status).toBe(412);
    expect(describeError(err, "ten produkt")).toEqual({
      text: "Ktoś zmienił ten produkt. Odśwież i spróbuj ponownie.",
      conflict: true,
    });
  });

  it("422: bledy pol dostepne jako sciezka -> komunikat", async () => {
    mockApi({
      "PUT /v1/admin/variants/M-WRB-GRF/price": problem(422, "validation_failed", {
        errors: [{ path: "price_gr", code: "too_small", message: "Za mało." }],
      }),
    });
    const err = (await catalogApi
      .setPrice("M-WRB-GRF", { price_gr: 1 })
      .catch((e: unknown) => e)) as ApiError;
    expect(err.fieldErrors).toEqual([{ path: "price_gr", code: "too_small", message: "Za mało." }]);
  });

  it("komunikaty: csrf, uprawnienia, przejscie, limit prob", () => {
    const mk = (status: number, code: string, retry: number | null = null) =>
      new ApiError(status, { type: "x", title: "t", status, code: code as never }, retry);
    expect(describeError(mk(403, "csrf_invalid")).text).toBe("Odśwież stronę i spróbuj ponownie.");
    expect(describeError(mk(403, "forbidden")).text).toBe("Nie masz uprawnień do tej zmiany.");
    expect(describeError(mk(409, "invalid_transition")).text).toBe(
      "Z tego statusu nie da się przejść do wybranego. Odśwież stronę.",
    );
    expect(describeError(mk(429, "rate_limited", 900)).text).toBe(
      "Za dużo prób. Spróbuj za 15 minut.",
    );
    expect(describeError(mk(429, "rate_limited", 60)).text).toBe(
      "Za dużo prób. Spróbuj za 1 minutę.",
    );
  });

  it("brak polaczenia (blad sieci) to komunikat ogolny, nie wyjatek surowy", () => {
    expect(describeError(new TypeError("fetch failed")).text).toMatch(/Nie udało się połączyć/);
  });
});
