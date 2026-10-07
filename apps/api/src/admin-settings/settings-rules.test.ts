// B-400..B-408: testy jednostkowe regul ustawien sklepu i kontroli marek (lista marek wstrzykiwana, nigdy z repo).
import { describe, expect, it } from "vitest";
import { findBrands } from "../common/brand-guard.js";
import {
  codeErrors,
  companyErrors,
  demoLabelErrors,
  pickupErrors,
  postcodeErrors,
  setDiscountErrors,
  shippingMethodErrors,
} from "./settings-rules.js";

const codes = (e: { code: string }[]) => e.map((x) => x.code);

describe("B-401 rabat setu", () => {
  it("wymaga trzech roznych kategorii", () => {
    expect(setDiscountErrors(["klawiatury", "myszki", "podkladki"])).toEqual([]);
    expect(setDiscountErrors(["podkladki", "myszki", "klawiatury"])).toEqual([]);
    expect(setDiscountErrors(["klawiatury", "klawiatury", "myszki"])).toHaveLength(1);
    expect(setDiscountErrors(["klawiatury", "myszki"])).toHaveLength(1);
  });
});

describe("B-402 metody dostawy", () => {
  const kurier = {
    id: "kurier",
    label: "Kurier",
    fields: ["email", "phone", "name", "street", "postcode", "city"],
    address: null,
  };
  it("poprawne konfiguracje przechodza", () => {
    expect(shippingMethodErrors(0, kurier)).toEqual([]);
    expect(
      shippingMethodErrors(0, {
        id: "automat",
        label: "Automat paczkowy",
        fields: ["email", "phone", "point"],
        address: null,
      }),
    ).toEqual([]);
    expect(
      shippingMethodErrors(0, {
        id: "odbior",
        label: "Odbior osobisty",
        fields: ["email", "phone", "name"],
        address: "ul. Klawiszowa 87, 00-000 Warszawa (adres fikcyjny)",
      }),
    ).toEqual([]);
  });
  it("niespojne pola i adres nie-fikcyjny sa odrzucane ze sciezka pola", () => {
    const bad = shippingMethodErrors(2, {
      ...kurier,
      fields: ["email", "street"],
      address: "Prawdziwa 1",
    });
    expect(codes(bad)).toEqual(
      expect.arrayContaining([
        "contact_required",
        "incomplete_address",
        "address_required",
        "not_fictional",
      ]),
    );
    expect(bad.every((e) => e.path.startsWith("shipping_methods[2]"))).toBe(true);
  });
});

describe("B-404 kody rabatowe", () => {
  const code = {
    code: "TAKTYL10",
    type: "percent" as const,
    value: 10,
    valid_from: null,
    valid_to: null,
  };
  it("dlugosc 4-20, wartosc wg rodzaju, zakres dat", () => {
    expect(codeErrors(0, code)).toEqual([]);
    expect(codes(codeErrors(0, { ...code, code: "ABC" }))).toEqual(["invalid_length"]);
    expect(codes(codeErrors(0, { ...code, value: null }))).toEqual(["value_required"]);
    expect(codes(codeErrors(0, { ...code, type: "free_shipping" }))).toEqual(["value_not_allowed"]);
    expect(codeErrors(0, { ...code, type: "free_shipping", value: null })).toEqual([]);
    expect(
      codes(
        codeErrors(0, {
          ...code,
          valid_from: "2026-12-01T00:00:00Z",
          valid_to: "2026-11-01T00:00:00Z",
        }),
      ),
    ).toEqual(["invalid_range"]);
  });
});

describe("B-405, B-406 punkty odbioru i etykieta demo", () => {
  it("lokalizacja fikcyjna i kod pocztowy 00-000", () => {
    expect(
      pickupErrors(0, { city: "Warszawa", label: "WAW-001 · metro (lokalizacja fikcyjna)" }),
    ).toEqual([]);
    expect(codes(pickupErrors(0, { city: "", label: "x" }))).toEqual(["required", "not_fictional"]);
    expect(postcodeErrors("p", "00-000 Warszawa")).toEqual([]);
    expect(postcodeErrors("p", "31-001 Krakow")).toHaveLength(1);
  });
  it("etykieta demo: niepusta i ze slowem demo", () => {
    expect(demoLabelErrors("Taktyl to sklep demonstracyjny")).toEqual([]);
    expect(codes(demoLabelErrors("  "))).toEqual(["required"]);
    expect(codes(demoLabelErrors("Witamy"))).toEqual(["demo_required"]);
  });
});

describe("B-408 dane firmy", () => {
  it("dane fikcyjne przechodza", () => {
    expect(
      companyErrors({
        name: "Taktyl (podmiot fikcyjny)",
        phone: "+48 22 000 00 00",
        email: "a@taktyl.example",
        address: "ul. Klawiszowa 87, 00-000 Warszawa (adres fikcyjny)",
      }),
    ).toEqual([]);
  });
  it("odrzuca NIP/REGON/KRS/BDO, obce domeny, prawdziwe telefony i kody", () => {
    expect(codes(companyErrors({ NIP: "1" }))).toEqual(["forbidden_identifier"]);
    expect(codes(companyErrors({ note: "NIP 123-456-78-90" }))).toContain("forbidden_identifier");
    expect(codes(companyErrors({ note: "dane 1234567890" }))).toContain("forbidden_identifier");
    expect(codes(companyErrors({ mail: "x@firma.pl" }))).toEqual(["invalid_domain"]);
    expect(codes(companyErrors({ www: "https://firma.pl" }))).toEqual(["invalid_domain"]);
    expect(codes(companyErrors({ www: "https://www.taktyl.example/o-nas" }))).toEqual([]);
    expect(codes(companyErrors({ tel: "+48 600 123 456" }))).toEqual(["real_phone"]);
    expect(codes(companyErrors({ adres: "31-001 Krakow" }))).toEqual(["invalid_postcode"]);
  });
});

describe("kontrola marek (lista wstrzykiwana)", () => {
  it("znajduje cale slowa bez wzgledu na wielkosc liter i polskie znaki", () => {
    expect(findBrands("Wysylka przez MarkaTestowa Express", ["MarkaTestowa"])).toEqual([
      "MarkaTestowa",
    ]);
    expect(findBrands("Łódzka Marka", ["lodzka marka"])).toEqual(["lodzka marka"]);
    expect(findBrands("Nietestowa", ["testowa"])).toEqual([]);
    expect(findBrands("cokolwiek", [])).toEqual([]);
    expect(findBrands("x", ["x"])).toEqual([]);
  });
});
