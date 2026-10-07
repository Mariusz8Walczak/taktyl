// TAKTYL-16: testy kontraktu. Przyklady JSON z docs/16 §6 przechodza parse, zle dane odpadaja.
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  adminProductDetailSchema, attributesSchemaByCategory, auditEntrySchema, ifMatchSchema, loginRequestSchema, orderCreatedSchema,
  orderRequestSchema, paymentSimulateRequestSchema, paymentSimulateResponseSchema, problemSchema, quoteRequestSchema,
  quoteResponseSchema, revalidateRequestSchema, setPriceRequestSchema, setStockRequestSchema, settingsPatchSchema,
  skuSchema, listingQuerySchema, productPatchSchema, orderTransitionRequestSchema, orderNoteSchema,
  orderNoteRequestSchema, adminOrderListQuerySchema, contactFormSchema, newsletterFormSchema, formAcceptedSchema,
  reviewsResponseSchema, REVIEWS_LABEL, FORM_DEMO_NOTICE,
} from "../src";

const quoteRequest = {
  items: [
    { type: "set", id: "set-1696676400000", qty: 1, profile: "programowanie", skus: ["K-BZL75-GRF-PRG", "M-PST-GRF", "P-SZR-XL-GRF"] },
    { type: "item", sku: "P-TFL-M-GRF", qty: 1 },
  ],
  coupon: "TAKTYL10",
  shipping_method: null,
};

const quoteResponse = {
  currency: "PLN",
  lines: [
    {
      type: "set", id: "set-1696676400000", qty: 1,
      items: [
        { sku: "K-BZL75-GRF-PRG", name: "Bazalt 75", price_gr: 74900, set_discount_gr: 7490, stock: 24, available: true },
        { sku: "M-PST-GRF", name: "Pustułka", price_gr: 39900, set_discount_gr: 3990, stock: 10, available: true },
        { sku: "P-SZR-XL-GRF", name: "Szron", price_gr: 18900, set_discount_gr: 1890, stock: 35, available: true },
      ],
      subtotal_gr: 133700, set_discount_gr: 13370, total_gr: 120330,
    },
    { type: "item", sku: "P-TFL-M-GRF", name: "Tafla", qty: 1, price_gr: 6900, coupon_discount_gr: 690, stock: 33, available: true },
  ],
  summary: {
    products_gr: 140600, set_discount_gr: 13370, coupon_discount_gr: 690,
    shipping_from_gr: 1299, total_gr: 126540, free_shipping_remaining_gr: 0,
  },
  coupon: { code: "TAKTYL10", applied: true, message_code: "coupon_applies_outside_sets" },
  problems: [],
};

const orderRequest = {
  items: [
    { type: "set", id: "set-1696676400000", qty: 1, profile: "programowanie", skus: ["K-BZL75-GRF-PRG", "M-PST-GRF", "P-SZR-XL-GRF"] },
  ],
  coupon: null,
  contact: { email: "jan@taktyl.example", phone: "500000000" },
  shipping: { method: "kurier", name: "Jan Przykładowy", street: "ul. Przykładowa 1", postcode: "00-000", city: "Warszawa" },
  invoice: null,
  payment_type: "blik",
  consents: { terms: true, newsletter: false },
  expected_total_gr: 120330,
};

const orderCreated = {
  number: "TK-261007-A1B2", status: "pending_payment", order_token: "<losowy-token-do-przechowania-w-przegladarce>",
  currency: "PLN", items_total_gr: 120330, shipping_gr: 0, total_gr: 120330,
  payment: { type: "blik", simulate_url: "/zamowienie/platnosc?id=TK-261007-A1B2" },
  eta: { dispatch_date: "2026-10-07", delivery_date: "2026-10-08" },
};

const clone = <T>(v: T): T => structuredClone(v);

