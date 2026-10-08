// TAKTYL-70 (SEC-04): polityka CSP sklepu - zamkniete dyrektywy, GTM tylko na zyczenie.
import { describe, expect, it } from "vitest";
// @ts-expect-error plik .mjs bez deklaracji typow
import { buildCsp } from "../csp.mjs";

describe("TAKTYL-70 CSP sklepu", () => {
  it("domyslnie nic z zewnatrz, bez ramek, obiektow i cudzych formularzy", () => {
    const csp: string = buildCsp();
    for (const d of [
      "default-src 'self'",
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      "frame-ancestors 'none'",
      "connect-src 'self'",
    ]) {
      expect(csp).toContain(d);
    }
    expect(csp).not.toContain("googletagmanager");
    expect(csp).not.toContain("unsafe-eval");
  });

  it("GTM dopuszczony tylko z gtm: true", () => {
    expect(buildCsp({ gtm: true })).toContain("https://www.googletagmanager.com");
  });
});
