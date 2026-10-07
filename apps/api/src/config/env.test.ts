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
});
