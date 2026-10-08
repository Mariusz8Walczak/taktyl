// TAKTYL-70 (SEC-04): polityka CSP backpanelu - nic z zewnatrz poza zdjeciami z hosta sklepu.
import { describe, expect, it } from "vitest";
// @ts-expect-error plik .mjs bez deklaracji typow
import { buildCsp } from "../csp.mjs";

describe("TAKTYL-70 CSP backpanelu", () => {
  it("zamyka ramki, obiekty, base i formularze; zdjecia z origin sklepu", () => {
    const csp: string = buildCsp({ siteUrl: "http://taktyl.localhost/media" });
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain("object-src 'none'");
    expect(csp).toContain("base-uri 'self'");
    expect(csp).toContain("form-action 'self'");
    expect(csp).toContain("connect-src 'self'");
    expect(csp).toContain("img-src 'self' data: blob: http://taktyl.localhost");
    expect(csp).not.toContain("unsafe-eval");
  });

  it("zepsuty adres sklepu nie przerywa budowy", () => {
    expect(buildCsp({ siteUrl: "to nie adres" })).toContain("img-src 'self' data: blob:;");
  });
});
