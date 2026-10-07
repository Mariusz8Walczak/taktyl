// B-008, B-208: maskowanie danych osobowych (formaty z docs/15).
import { describe, expect, it } from "vitest";
import {
  maskEmail,
  maskName,
  maskNip,
  maskPersonalDeep,
  maskPhone,
  maskRecord,
} from "./pii-mask.js";

describe("B-008 maskowanie danych osobowych", () => {
  it("e-mail: a***@taktyl.example", () => {
    expect(maskEmail("anna@taktyl.example")).toBe("a***@taktyl.example");
    expect(maskEmail("bez-malpy")).toBe("***");
  });

  it("telefon: +48 *** *** 000 (ostatnie 3 cyfry)", () => {
    expect(maskPhone("500 000 123")).toBe("+48 *** *** 123");
    expect(maskPhone("+48 500-000-123")).toBe("+48 *** *** 123");
    expect(maskPhone("12")).toBe("+48 *** *** ***");
  });

  it("imie, NIP", () => {
    expect(maskName("Jan Przykładowy")).toBe("J*** P***");
    expect(maskNip("5260250274")).toBe("*******274");
  });

  it("rekord adresu: maskuje znane pola, zostawia identyfikator punktu", () => {
    expect(
      maskRecord({
        name: "Jan Kowalski",
        street: "ul. Przykładowa 1",
        postcode: "00-000",
        city: "Warszawa",
      }),
    ).toEqual({
      name: "J*** K***",
      street: "***",
      postcode: "**-***",
      city: "***",
    });
    expect(maskRecord({ point: "WAW-001" })).toEqual({ point: "WAW-001" });
    expect(maskRecord(null)).toBeNull();
  });

  it("rekurencyjnie w dowolnym JSON-ie (dziennik dla viewer)", () => {
    expect(
      maskPersonalDeep({
        email: "a@taktyl.example",
        nested: [{ phone: "500000123", status: "paid" }],
      }),
    ).toEqual({
      email: "a***@taktyl.example",
      nested: [{ phone: "+48 *** *** 123", status: "paid" }],
    });
  });
});
