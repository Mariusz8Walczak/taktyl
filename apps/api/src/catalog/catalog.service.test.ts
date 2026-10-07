// F-022, F-026 (B-216): testy jednostkowe kursora i zamiany filtrow API na stan domeny.
import type { FacetDef } from "@taktyl/domain";
import { describe, expect, it } from "vitest";
import { AppException } from "../common/app-exception.js";
import { decodeCursor, encodeCursor, toFilterState } from "./catalog.service.js";

const defs: FacetDef[] = [
  {
    id: "rozmiar",
    label: "Rozmiar",
    type: "multi",
    attr: "size",
    values: [
      { v: "75", label: "75%" },
      { v: "tkl", label: "TKL" },
    ],
  },
  { id: "cena", label: "Cena", type: "range", attr: "variant.price" },
  { id: "hotswap", label: "Hot-swap", type: "bool", attr: "hotswap" },
  { id: "dlon", label: "Dlon", type: "number-match", attr: "hand_cm" },
];

describe("B-216 kursor", () => {
  it("round trip przesuniecia", () => {
    expect(decodeCursor(encodeCursor(24))).toBe(24);
    expect(decodeCursor(undefined)).toBe(0);
  });

  it("zly kursor to 400 validation_failed", () => {
    for (const bad of [
      "zly!",
      Buffer.from('{"o":-1}').toString("base64url"),
      Buffer.from("x").toString("base64url"),
    ]) {
      try {
        decodeCursor(bad);
        expect.unreachable();
      } catch (e) {
        expect(e).toBeInstanceOf(AppException);
        expect((e as AppException).status).toBe(400);
      }
    }
  });
});

describe("B-216 toFilterState", () => {
  it("cena w groszach trafia do domeny jako zakres w groszach", () => {
    const state = toFilterState({ cena: "30000-70000" }, defs);
    expect(state.cena).toEqual({ min: 30000, max: 70000 });
  });

  it("cena z groszami (30050) nie traci precyzji", () => {
    expect(toFilterState({ cena: "30050-70099" }, defs).cena).toEqual({ min: 30050, max: 70099 });
  });

  it("multi, bool i number-match; nieznane wartosci pomijane", () => {
    const state = toFilterState({ rozmiar: ["75", "xxl"], hotswap: "1", dlon: "19.5" }, defs);
    expect(state).toEqual({ rozmiar: ["75"], hotswap: true, dlon: 19.5 });
  });
});
