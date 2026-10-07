// B-203, B-205, B-201: maszyna stanow zamowienia (docs/16 par. 5) i daty w strefie Europe/Warsaw.
import { orderStatusSchema } from "@taktyl/contracts";
import { describe, expect, it } from "vitest";
import { warsawDayStart, warsawNextDayStart } from "../common/warsaw.js";
import {
  ADMIN_TRANSITIONS,
  allowedAdminTransitions,
  isAdminTransitionAllowed,
  restocksOnCancel,
} from "./order-transitions.js";

describe("B-203 maszyna stanow (przejscia reczne)", () => {
  it("tabela pokrywa wszystkie statusy z kontraktu", () => {
    expect(Object.keys(ADMIN_TRANSITIONS).sort()).toEqual([...orderStatusSchema.options].sort());
  });

  it("dozwolone: paid > processing > shipped > delivered oraz anulowanie z czterech statusow", () => {
    expect(isAdminTransitionAllowed("paid", "processing")).toBe(true);
    expect(isAdminTransitionAllowed("processing", "shipped")).toBe(true);
    expect(isAdminTransitionAllowed("shipped", "delivered")).toBe(true);
    for (const from of ["pending_payment", "payment_failed", "paid", "processing"]) {
      expect(isAdminTransitionAllowed(from, "cancelled")).toBe(true);
    }
  });

  it("niedozwolone: pomijanie krokow, cofanie, statusy koncowe, statusy tylko systemowe", () => {
    expect(isAdminTransitionAllowed("paid", "shipped")).toBe(false);
    expect(isAdminTransitionAllowed("pending_payment", "processing")).toBe(false);
    expect(isAdminTransitionAllowed("shipped", "cancelled")).toBe(false);
    expect(isAdminTransitionAllowed("delivered", "cancelled")).toBe(false);
    expect(isAdminTransitionAllowed("cancelled", "processing")).toBe(false);
    expect(isAdminTransitionAllowed("processing", "paid")).toBe(false);
    expect(isAdminTransitionAllowed("nieznany", "cancelled")).toBe(false);
    expect(allowedAdminTransitions("delivered")).toEqual([]);
    expect(allowedAdminTransitions("paid")).toEqual(["processing", "cancelled"]);
  });

  it("zwrot stanow tylko dla paid i processing (docs/18 E)", () => {
    expect(
      ["pending_payment", "payment_failed", "paid", "processing", "shipped"].filter(
        restocksOnCancel,
      ),
    ).toEqual(["paid", "processing"]);
  });
});

describe("B-201 doba w Europe/Warsaw", () => {
  it("lato (UTC+2) i zima (UTC+1)", () => {
    expect(warsawDayStart("2026-10-07").toISOString()).toBe("2026-10-06T22:00:00.000Z");
    expect(warsawDayStart("2026-12-01").toISOString()).toBe("2026-11-30T23:00:00.000Z");
  });

  it("doba przy zmianie czasu (koniec DST 2026-10-25) ma 25 godzin", () => {
    const start = warsawDayStart("2026-10-25");
    const next = warsawNextDayStart("2026-10-25");
    expect(start.toISOString()).toBe("2026-10-24T22:00:00.000Z");
    expect((next.getTime() - start.getTime()) / 3_600_000).toBe(25);
  });
});
