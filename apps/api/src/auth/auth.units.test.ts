// B-001, B-002, B-005: testy jednostkowe hasel (argon2id), ciasteczek i sily hasla.
import { describe, expect, it } from "vitest";
import { clearedSessionCookie, readCookie, sessionCookie } from "./cookies.js";
import { keyedHash, randomToken, safeEqual, sha256Hex } from "./crypto.js";
import { PasswordService, passwordProblems } from "./password.service.js";

describe("B-001 PasswordService (argon2id)", () => {
  const svc = new PasswordService();

  it("hashuje argon2id z losowa sola i weryfikuje; zle haslo i uszkodzony hash = false", async () => {
    const a = await svc.hash("Aa1-testowe-haslo-12");
    const b = await svc.hash("Aa1-testowe-haslo-12");
    expect(a).toMatch(/^\$argon2id\$v=19\$m=19456,t=2,p=1\$/);
    expect(a).not.toBe(b);
    expect(await svc.verify(a, "Aa1-testowe-haslo-12")).toBe(true);
    expect(await svc.verify(a, "inne")).toBe(false);
    expect(await svc.verify("nie-hash", "x")).toBe(false);
    expect(await svc.verifyDummy("cokolwiek")).toBe(false);
  });
});

describe("B-005 sila hasla", () => {
  it("odrzuca krotkie, placeholder, rowne e-mailowi i powtarzalne", () => {
    expect(passwordProblems("krotkie")).toHaveLength(1);
    expect(passwordProblems("aaaa")).toHaveLength(2); // za krotkie + powtarzalne
    expect(passwordProblems("CHANGE_ME_please_now")).toContain(
      "Zastap placeholder prawdziwym haslem.",
    );
    expect(passwordProblems("wlasciciel@taktyl.example", "wlasciciel@taktyl.example")).toContain(
      "Haslo nie moze byc takie samo jak adres e-mail.",
    );
    expect(passwordProblems("aaaaaaaaaaaaaaaa")).toContain("Haslo jest zbyt powtarzalne.");
    expect(passwordProblems("Dluga-i-losowa-fraza-7")).toEqual([]);
  });
});

describe("B-002 ciasteczko sesji i prymitywy", () => {
  it("atrybuty HttpOnly, SameSite=Strict, Secure wg konfiguracji, Domain opcjonalnie", () => {
    const c = sessionCookie("tok", 43200, { secure: true, domain: ".taktyl.localhost" });
    expect(c).toBe(
      "taktyl_session=tok; Path=/; Max-Age=43200; HttpOnly; SameSite=Strict; Secure; Domain=.taktyl.localhost",
    );
    expect(sessionCookie("tok", 60, { secure: false })).not.toContain("Secure");
    expect(clearedSessionCookie({ secure: true })).toContain("Max-Age=0");
  });

  it("odczyt ciasteczka z naglowka", () => {
    expect(readCookie("a=1; taktyl_session=abc; b=2", "taktyl_session")).toBe("abc");
    expect(readCookie("a=1", "taktyl_session")).toBeUndefined();
    expect(readCookie(undefined, "x")).toBeUndefined();
    expect(readCookie("taktyl_session=", "taktyl_session")).toBeUndefined();
  });

  it("token 32 B (43 znaki base64url), skrot SHA-256, hash kluczowany zalezny od zakresu", () => {
    expect(randomToken()).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(randomToken()).not.toBe(randomToken());
    expect(sha256Hex("a")).toBe("ca978112ca1bbdcafac231b39a23dc4da786eff8147c4e72b9807785afee48bb");
    expect(keyedHash("s".repeat(32), "email", "x")).not.toBe(keyedHash("s".repeat(32), "ip", "x"));
    expect(safeEqual("abc", "abc")).toBe(true);
    expect(safeEqual("abc", "abd")).toBe(false);
    expect(safeEqual("abc", "abcd")).toBe(false);
  });
});
