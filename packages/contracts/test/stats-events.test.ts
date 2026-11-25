// B-621 (ADR-0012): kontrakt kolektora zdarzen; B-610..B-626: zapytanie zakresu statystyk.
import { describe, expect, it } from "vitest";
import {
  ANALYTICS_EVENT_NAMES,
  eventsBatchSchema,
  findPersonalData,
  statsRangeQuerySchema,
} from "../src";

const ev = (name: string, params: Record<string, unknown> = {}) => ({
  name,
  params,
  ts: "2026-11-25T10:00:00.000Z",
});

describe("B-621 POST /v1/events", () => {
  it("przyjmuje zdarzenia z docs/10 z parametrami bez zmian", () => {
    const body = {
      session_id: "s_4f9c2a7b1e",
      events: [
        ev("view_item", {
          currency: "PLN",
          value: 749,
          items: [{ item_id: "K-BZL75-GRF-PRG", item_name: "Bazalt 75", price: 749, quantity: 1 }],
        }),
        ev("set_builder_start", { entry_point: "hero" }),
        ev("purchase", { transaction_id: "TK-261125-AB2C", currency: "PLN", value: 1203.3 }),
      ],
    };
    expect(eventsBatchSchema.parse(body).events).toHaveLength(3);
  });

  it("odrzuca nazwe spoza docs/10 (np. page_view) i nieznane pola", () => {
    expect(
      eventsBatchSchema.safeParse({ session_id: "abcdefgh", events: [ev("page_view")] }).success,
    ).toBe(false);
    expect(
      eventsBatchSchema.safeParse({
        session_id: "abcdefgh",
        events: [ev("search", {})],
        user_id: "x",
      }).success,
    ).toBe(false);
  });

  it("odrzuca dane osobowe w parametrach i zbyt duza paczke", () => {
    expect(findPersonalData({ email: "a@b.pl" })).toBe("params.email");
    expect(findPersonalData({ search_term: "jan@taktyl.example" })).toBe("params.search_term");
    expect(findPersonalData({ items: [{ item_name: "Bazalt 75" }] })).toBeNull();
    expect(
      eventsBatchSchema.safeParse({
        session_id: "abcdefgh",
        events: [ev("search", { phone: "500000000" })],
      }).success,
    ).toBe(false);
    const many = Array.from({ length: 21 }, () => ev("view_cart"));
    expect(eventsBatchSchema.safeParse({ session_id: "abcdefgh", events: many }).success).toBe(
      false,
    );
  });

  it("lista nazw ma 27 zdarzen (docs/10 par. 4 i 5)", () => {
    expect(ANALYTICS_EVENT_NAMES).toHaveLength(27);
    expect(new Set(ANALYTICS_EVENT_NAMES).size).toBe(27);
  });
});

describe("B-610 zakres statystyk", () => {
  it("domyslnie porownanie z poprzednim okresem, daty RRRR-MM-DD", () => {
    expect(statsRangeQuerySchema.parse({})).toEqual({ compare: "previous" });
    expect(statsRangeQuerySchema.safeParse({ from: "2026-11-01", to: "2026-11-25" }).success).toBe(
      true,
    );
    expect(statsRangeQuerySchema.safeParse({ from: "01.11.2026" }).success).toBe(false);
  });
});