describe("docs/16 §6.1 cart/quote", () => {
  it("zadanie z przykladu przechodzi", () => {
    expect(quoteRequestSchema.safeParse(quoteRequest).success).toBe(true);
  });
  it("odpowiedz z przykladu przechodzi, a sumy z przykladu sa spojne", () => {
    const r = quoteResponseSchema.parse(quoteResponse);
    expect(r.summary.products_gr - r.summary.set_discount_gr - r.summary.coupon_discount_gr).toBe(r.summary.total_gr);
  });
  it("odrzuca cene wyslana przez klienta (ADR-0007)", () => {
    const bad = clone(quoteRequest) as { items: Record<string, unknown>[] };
    bad.items[1] = { ...bad.items[1], price_gr: 1 };
    expect(quoteRequestSchema.safeParse(bad).success).toBe(false);
  });
  it("odrzuca set bez trzech SKU, zly SKU i ilosc spoza 1-10", () => {
    const two = clone(quoteRequest) as { items: { skus?: string[] }[] };
    two.items[0]!.skus = ["K-BZL75-GRF-PRG", "M-PST-GRF"];
    expect(quoteRequestSchema.safeParse(two).success).toBe(false);
    expect(quoteRequestSchema.safeParse({ items: [{ type: "item", sku: "xyz", qty: 1 }] }).success).toBe(false);
    expect(quoteRequestSchema.safeParse({ items: [{ type: "item", sku: "M-PST-GRF", qty: 11 }] }).success).toBe(false);
    expect(quoteRequestSchema.safeParse({ items: [] }).success).toBe(false);
  });
  it("odrzuca kwote ulamkowa w odpowiedzi (grosze to int)", () => {
    const bad = clone(quoteResponse);
    bad.summary.total_gr = 1265.4;
    expect(quoteResponseSchema.safeParse(bad).success).toBe(false);
  });
});

describe("docs/16 §6.2 orders", () => {
  it("zadanie z przykladu przechodzi, newsletter domyslnie false", () => {
    const parsed = orderRequestSchema.parse(orderRequest);
    expect(parsed.consents.newsletter).toBe(false);
  });
  it("odpowiedz 201 z przykladu przechodzi", () => {
    expect(orderCreatedSchema.safeParse(orderCreated).success).toBe(true);
  });
  it("float zamiast groszy odpada", () => {
    expect(orderRequestSchema.safeParse({ ...orderRequest, expected_total_gr: 1203.3 }).success).toBe(false);
  });
  it("zly e-mail odpada", () => {
    const bad = clone(orderRequest);
    bad.contact.email = "jan@@taktyl";
    expect(orderRequestSchema.safeParse(bad).success).toBe(false);
  });
  it("zly kod pocztowy odpada", () => {
    for (const postcode of ["00000", "0-000", "00-0000", "ab-cde"]) {
      const bad = clone(orderRequest);
      bad.shipping.postcode = postcode;
      expect(orderRequestSchema.safeParse(bad).success, postcode).toBe(false);
    }
  });
  it("zly telefon i zly NIP (format) odpadaja, poprawny NIP przechodzi", () => {
    const bad = clone(orderRequest);
    bad.contact.phone = "12345";
    expect(orderRequestSchema.safeParse(bad).success).toBe(false);
    const inv = { ...orderRequest, invoice: { nip: "12345", name: "Firma Przykladowa", address: "ul. Przykladowa 1, 00-000 Warszawa" } };
    expect(orderRequestSchema.safeParse(inv).success).toBe(false);
    inv.invoice.nip = "0000000000";
    expect(orderRequestSchema.safeParse(inv).success).toBe(true);
  });
  it("zgoda na regulamin musi byc true", () => {
    expect(orderRequestSchema.safeParse({ ...orderRequest, consents: { terms: false, newsletter: false } }).success).toBe(false);
    expect(orderRequestSchema.safeParse({ ...orderRequest, consents: { newsletter: false } }).success).toBe(false);
  });
  it("odrzuca dane kart, kod BLIK i haslo (regula 10, strict)", () => {
    for (const extra of [{ card_number: "4111111111111111" }, { blik_code: "123456" }, { password: "x" }]) {
      expect(orderRequestSchema.safeParse({ ...orderRequest, ...extra }).success).toBe(false);
    }
    const bad = clone(orderRequest) as { contact: Record<string, unknown> };
    bad.contact.card_number = "4111";
    expect(orderRequestSchema.safeParse(bad).success).toBe(false);
  });
  it("pola zalezne od dostawy: automat wymaga point, odbior wymaga name, kurier wymaga adresu", () => {
    const ok = (shipping: unknown) => orderRequestSchema.safeParse({ ...orderRequest, shipping }).success;
    expect(ok({ method: "automat", point: "WAW-001" })).toBe(true);
    expect(ok({ method: "automat" })).toBe(false);
    expect(ok({ method: "automat", point: "WAW-001", street: "ul. X 1" })).toBe(false);
    expect(ok({ method: "odbior", name: "Jan Przykładowy" })).toBe(true);
    expect(ok({ method: "odbior" })).toBe(false);
    expect(ok({ method: "kurier", name: "Jan Przykładowy" })).toBe(false);
    expect(ok({ method: "paczkomat", point: "WAW-001" })).toBe(false);
  });
  it("symulacja platnosci: paid | failed", () => {
    expect(paymentSimulateRequestSchema.safeParse({ outcome: "failed" }).success).toBe(true);
    expect(paymentSimulateRequestSchema.safeParse({ outcome: "paid" }).success).toBe(true);
    expect(paymentSimulateRequestSchema.safeParse({ outcome: "ok" }).success).toBe(false);
    expect(paymentSimulateResponseSchema.safeParse({ status: "payment_failed", transaction_id: "TK-261007-A1B2" }).success).toBe(true);
    expect(paymentSimulateResponseSchema.safeParse({ status: "paid", transaction_id: "TK-261007-A1B2" }).success).toBe(true);
  });
});

