// F-256 (ADR-0011): koszyk w przegladarce przyjmuje kody konfiguracji wlasnej (kropki w kodzie).
import { describe, expect, it } from "vitest";
import { addItem, addSet, parseCart, serializeCart } from "../src/lib/cart/state";
import { EMPTY_CART } from "../src/lib/cart/types";

const K = "K-KWR60-CFG-TRKP.KRMB.TRKB.KORB.BIA.MGL.BIA.BIA.PRG";
const M = "M-KOS-CFG-GRFM.GRFM.GRFP.CZRM";
const P = "P-TFL-L-CFG-NPASKI.GRFN";

describe("koszyk z konfiguracjami wlasnymi", () => {
  it("addItem i zapis/odczyt zachowuja kod z kropkami", () => {
    const s = addItem(EMPTY_CART, K, 2);
    expect(s.lines).toEqual([{ type: "item", sku: K, qty: 2 }]);
    expect(parseCart(serializeCart(s)).lines).toEqual(s.lines);
  });

  it("addSet przyjmuje trzy konfiguracje i zachowuje je w grupie", () => {
    const res = addSet(EMPTY_CART, { skus: [K, M, P], name: "Własny set" });
    expect(res).not.toBeNull();
    const line = res?.state.lines[0];
    expect(line?.type === "set" ? line.items.map((i) => i.sku) : []).toEqual([K, M, P]);
    expect(parseCart(serializeCart(res!.state)).lines).toHaveLength(1);
  });

  it("odrzuca smieci udajace kod", () => {
    expect(addSet(EMPTY_CART, { skus: [K, M, "X-ZLY-1"] })).toBeNull();
    expect(
      parseCart(
        JSON.stringify({ v: 1, lines: [{ type: "item", sku: "k-zly.kod", qty: 1 }], code: null }),
      ).lines,
    ).toEqual([]);
  });
});
