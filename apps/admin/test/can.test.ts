// B-006 (docs/15 par. 3): macierz uprawnien po stronie UI - useCan(role, action).
import { describe, expect, it } from "vitest";
import { can, denyReason, type Action } from "../src/lib/can";

const WRITE: Action[] = ["catalog.write", "orders.write", "content.write", "media.write"];

describe("B-006 can()", () => {
  it("viewer czyta wszystko, nic nie zapisuje", () => {
    for (const a of ["catalog.read", "orders.read", "settings.read", "audit.read"] as Action[]) {
      expect(can("viewer", a)).toBe(true);
    }
    for (const a of [...WRITE, "settings.write", "catalog.delete", "users.manage"] as Action[]) {
      expect(can("viewer", a)).toBe(false);
    }
  });

  it("editor zapisuje katalog, zamowienia, tresci i media, ale nie ustawienia ani uzytkownikow", () => {
    for (const a of WRITE) expect(can("editor", a)).toBe(true);
    expect(can("editor", "settings.write")).toBe(false);
    expect(can("editor", "users.manage")).toBe(false);
    expect(can("editor", "catalog.delete")).toBe(false);
  });

  it("owner moze wszystko", () => {
    for (const a of [
      ...WRITE,
      "settings.write",
      "catalog.delete",
      "users.manage",
      "settings.read",
    ] as Action[]) {
      expect(can("owner", a)).toBe(true);
    }
  });

  it("brak roli = brak uprawnien", () => {
    expect(can(null, "catalog.read")).toBe(false);
    expect(can(undefined, "catalog.write")).toBe(false);
  });

  it("powod odmowy: viewer, ustawienia tylko dla wlasciciela, brak powodu przy zgodzie", () => {
    expect(denyReason("viewer", "catalog.write")).toMatch(/tylko do odczytu/);
    expect(denyReason("editor", "settings.write")).toBe(
      "Tylko właściciel zmienia ustawienia sklepu.",
    );
    expect(denyReason("viewer", "settings.write")).toBe(
      "Tylko właściciel zmienia ustawienia sklepu.",
    );
    expect(denyReason("owner", "settings.write")).toBeNull();
  });
});