describe("problem+json (RFC 9457)", () => {
  it("poprawny blad z errors[]", () => {
    const p = problemSchema.parse({
      type: "https://taktyl.example/problems/validation_failed", title: "Błąd walidacji", status: 422,
      code: "validation_failed", detail: "Niepoprawne pola", instance: "req-1",
      errors: [{ path: "invoice.nip", code: "invalid_checksum", message: "NIP" }],
    });
    expect(p.errors?.[0]?.path).toBe("invoice.nip");
  });
  it("nieznany kod i status 200 odpadaja", () => {
    expect(problemSchema.safeParse({ type: "x", title: "x", status: 422, code: "nope" }).success).toBe(false);
    expect(problemSchema.safeParse({ type: "x", title: "x", status: 200, code: "not_found" }).success).toBe(false);
  });
});

describe("backpanel", () => {
  it("If-Match: \"<version>\" -> liczba", () => {
    expect(ifMatchSchema.parse('"7"')).toBe(7);
    expect(ifMatchSchema.safeParse("7").success).toBe(false);
  });
  it("cena: tylko int > 0; brak pola lowest_30d (ADR-0005)", () => {
    expect(setPriceRequestSchema.safeParse({ price_gr: 74900, regular_price_gr: null }).success).toBe(true);
    expect(setPriceRequestSchema.safeParse({ price_gr: 749.5 }).success).toBe(false);
    expect(setPriceRequestSchema.safeParse({ price_gr: 0 }).success).toBe(false);
    expect(setPriceRequestSchema.safeParse({ price_gr: -1 }).success).toBe(false);
    expect(setPriceRequestSchema.safeParse({ price_gr: 100, lowest_30d_gr: 200 }).success).toBe(false);
  });
  it("stan: ujemny odpada, powod wymagany", () => {
    expect(setStockRequestSchema.safeParse({ stock: 12, reason: "korekta" }).success).toBe(true);
    expect(setStockRequestSchema.safeParse({ stock: -1, reason: "korekta" }).success).toBe(false);
    expect(setStockRequestSchema.safeParse({ stock: 1 }).success).toBe(false);
  });
  it("login, PATCH ustawien (rabat 0-50), pusty PATCH produktu, znaczniki cache", () => {
    expect(loginRequestSchema.safeParse({ email: "a@taktyl.example", password: "x" }).success).toBe(true);
    expect(loginRequestSchema.safeParse({ email: "zle", password: "x" }).success).toBe(false);
    const cats = ["klawiatury", "myszki", "podkladki"];
    expect(settingsPatchSchema.safeParse({ set_discount: { percent: 10, categories: cats } }).success).toBe(true);
    expect(settingsPatchSchema.safeParse({ set_discount: { percent: 51, categories: cats } }).success).toBe(false);
    expect(settingsPatchSchema.safeParse({}).success).toBe(false);
    expect(productPatchSchema.safeParse({}).success).toBe(false);
    expect(productPatchSchema.safeParse({ name: "Bazalt 75" }).success).toBe(true);
    expect(revalidateRequestSchema.safeParse({ tags: ["product:bazalt-75", "catalog", "facets:klawiatury", "facets:*"] }).success).toBe(true);
    expect(revalidateRequestSchema.safeParse({ tags: ["order:TK-1"] }).success).toBe(false);
  });
  it("audit_log: akcja i BigInt jako string", () => {
    const e = {
      id: "12", at: "2026-10-07T16:00:00+02:00", actor_id: null, actor_role: "system", action: "variant.price.set",
      entity: "variant", entity_id: "K-BZL75-GRF-PRG", before: { price_gr: 1 }, after: { price_gr: 2 }, request_id: "r1",
    };
    expect(auditEntrySchema.safeParse(e).success).toBe(true);
    expect(auditEntrySchema.safeParse({ ...e, id: 12 }).success).toBe(false);
  });
});

