// Testy F-104, F-105: 6 przykladow kontrolnych z docs/03 par. 4.4 oraz brzegi regul.
import { describe, expect, it } from "vitest";
import {
  cheapestCompliantPad,
  evaluateFit,
  fitHeadline,
  type ColorsConfig,
  type RulesConfig,
  type SetSelection,
  type SkuEntry,
} from "./index.js";
import { loadCatalog, readData } from "./test-utils.js";

const cat = loadCatalog();
const rules = readData<RulesConfig>("rules");
const colors = readData<ColorsConfig>("colors");

interface Pick {
  color?: string;
  size?: string;
  switch?: string;
}

/** Wybiera wariant po slugu produktu i cechach; wartosci oczekiwane wynikaja z data/products.json. */
function pick(slug: string, p: Pick = {}): SkuEntry {
  const product = cat.bySlug(slug);
  const variant = product.variants.find(
    (v) =>
      (p.color === undefined || v.color === p.color) &&
      (p.size === undefined || v.size === p.size) &&
      (p.switch === undefined || v.switch === p.switch),
  );
  if (!variant) throw new Error(`Brak wariantu ${slug} ${JSON.stringify(p)}`);
  return { product, variant };
}

function selection(
  profile: string | null,
  kb: SkuEntry | null,
  mouse: SkuEntry | null,
  pad: SkuEntry | null,
  handCm: number | null = null,
): SetSelection {
  return { profile, handCm, keyboard: kb, mouse, pad };
}

const run = (s: SetSelection) => evaluateFit(s, rules, colors, cat.products);
const byId = (r: ReturnType<typeof run>, id: string) => r.results.find((x) => x.id === id);

