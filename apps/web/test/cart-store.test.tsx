// F-150, F-154, F-002 (TAKTYL-39): store koszyka - dodawanie, ilosci, rozbicie setu i Cofnij, localStorage rzuca wyjatek
// (docs/12 §2: koszyk dziala w pamieci), zdarzenie storage (synchronizacja kart), migracja formatu adaptera.
import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { addSet, addToCart } from "../src/lib/cart-adapter";
import { CART_STORAGE_KEY, parseCartCount } from "../src/lib/cart/count";
import * as ops from "../src/lib/cart/state";
import { cartStore, getCart, useCart } from "../src/lib/cart/store";
import { cartUi } from "../src/lib/cart/ui";
import { EMPTY_CART } from "../src/lib/cart/types";
import { resetMemoryStorage } from "../src/lib/storage/safe-storage";
import { PROGRAMISTA } from "./cart-fixtures";

beforeEach(() => {
  cartUi.reset();
});

const SET = { skus: PROGRAMISTA, profile: "programowanie", id: "set-1" };

describe("operacje na stanie (czyste)", () => {
  it("dodaje pozycje, scala ten sam SKU i ogranicza ilosc do 10", () => {
    let s = ops.addItem(EMPTY_CART, "P-TFL-M-GRF", 3);
    s = ops.addItem(s, "P-TFL-M-GRF", 9);
    expect(s.lines).toEqual([{ type: "item", sku: "P-TFL-M-GRF", qty: 10 }]);
  });

  it("ilosc: pozycja 1-10, grupa 1-5", () => {
    let s = ops.addItem(EMPTY_CART, "P-TFL-M-GRF", 1);
    s = ops.setQty(s, "P-TFL-M-GRF", 99);
    expect(s.lines[0]?.qty).toBe(10);
    s = ops.setQty(s, "P-TFL-M-GRF", 0);
    expect(s.lines[0]?.qty).toBe(1);
    const g = ops.addSet(EMPTY_CART, SET)!;
    expect(ops.setQty(g.state, "set-1", 9).lines[0]?.qty).toBe(5);
  });

  it("set to grupa bez cen: id, nazwa, preset_id, profil, 3 SKU", () => {
    const { state } = ops.addSet(EMPTY_CART, { ...SET, presetId: "programista" })!;
    expect(state.lines[0]).toEqual({
      type: "set",
      id: "set-1",
      qty: 1,
      name: "Twój set",
      preset_id: "programista",
      profile: "programowanie",
      items: PROGRAMISTA.map((sku) => ({ sku })),
    });
    expect(ops.serializeCart(state)).not.toMatch(/price|cena/i);
    expect(ops.addSet(EMPTY_CART, { skus: ["K-BZL75-GRF-PRG"] })).toBeNull();
  });

  it("ten sam komplet SKU zwieksza ilosc grupy zamiast dodawac druga", () => {
    const a = ops.addSet(EMPTY_CART, SET)!;
    const b = ops.addSet(a.state, { ...SET, id: "set-2" })!;
    expect(b.state.lines).toHaveLength(1);
    expect(b.state.lines[0]?.qty).toBe(2);
  });

  it("edycja: replaceId zastepuje grupe na miejscu i zachowuje ilosc", () => {
    let s = ops.addItem(EMPTY_CART, "P-TFL-M-GRF", 1);
    s = ops.addSet(s, { ...SET, qty: 2 })!.state;
    const edited = ops.addSet(s, {
      skus: ["K-BZL75-GRF-SLZ", "M-PST-GRF", "P-SZR-XL-GRF"],
      replaceId: "set-1",
    })!;
    expect(edited.state.lines).toHaveLength(2);
    const g = edited.state.lines[1];
    expect(g?.type === "set" && g.id).toBe("set-1");
    expect(g?.qty).toBe(2);
    expect(g?.type === "set" && g.items[0]?.sku).toBe("K-BZL75-GRF-SLZ");
  });

  it("usuniecie elementu rozbija grupe, rabat znika, a Cofnij przywraca grupe (F-154, S15)", () => {
    const s0 = ops.addSet(EMPTY_CART, { ...SET, qty: 2 })!.state;
    const r = ops.removeFromSet(s0, "set-1", "K-BZL75-GRF-PRG")!;
    expect(r.state.lines).toEqual([
      { type: "item", sku: "M-PST-GRF", qty: 2 },
      { type: "item", sku: "P-SZR-XL-GRF", qty: 2 },
    ]);
    expect(ops.undoSplit(r.state, r.record)).toEqual(s0);
  });

  it("Cofnij rozbicia zachowuje pozycje dodane w miedzyczasie", () => {
    const s0 = ops.addSet(EMPTY_CART, SET)!.state;
    const r = ops.removeFromSet(s0, "set-1", "M-PST-GRF")!;
    const later = ops.addItem(r.state, "K-BZL75-GRF-PRG", 1);
    const undone = ops.undoSplit(later, r.record);
    expect(undone.lines.map((l) => (l.type === "set" ? l.id : `${l.sku}x${l.qty}`))).toEqual([
      "set-1",
      "K-BZL75-GRF-PRGx1",
    ]);
  });

  it("usuniecie pozycji i przywrocenie na dawne miejsce", () => {
    let s = ops.addItem(EMPTY_CART, "P-TFL-M-GRF", 1);
    s = ops.addItem(s, "M-WRB-GRF", 2);
    const r = ops.removeLine(s, "P-TFL-M-GRF");
    expect(r.state.lines).toHaveLength(1);
    expect(ops.restoreLine(r.state, r.removed!)).toEqual(s);
  });

  it("licznik: sztuki, set = jedna sztuka za sztuke setu", () => {
    let s = ops.addSet(EMPTY_CART, SET)!.state;
    s = ops.addItem(s, "P-TFL-M-GRF", 2);
    expect(ops.countUnits(s)).toBe(3);
  });
});

