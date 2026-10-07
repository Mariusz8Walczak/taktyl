// F-242 (docs/10 §6-§7): modul track - dataLayer, czyszczenie ecommerce, debug, purchase raz, zero danych osobowych.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { TRACK_DOM_EVENT, track, trackPurchaseOnce } from "../src/lib/track";
import type { TrackItem } from "../src/lib/track-events";

const item: TrackItem = {
  item_id: "K-BZL75-GRF-PRG",
  item_name: "Bazalt 75",
  item_brand: "Taktyl",
  item_category: "klawiatury",
  price: 749,
  quantity: 1,
  discount: 0,
};

beforeEach(() => {
  window.dataLayer = [];
  window.history.replaceState(null, "", "/");
});

describe("track (F-242)", () => {
  it("zdarzenie bez items trafia plasko do dataLayer", () => {
    track("search", { search_term: "lupek" });
    expect(window.dataLayer).toEqual([{ event: "search", search_term: "lupek" }]);
  });

  it("zdarzenie z items: najpierw { ecommerce: null }, potem obiekt w ecommerce", () => {
    track("view_item", { currency: "PLN", value: 749, items: [item] });
    expect(window.dataLayer).toEqual([
      { ecommerce: null },
      { event: "view_item", ecommerce: { currency: "PLN", value: 749, items: [item] } },
    ]);
  });

  it("tworzy dataLayer, gdy go nie ma", () => {
    delete window.dataLayer;
    track("shortcut_use", { key: "/" });
    expect(window.dataLayer).toHaveLength(1);
  });

  it("?pomiar wysyla CustomEvent taktyl:track z ladunkiem, bez ?pomiar nie", () => {
    const seen: unknown[] = [];
    const listener = (e: Event) => seen.push((e as CustomEvent).detail);
    window.addEventListener(TRACK_DOM_EVENT, listener);
    track("search", { search_term: "a" });
    expect(seen).toHaveLength(0);
    window.history.replaceState(null, "", "/?pomiar=1");
    track("search", { search_term: "lod" });
    window.removeEventListener(TRACK_DOM_EVENT, listener);
    expect(seen).toEqual([{ event: "search", search_term: "lod" }]);
  });

  it("odfiltrowuje pola osobowe, gdyby trafily poza typami", () => {
    track("search", { search_term: "x", email: "a@taktyl.example", phone: "1" } as never);
    expect(window.dataLayer).toEqual([{ event: "search", search_term: "x" }]);
  });

  it("test statyczny: typy parametrow nie zawieraja pol osobowych (docs/10 zasada 5)", () => {
    const src = readFileSync(join(__dirname, "../src/lib/track-events.ts"), "utf8");
    const keys = [...src.matchAll(/^\s+([a-z_]+)\??:/gm)].map((m) => m[1] ?? "");
    expect(keys.length).toBeGreaterThan(30);
    const personal =
      /(e_?mail|phone|telefon|first_?name|last_?name|imie|nazwisko|address|adres|nip)/i;
    expect(keys.filter((k) => personal.test(k))).toEqual([]);
  });
});

describe("trackPurchaseOnce (docs/10 zasada 3)", () => {
  const purchase = () => ({
    transaction_id: "TK-2026-000123",
    currency: "PLN" as const,
    value: 1203.3,
    shipping: 0,
    tax: 225,
    items: [item],
  });

  it("drugie wywolanie dla tego samego transaction_id nic nie wysyla", () => {
    expect(trackPurchaseOnce(purchase())).toBe(true);
    expect(trackPurchaseOnce(purchase())).toBe(false);
    expect(
      window.dataLayer?.filter((e) => (e as { event?: string }).event === "purchase"),
    ).toHaveLength(1);
    expect(JSON.parse(window.localStorage.getItem("taktyl.tracked.v1") ?? "[]")).toEqual([
      "TK-2026-000123",
    ]);
  });

  it("inny numer liczy sie osobno; wyjatek localStorage nie psuje (zapas w pamieci)", () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new DOMException("quota", "QuotaExceededError");
    });
    expect(trackPurchaseOnce(purchase())).toBe(true);
    expect(trackPurchaseOnce(purchase())).toBe(false);
    expect(trackPurchaseOnce({ ...purchase(), transaction_id: "TK-2026-000124" })).toBe(true);
  });
});