describe("przyklady kontrolne docs/03 par. 4.4 (F-104, F-105)", () => {
  it("1. Marmur 100 + Jerzyk + Filc XL, fps: wymagane 910 mm, mata 900 mm -> uwaga, propozycja Filc XXL", () => {
    const pad = pick("filc", { color: "grafit", size: "xl" });
    const r = run(selection("fps", pick("marmur-100", { color: "grafit" }), pick("jerzyk", { color: "grafit" }), pad));
    const rule = byId(r, "pad-width-desk");
    expect(rule?.level).toBe("uwaga");
    expect(rule?.message).toContain("90 cm");
    expect(rule?.message).toContain("91 cm");
    expect(rule?.message).toContain("klawiatura 44 cm + 40 cm na myszkę");
    const sug = rule?.suggestion;
    expect(sug).not.toBeNull();
    const target = cat.index.get(sug?.sku ?? "");
    expect(target?.product.slug).toBe("filc");
    expect(target?.variant.size).toBe("xxl");
    expect(target?.variant.color).toBe("grafit");
    expect(sug?.priceDelta).toBe((target?.variant.price ?? 0) - pad.variant.price);
    expect(sug?.label).toMatch(/^Zmień na Filc XXL \(\+\d+,00\szł\)$/u);
    expect(r.warnings).toBe(1);
    expect(r.headline).toBe("Pasuje z 1 uwagą");
  });

  it("2. Marmur 100 + Jerzyk + Szron XL, fps: propozycja Tafla XXL (Szron nie ma XXL, Tafla ma fit.fps = 2)", () => {
    expect(cat.bySlug("szron").variants.some((v) => v.size === "xxl")).toBe(false);
    expect(cat.bySlug("tafla").fit["fps"]).toBe(2);
    const r = run(
      selection(
        "fps",
        pick("marmur-100", { color: "grafit" }),
        pick("jerzyk", { color: "grafit" }),
        pick("szron", { color: "grafit", size: "xl" }),
      ),
    );
    const rule = byId(r, "pad-width-desk");
    expect(rule?.level).toBe("uwaga");
    const target = cat.index.get(rule?.suggestion?.sku ?? "");
    expect(target?.product.slug).toBe("tafla");
    expect(target?.variant.size).toBe("xxl");
    expect(rule?.suggestion?.label).toContain("Zmień na Tafla XXL");
  });

  it("3. Bazalt 75 + Pustulka + Szron XL, programowanie: wymagane 617 mm, mata 900 mm -> ok, zapas 28,3 cm", () => {
    const r = run(
      selection(
        "programowanie",
        pick("bazalt-75", { color: "grafit" }),
        pick("pustulka", { color: "grafit" }),
        pick("szron", { color: "grafit", size: "xl" }),
      ),
    );
    const rule = byId(r, "pad-width-desk");
    expect(rule?.level).toBe("ok");
    expect(rule?.message).toBe("Mieści się: klawiatura 32,7 cm + 22 cm na myszkę. Zapas: 28,3 cm.");
    expect(r.warnings).toBe(0);
    expect(r.headline).toBe("Pasuje");
  });

  it("4. Kwarc 60 + Jerzyk + Len M, fps: strefa 400 mm, mata 360 mm -> uwaga, propozycja Len L", () => {
    const r = run(
      selection(
        "fps",
        pick("kwarc-60", { color: "grafit" }),
        pick("jerzyk", { color: "grafit" }),
        pick("len", { color: "grafit", size: "m" }),
      ),
    );
    const rule = byId(r, "pad-width-mouse");
    expect(rule?.level).toBe("uwaga");
    expect(rule?.message).toContain("Przy profilu „Gry FPS, niski sens” mysz potrzebuje około 40 cm, a podkładka ma 36 cm.");
    const target = cat.index.get(rule?.suggestion?.sku ?? "");
    expect(target?.product.slug).toBe("len");
    expect(target?.variant.size).toBe("l");
  });

  it("5. Jerzyk, dlon 17 cm (zakres 18-20,5) -> uwaga, propozycja Mewa (16-18,5, ten sam ksztalt)", () => {
    const jerzyk = cat.bySlug("jerzyk");
    const mewa = cat.bySlug("mewa");
    expect(jerzyk.attributes.hand_cm).toEqual([18, 20.5]);
    expect(mewa.attributes.hand_cm).toEqual([16, 18.5]);
    expect(mewa.attributes.shape).toBe(jerzyk.attributes.shape);
    const r = run(selection(null, null, pick("jerzyk", { color: "grafit" }), null, 17));
    const rule = byId(r, "hand-size");
    expect(rule?.level).toBe("uwaga");
    expect(rule?.message).toBe("Jerzyk jest projektowana na dłoń 18–20,5 cm, Twoja ma 17 cm.");
    expect(cat.index.get(rule?.suggestion?.sku ?? "")?.product.slug).toBe("mewa");
  });

  it("6. Lupek 65 + Mewa + Tafla XL, wszystko Kobalt, gry: ok + Spojna kolorystyka: Kobalt", () => {
    const r = run(
      selection(
        "gry",
        pick("lupek-65", { color: "kobalt" }),
        pick("mewa", { color: "kobalt" }),
        pick("tafla", { color: "kobalt", size: "xl" }),
      ),
    );
    expect(byId(r, "pad-width-desk")?.level).toBe("ok");
    expect(byId(r, "pad-width-desk")?.message).toContain("Zapas: 21,2 cm");
    expect(byId(r, "color-harmony")?.message).toBe("Spójna kolorystyka: Kobalt.");
    expect(r.warnings).toBe(0);
    expect(r.headline).toBe("Pasuje");
  });
});

describe("S10: profil fps, podkladka Tafla M (F-105)", () => {
  it("Pasuje z 1 uwaga, propozycja Tafla L (+30,00 zl), po zmianie Pasuje", () => {
    const kb = pick("bazalt-75", { color: "grafit", switch: "prog" });
    const mouse = pick("pustulka", { color: "grafit" });
    const r = run(selection("fps", kb, mouse, pick("tafla", { color: "grafit", size: "m" })));
    expect(r.headline).toBe("Pasuje z 1 uwagą");
    const sug = byId(r, "pad-width-mouse")?.suggestion;
    expect(sug?.label).toMatch(/^Zmień na Tafla L \(\+30,00\szł\)$/u);
    const applied = cat.index.get(sug?.sku ?? "") as SkuEntry;
    const after = run(selection("fps", kb, mouse, applied));
    expect(after.headline).toBe("Pasuje");
    expect(after.warnings).toBe(0);
  });
});