describe("odczyt zapisu: migracja i odrzucanie", () => {
  it("format tymczasowego adaptera (bez v) jest migrowany", () => {
    const old = JSON.stringify({
      lines: [{ type: "item", sku: "P-TFL-M-GRF", qty: 2 }],
      code: null,
    });
    expect(ops.parseCart(old)).toEqual({
      v: 1,
      lines: [{ type: "item", sku: "P-TFL-M-GRF", qty: 2 }],
      code: null,
    });
  });
  it("odrzuca uszkodzony JSON, nieznana wersje i zle pozycje", () => {
    expect(ops.parseCart("{nie json")).toEqual(EMPTY_CART);
    expect(
      ops.parseCart(
        JSON.stringify({ v: 9, lines: [{ type: "item", sku: "P-TFL-M-GRF", qty: 1 }] }),
      ),
    ).toEqual(EMPTY_CART);
    const s = ops.parseCart(
      JSON.stringify({
        v: 1,
        lines: [
          { type: "item", sku: "nie-sku", qty: 1 },
          { type: "item", sku: "P-TFL-M-GRF", qty: -1 },
          { type: "set", id: "x", qty: 1, items: [{ sku: "M-PST-GRF" }] },
          { type: "item", sku: "P-TFL-M-GRF", qty: 99 },
        ],
        code: "taktyl10",
      }),
    );
    expect(s.lines).toEqual([{ type: "item", sku: "P-TFL-M-GRF", qty: 10 }]);
    expect(s.code).toBe("TAKTYL10");
  });
});

describe("store (useSyncExternalStore nad localStorage)", () => {
  it("zapisuje wersjonowany format pod taktyl.cart.v1 i licznik naglowka go czyta", () => {
    cartStore.addItem("P-TFL-M-GRF", 2);
    cartStore.addSet(SET);
    const raw = window.localStorage.getItem(CART_STORAGE_KEY)!;
    expect(JSON.parse(raw).v).toBe(1);
    expect(parseCartCount(raw)).toBe(3);
    expect(getCart().lines).toHaveLength(2);
  });

  it("useCart reaguje na zmiany w tej karcie i na zdarzenie storage z innej karty", () => {
    const { result } = renderHook(() => useCart());
    expect(result.current.lines).toHaveLength(0);
    act(() => void cartStore.addItem("M-WRB-GRF", 1));
    expect(result.current.lines).toHaveLength(1);
    // inna karta zapisala koszyk: zdarzenie storage
    act(() => {
      window.localStorage.setItem(
        CART_STORAGE_KEY,
        JSON.stringify({ v: 1, lines: [{ type: "item", sku: "P-TFL-M-GRF", qty: 4 }], code: null }),
      );
      window.dispatchEvent(new StorageEvent("storage", { key: CART_STORAGE_KEY }));
    });
    expect(result.current.lines).toEqual([{ type: "item", sku: "P-TFL-M-GRF", qty: 4 }]);
  });

  it("localStorage rzuca wyjatek: koszyk dziala w pamieci (docs/12 §2)", () => {
    resetMemoryStorage();
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new DOMException("quota", "QuotaExceededError");
    });
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new DOMException("zablokowane", "SecurityError");
    });
    const { result } = renderHook(() => useCart());
    act(() => void cartStore.addItem("P-TFL-M-GRF", 2));
    expect(result.current.lines).toEqual([{ type: "item", sku: "P-TFL-M-GRF", qty: 2 }]);
    act(() => void cartStore.setQty("P-TFL-M-GRF", 3));
    expect(getCart().lines[0]?.qty).toBe(3);
    act(() => void cartStore.clear());
    expect(getCart().lines).toHaveLength(0);
  });

  it("clear usuwa klucz, Cofnij po remove przywraca pozycje", () => {
    cartStore.addItem("P-TFL-M-GRF", 1);
    const removed = cartStore.remove("P-TFL-M-GRF")!;
    expect(window.localStorage.getItem(CART_STORAGE_KEY)).toBeNull();
    cartStore.restore(removed);
    expect(getCart().lines).toHaveLength(1);
  });

  it("kod rabatowy zapisuje wielkimi literami", () => {
    cartStore.addItem("P-TFL-M-GRF", 1);
    cartStore.applyCode(" taktyl10 ");
    expect(getCart().code).toBe("TAKTYL10");
    cartStore.applyCode(null);
    expect(getCart().code).toBeNull();
  });
});

describe("fasada adaptera (addToCart, addSet) i szuflada", () => {
  it("addToCart zapisuje, otwiera szuflade i oznacza 'Dodano'", async () => {
    expect(await addToCart({ sku: "P-TFL-M-GRF", qty: 2 })).toEqual({ ok: true });
    expect(getCart().lines).toEqual([{ type: "item", sku: "P-TFL-M-GRF", qty: 2 }]);
    expect(cartUi.get().open).toBe(true);
    expect(cartUi.get().addedAt).toBeGreaterThan(0);
  });
  it("odrzuca zla ilosc", async () => {
    expect(await addToCart({ sku: "P-TFL-M-GRF", qty: 0 })).toEqual({ ok: false });
    expect(cartUi.get().open).toBe(false);
  });
  it("addSet dodaje grupe i zwraca jej id; zly komplet = ok:false", async () => {
    const res = await addSet({ skus: PROGRAMISTA, profile: "programowanie" });
    expect(res.ok).toBe(true);
    expect(getCart().lines[0]).toMatchObject({ type: "set", id: res.id, qty: 1 });
    expect((await addSet({ skus: ["M-PST-GRF"] })).ok).toBe(false);
  });
});