describe("katalog", () => {
  it("zapytanie listingu: kursor, domyslne wartosci, cena w groszach", () => {
    const q = listingQuerySchema.parse({ category: "klawiatury", rozmiar: "75,tkl", cena: "30000-70000", hotswap: "1" });
    expect(q.sort).toBe("polecane");
    expect(q.limit).toBe(12);
    expect(q.rozmiar).toEqual(["75", "tkl"]);
    expect(listingQuerySchema.safeParse({ category: "monitory" }).success).toBe(false);
    expect(listingQuerySchema.safeParse({ category: "myszki", limit: "500" }).success).toBe(false);
  });
});

// Seed waliduje rekordy schematami z contracts (docs/17 §7): wszystkie SKU i atrybuty z data/products.json musza przejsc.
const dataFile = fileURLToPath(new URL("../../../data/products.json", import.meta.url));
describe.skipIf(!existsSync(dataFile))("data/products.json", () => {
  const products = JSON.parse(readFileSync(dataFile, "utf8")) as {
    category: keyof typeof attributesSchemaByCategory; attributes: unknown; variants: { sku: string }[];
  }[];
  it("kazdy SKU zgodny ze wzorem", () => {
    const bad = products.flatMap((p) => p.variants).filter((v) => !skuSchema.safeParse(v.sku).success);
    expect(bad).toEqual([]);
  });
  it("atrybuty kazdego produktu zgodne ze schematem kategorii", () => {
    const bad = products
      .map((p) => ({ p, r: attributesSchemaByCategory[p.category].safeParse(p.attributes) }))
      .filter((x) => !x.r.success)
      .map((x) => JSON.stringify(x.r.error?.issues.slice(0, 2)));
    expect(bad).toEqual([]);
  });
});

