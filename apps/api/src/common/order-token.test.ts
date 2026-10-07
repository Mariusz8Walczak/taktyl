// B-220, B-211 (ADR-0007): testy jednostkowe tokenu zamowienia, kanonicznego JSON-a i znacznikow outbox.
import { describe, expect, it } from "vitest";
import { stockTags } from "../outbox/outbox.service.js";
import { canonicalJson, sha256Hex } from "./canonical-json.js";
import { deriveOrderToken, hashOrderToken, tokenMatchesHash } from "./order-token.js";

const SECRET = "s".repeat(40);

describe("B-220 order token", () => {
  it("jest deterministyczny dla (numer, klucz), rozny dla innych danych i dlugi", () => {
    const a = deriveOrderToken(SECRET, "TK-261007-ABCD", "k1");
    expect(deriveOrderToken(SECRET, "TK-261007-ABCD", "k1")).toBe(a);
    expect(deriveOrderToken(SECRET, "TK-261007-ABCD", "k2")).not.toBe(a);
    expect(deriveOrderToken(SECRET, "TK-261007-ABCE", "k1")).not.toBe(a);
    expect(deriveOrderToken("t".repeat(40), "TK-261007-ABCD", "k1")).not.toBe(a);
    expect(a.length).toBeGreaterThanOrEqual(32);
  });

  it("baza trzyma skrot SHA-256; porownanie stalo-czasowe", () => {
    const token = deriveOrderToken(SECRET, "TK-261007-ABCD", "k1");
    const hash = hashOrderToken(token);
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
    expect(hash).not.toContain(token);
    expect(tokenMatchesHash(token, hash)).toBe(true);
    expect(tokenMatchesHash(`${token}x`, hash)).toBe(false);
  });
});

describe("B-211 canonicalJson", () => {
  it("kolejnosc kluczy nie wplywa na skrot, wartosc tak", () => {
    expect(sha256Hex(canonicalJson({ a: 1, b: { c: [1, 2], d: null } }))).toBe(
      sha256Hex(canonicalJson({ b: { d: null, c: [1, 2] }, a: 1 })),
    );
    expect(canonicalJson({ a: 1 })).not.toBe(canonicalJson({ a: 2 }));
    expect(canonicalJson({ a: undefined, b: 1 })).toBe('{"b":1}');
  });
});

describe("B-219 stockTags (docs/14 par. 6)", () => {
  it("product, category i facets bez duplikatow", () => {
    expect(
      stockTags([
        { slug: "bazalt-75", categoryId: "klawiatury" },
        { slug: "granit-tkl", categoryId: "klawiatury" },
        { slug: "szron", categoryId: "podkladki" },
      ]),
    ).toEqual([
      "category:klawiatury",
      "category:podkladki",
      "facets:klawiatury",
      "facets:podkladki",
      "product:bazalt-75",
      "product:granit-tkl",
      "product:szron",
    ]);
  });
});
