import { describe, expect, it } from "vitest";
import { loadEnv } from "./env.js";

const base = {
  DATABASE_URL: "postgresql://u:p@db:5432/taktyl",
  SESSION_SECRET: "a".repeat(32),
  REVALIDATE_SECRET: "b".repeat(32),
};

describe("B-103 loadEnv", () => {
  it("przyjmuje minimalna poprawna konfiguracje i ustawia domyslne", () => {
    const c = loadEnv(base);
    expect(c.API_PORT).toBe(4000);
    expect(c.DEMO_MODE).toBe(false);
    expect(c.API_CORS_ORIGINS).toEqual([]);
  });

  it("dzieli liste zrodel CORS", () => {
    const c = loadEnv({ ...base, API_CORS_ORIGINS: "http://a.localhost, http://b.localhost" });
    expect(c.API_CORS_ORIGINS).toEqual(["http://a.localhost", "http://b.localhost"]);
  });

  it("odrzuca placeholder sekretu CHANGE_ME i nie ujawnia wartosci", () => {
    expect(() => loadEnv({ ...base, SESSION_SECRET: "CHANGE_ME" })).toThrow(/SESSION_SECRET/);
    try {
      loadEnv({ ...base, SESSION_SECRET: "CHANGE_ME" });
    } catch (e) {
      expect(String(e)).not.toContain("CHANGE_ME");
    }
  });

  it("odrzuca adres administratora spoza taktyl.example", () => {
    expect(() => loadEnv({ ...base, ADMIN_BOOTSTRAP_EMAIL: "x@example.com" })).toThrow(
      /taktyl\.example/,
    );
  });

  it("odrzuca brak DATABASE_URL", () => {
    expect(() =>
      loadEnv({ SESSION_SECRET: base.SESSION_SECRET, REVALIDATE_SECRET: base.REVALIDATE_SECRET }),
    ).toThrow(/DATABASE_URL/);
  });

  it("B-002/B-004: domyslne wygasanie sesji (12 h, 30 min) i limity logowania (5 / 15 min)", () => {
    const c = loadEnv(base);
    expect([c.SESSION_TTL_HOURS, c.SESSION_IDLE_MINUTES]).toEqual([12, 30]);
    expect([c.LOGIN_MAX_ATTEMPTS, c.LOGIN_WINDOW_MINUTES]).toEqual([5, 15]);
    expect(c.SESSION_COOKIE_SECURE).toBeUndefined();
    expect(loadEnv({ ...base, SESSION_COOKIE_SECURE: "false" }).SESSION_COOKIE_SECURE).toBe(false);
  });

  it("B-005: puste ADMIN_BOOTSTRAP_* = brak; slabe haslo (<12, placeholder) przerywa start bez ujawniania wartosci", () => {
    const c = loadEnv({ ...base, ADMIN_BOOTSTRAP_EMAIL: "", ADMIN_BOOTSTRAP_PASSWORD: "" });
    expect(c.ADMIN_BOOTSTRAP_EMAIL).toBeUndefined();
    expect(c.ADMIN_BOOTSTRAP_PASSWORD).toBeUndefined();
    expect(() => loadEnv({ ...base, ADMIN_BOOTSTRAP_PASSWORD: "krotkie" })).toThrow(
      /ADMIN_BOOTSTRAP_PASSWORD/,
    );
    expect(() => loadEnv({ ...base, ADMIN_BOOTSTRAP_PASSWORD: "CHANGE_ME_CHANGE_ME" })).toThrow(
      /placeholder/,
    );
    const ok = loadEnv({
      ...base,
      ADMIN_BOOTSTRAP_EMAIL: "start@taktyl.example",
      ADMIN_BOOTSTRAP_PASSWORD: "x".repeat(8) + "Ab3!",
    });
    expect(ok.ADMIN_BOOTSTRAP_EMAIL).toBe("start@taktyl.example");
  });
});