describe("zamowienia w backpanelu (TAKTYL-48)", () => {
  it("przejscie reczne: anulowanie wymaga powodu min. 5 znakow, reszta bez powodu; statusy systemowe odrzucone", () => {
    expect(orderTransitionRequestSchema.safeParse({ to: "processing" }).success).toBe(true);
    expect(orderTransitionRequestSchema.safeParse({ to: "cancelled" }).success).toBe(false);
    expect(orderTransitionRequestSchema.safeParse({ to: "cancelled", note: " abc " }).success).toBe(false);
    expect(orderTransitionRequestSchema.safeParse({ to: "cancelled", note: "Klient zrezygnowal" }).success).toBe(true);
    expect(orderTransitionRequestSchema.safeParse({ to: "paid" }).success).toBe(false);
    expect(orderTransitionRequestSchema.safeParse({ to: "shipped", extra: 1 }).success).toBe(false);
  });

  it("notatka: id to cyfry (BigInt jako tekst), tresc 1-1000 znakow", () => {
    expect(orderNoteSchema.safeParse({ id: "12", author: null, body: "x", at: "2026-10-07T12:00:00+02:00" }).success).toBe(true);
    expect(orderNoteSchema.safeParse({ id: "abc", author: null, body: "x", at: "2026-10-07T12:00:00+02:00" }).success).toBe(false);
    expect(orderNoteRequestSchema.safeParse({ note: "" }).success).toBe(false);
    expect(orderNoteRequestSchema.safeParse({ note: "x".repeat(1001) }).success).toBe(false);
  });

  it("wiersz listy ma liczbe pozycji, filtr metody dostawy jest opcjonalny", () => {
    expect(adminOrderListQuerySchema.parse({}).page).toBe(1);
    expect(adminOrderListQuerySchema.parse({ shipping_method: "kurier" }).shipping_method).toBe("kurier");
    expect(adminOrderListQuerySchema.safeParse({ shipping_method: "zly" }).success).toBe(false);
  });
});

describe("TAKTYL-47: kontrakt katalogu w backpanelu", () => {
  const detail = {
    id: "m-sikora", slug: "sikora", category: "myszki", name: "Sikora", brand: "Taktyl", short: "Lekka mysz symetryczna.",
    description: null, options: ["color"], default_variant_sku: null, badges: [], fit: { fps: 1, gry: 1, programowanie: 1, biuro: 1, cisza: 1 },
    in_box: [], gpsr: { manufacturer: "Taktyl", address: "adres", contact: "a@taktyl.example", warnings: "-" },
    attributes: {
      shape: "symetryczna", hand: "obureczna", size: "M", hand_cm: [17, 20], grips: ["palm"], weight_g: 70,
      dims_mm: { w: 62, d: 120, h: 38 }, connectivity: ["usb-c"], dpi_max: 26000, polling_hz: 1000, battery: null, sensor: "optyczny",
    },
    status: "archived", version: 1, updated_at: "2026-10-07T12:00:00+02:00", variants: [], images: [], warnings: [],
  };

  it("nowy produkt bez wariantow jest poprawnym szczegolem (status archived, brak domyslnego wariantu)", () => {
    expect(adminProductDetailSchema.safeParse(detail).success).toBe(true);
    expect(adminProductDetailSchema.safeParse({ ...detail, brand: "Inna" }).success).toBe(false);
    expect(adminProductDetailSchema.safeParse({ ...detail, attributes: { shape: "x" } }).success).toBe(false);
  });

  it("PATCH produktu dopuszcza slug i domyslny wariant, odrzuca nieznane pola; cena nie przyjmuje recznego lowest_30d", () => {
    expect(productPatchSchema.safeParse({ slug: "nowy-adres", default_variant_sku: "M-WRB-GRF" }).success).toBe(true);
    expect(productPatchSchema.safeParse({ lowest_30d_gr: 1 }).success).toBe(false);
    expect(setPriceRequestSchema.safeParse({ price_gr: 9900, lowest_30d_gr: 1 }).success).toBe(false);
  });
});

