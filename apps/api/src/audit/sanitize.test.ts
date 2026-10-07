// B-011: do audit_log nie trafiaja sekrety ani dane osobowe klienta.
import { describe, expect, it } from "vitest";
import { sanitizeForAudit } from "./sanitize.js";

describe("B-011 sanitizeForAudit", () => {
  it("usuwa hasla, hashe, tokeny, sekrety i CSRF (takze zagniezdzone)", () => {
    expect(
      sanitizeForAudit({
        email: "a@taktyl.example",
        password: "x",
        passwordHash: "$argon2id$",
        nested: { sessionToken: "t", csrf_secret: "c", ok: 1 },
        list: [{ api_key: "k", keep: true }],
      }),
    ).toEqual({ email: "a@taktyl.example", nested: { ok: 1 }, list: [{ keep: true }] });
  });

  it("ukrywa dane osobowe klienta zamowienia", () => {
    expect(
      sanitizeForAudit({
        status: "paid",
        contact_email: "k@taktyl.example",
        shipping_address: { street: "x" },
        invoice: { nip: "1" },
      }),
    ).toEqual({
      status: "paid",
      contact_email: "[ukryte]",
      shipping_address: "[ukryte]",
      invoice: "[ukryte]",
    });
  });

  it("daty i BigInt jako tekst, glebokosc ograniczona", () => {
    expect(sanitizeForAudit({ at: new Date("2026-10-07T10:00:00Z"), id: 5n })).toEqual({
      at: "2026-10-07T10:00:00.000Z",
      id: "5",
    });
    let deep: unknown = { v: 1 };
    for (let i = 0; i < 12; i++) deep = { n: deep };
    expect(JSON.stringify(sanitizeForAudit(deep))).toContain("[obciete]");
  });
});

describe("B-011 encje sklepu (katalog) nie sa maskowane jak dane klienta", () => {
  it("nazwa produktu i kontakt GPSR zostaja, sekrety nadal znikaja", async () => {
    const { sanitizeForAudit, NON_PERSONAL_ENTITIES } = await import("./sanitize.js");
    const v = {
      name: "Wróbel",
      gpsr: { contact: "a@taktyl.example", address: "ul. Przykladowa 1" },
      token: "x",
    };
    expect(NON_PERSONAL_ENTITIES.has("product")).toBe(true);
    expect(NON_PERSONAL_ENTITIES.has("order")).toBe(false);
    expect(sanitizeForAudit(v, 0, true)).toEqual({
      name: "Wróbel",
      gpsr: { contact: "a@taktyl.example", address: "ul. Przykladowa 1" },
    });
    expect(sanitizeForAudit(v)).toMatchObject({ name: "[ukryte]", gpsr: { address: "[ukryte]" } });
  });
});
