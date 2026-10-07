import { describe, expect, it } from "vitest";
import {
  ORDER_NUMBER_ALPHABET,
  ORDER_NUMBER_PATTERN,
  generateOrderNumber,
  warsawDateStamp,
} from "./order-number.js";

describe("B-200 numer zamowienia (C-002)", () => {
  it("alfabet nie zawiera 0, O, 1, I", () => {
    expect(ORDER_NUMBER_ALPHABET).not.toMatch(/[01OI]/);
    expect(ORDER_NUMBER_ALPHABET).toHaveLength(32);
  });

  it("data w Europe/Warsaw: 22:30 UTC 6.10 to juz 7.10 w Warszawie (CEST)", () => {
    expect(warsawDateStamp(new Date("2026-10-06T22:30:00Z"))).toBe("261007");
    expect(warsawDateStamp(new Date("2026-10-06T21:30:00Z"))).toBe("261006");
  });

  it("generuje numer zgodny ze wzorcem", () => {
    for (let i = 0; i < 200; i++) {
      expect(generateOrderNumber(new Date("2026-10-07T10:00:00Z"))).toMatch(ORDER_NUMBER_PATTERN);
    }
  });

  it("jest deterministyczny przy podanym zrodle losowosci", () => {
    expect(generateOrderNumber(new Date("2026-10-07T10:00:00Z"), () => 0)).toBe("TK-261007-AAAA");
    expect(generateOrderNumber(new Date("2026-10-07T10:00:00Z"), () => 0.999999)).toBe(
      "TK-261007-9999",
    );
  });
});