// TAKTYL-76 (F-076, F-221, F-223): formularze publiczne i odpowiedz opinii.
describe("formularze i opinie publiczne (TAKTYL-76)", () => {
  it("kontakt: e-mail, temat, wiadomosc; nieznane pola (zgoda, honeypot) odpadaja", () => {
    const ok = { email: "jan@taktyl.example", subject: "Pytanie", message: "Kiedy wysylka?" };
    expect(contactFormSchema.safeParse(ok).success).toBe(true);
    expect(contactFormSchema.safeParse({ ...ok, email: "zly" }).success).toBe(false);
    expect(contactFormSchema.safeParse({ ...ok, website: "x" }).success).toBe(false);
    expect(contactFormSchema.safeParse({ ...ok, message: "x" }).success).toBe(false);
  });

  it("newsletter: jedno pole e-mail, zadnej zgody w kontrakcie", () => {
    expect(newsletterFormSchema.safeParse({ email: "jan@taktyl.example" }).success).toBe(true);
    expect(newsletterFormSchema.safeParse({ email: "jan@taktyl.example", consent: true }).success).toBe(false);
    expect(formAcceptedSchema.safeParse({ status: "accepted", demo: true, message: FORM_DEMO_NOTICE }).success).toBe(true);
    expect(formAcceptedSchema.safeParse({ status: "accepted", demo: false, message: "x" }).success).toBe(false);
  });

  it("opinie: etykieta demo jest wymagana i stala, srednia moze byc null", () => {
    const body = { label: REVIEWS_LABEL, avg: null, count: 0, items: [] };
    expect(reviewsResponseSchema.safeParse(body).success).toBe(true);
    expect(reviewsResponseSchema.safeParse({ ...body, label: "Opinie klientow" }).success).toBe(false);
    expect(reviewsResponseSchema.safeParse({ avg: null, count: 0, items: [] }).success).toBe(false);
  });
});

// TAKTYL-78 (F-021): kazda wartosc kazdego facetu z data/facets.json przechodzi filtersSchema, smieci odpadaja.
describe.skipIf(!existsSync(fileURLToPath(new URL("../../../data/facets.json", import.meta.url))))(
  "TAKTYL-78: filtry zgodne z data/facets.json",
  () => {
    const facets = JSON.parse(
      readFileSync(fileURLToPath(new URL("../../../data/facets.json", import.meta.url)), "utf8"),
    ) as Record<string, { id: string; type: string; values?: { v: string }[] }[]>;
    const cases = Object.entries(facets).flatMap(([cat, list]) =>
      list.flatMap((f) => (f.values ?? []).map((v) => ({ cat, id: f.id, v: v.v }))),
    );

    it("data/facets.json ma wartosci do sprawdzenia, w tym myszki S/M/L", () => {
      expect(cases.length).toBeGreaterThan(30);
      expect(cases.filter((c) => c.cat === "myszki" && c.id === "rozmiar").map((c) => c.v)).toEqual(
        ["S", "M", "L"],
      );
    });

    it.each(cases)("$cat/$id=$v przechodzi", ({ cat, id, v }) => {
      const parsed = listingQuerySchema.parse({ category: cat, [id]: v });
      expect((parsed as Record<string, unknown>)[id]).toEqual([v]);
    });

    it("lista po przecinku i zestawy wartosci przechodza", () => {
      expect(listingQuerySchema.parse({ category: "myszki", rozmiar: "S,M,L" }).rozmiar).toEqual([
        "S",
        "M",
        "L",
      ]);
    });

    it.each([
      "",
      "S,",
      ",S",
      "S,,M",
      "-S",
      "S-",
      " S",
      "S ",
      "a  b",
      "S ,M",
      "a b;c",
      "a	b",
      "S;DROP",
      "S'--",
      "<script>",
      "../x",
      "S%20M",
      "ł",
      "a".repeat(201),
    ])("smiec %j odpada", (bad) => {
      expect(listingQuerySchema.safeParse({ category: "myszki", rozmiar: bad }).success).toBe(
        false,
      );
    });
  },
);