describe("reguly bez wymaganych elementow i wynik nigdy nie blokuje", () => {
  it("pusty wybor lub sama klawiatura -> brak regul, naglowek Pasuje", () => {
    const empty = run(selection(null, null, null, null));
    expect(empty.results).toEqual([]);
    expect(empty.headline).toBe("Pasuje");
    expect(empty.noProfileNotice).toBe(rules.no_profile.message);
    const onlyKb = run(selection("fps", pick("kwarc-60"), null, null));
    expect(onlyKb.results).toEqual([]);
    expect(onlyKb.noProfileNotice).toBeNull();
  });

  it("hand-size bez podanej dloni nie jest wyswietlana; pad-width-desk bez myszki tez nie", () => {
    const r = run(selection("fps", pick("marmur-100"), null, pick("filc", { size: "xl" })));
    expect(byId(r, "hand-size")).toBeUndefined();
    expect(byId(r, "pad-width-desk")).toBeUndefined();
    expect(byId(r, "pad-depth-desk")).toBeUndefined();
  });

  it("two-receivers jest zawsze info; kolejnosc: uwaga, ok, info", () => {
    const r = run(
      selection(
        "fps",
        pick("marmur-100", { color: "grafit" }),
        pick("jerzyk", { color: "grafit" }),
        pick("filc", { color: "grafit", size: "xl" }),
        17,
      ),
    );
    // Marmur ma tylko przewod, wiec brak two-receivers
    expect(byId(r, "two-receivers")).toBeUndefined();
    const withTwo = run(
      selection(
        "programowanie",
        pick("bazalt-75", { color: "grafit" }),
        pick("pustulka", { color: "grafit" }),
        pick("szron", { color: "grafit", size: "xl" }),
      ),
    );
    expect(byId(withTwo, "two-receivers")?.level).toBe("info");
    const levels = r.results.map((x) => x.level);
    const order = { uwaga: 0, ok: 1, info: 2 } as const;
    expect([...levels].sort((a, b) => order[a] - order[b])).toEqual(levels);
  });

  it("brak myszki obejmujacej dlon: zdanie 'Zadna myszka...' i najblizszy zakres", () => {
    const r = run(selection(null, null, pick("jerzyk", { color: "grafit" }), null, 10));
    const rule = byId(r, "hand-size");
    expect(rule?.message).toContain("Żadna myszka w katalogu nie jest projektowana na dłoń 10 cm. Najbliżej: Mewa (16–18,5 cm).");
    expect(cat.index.get(rule?.suggestion?.sku ?? "")?.product.slug).toBe("mewa");
  });

  it("dlon w zakresie: komunikat ok bez propozycji", () => {
    const r = run(selection(null, null, pick("jerzyk", { color: "grafit" }), null, 19.5));
    expect(byId(r, "hand-size")?.message).toBe("Twoja dłoń (19,5 cm) mieści się w zakresie tej myszki (18–20,5 cm).");
    expect(byId(r, "hand-size")?.suggestion).toBeNull();
  });

  it("naglowek odmienia uwagi", () => {
    expect(fitHeadline(0)).toBe("Pasuje");
    expect(fitHeadline(1)).toBe("Pasuje z 1 uwagą");
    expect(fitHeadline(2)).toBe("Pasuje z 2 uwagami");
  });
});

describe("cheapestCompliantPad (niepelny set, docs/03 par. 6)", () => {
  it("zwraca najtansza dostepna podkladke spelniajaca reguly szerokosci", () => {
    const kb = pick("marmur-100", { color: "grafit" });
    const mouse = pick("jerzyk", { color: "grafit" });
    const best = cheapestCompliantPad({ profile: "fps", keyboard: kb, mouse }, rules, cat.products);
    expect(best).not.toBeNull();
    const zone = rules.profiles["fps"]?.mouse_zone_mm ?? 0;
    let min = Number.POSITIVE_INFINITY;
    for (const p of cat.products.filter((x) => x.category === "podkladki")) {
      for (const v of p.variants) {
        const size = p.attributes.sizes?.[v.size ?? ""];
        if (!size || v.stock <= 0) continue;
        const okDesk = size.type === "biurko" && size.w >= 20 + 440 + 30 + zone + 20 && size.d >= 135 + 40;
        const okMouse = size.type === "mysz" && size.w >= zone;
        if (okDesk || okMouse) min = Math.min(min, v.price);
      }
    }
    expect(best?.variant.price).toBe(min);
    expect(best?.variant.stock).toBeGreaterThan(0);
  });
});
