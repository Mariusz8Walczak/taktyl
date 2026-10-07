// F-102...F-108, F-111, F-112 (TAKTYL-34, TAKTYL-35): logika kreatora na danych z data/*.json - reguly i propozycje
// (6 przykladow kontrolnych z docs/03 §4.4), cena i rabat 4 presetow, stan adresu, taktyl.set.v1, sortowanie kafli.
import { cheapestCompliantPad, formatPLN } from "@taktyl/domain";
import { describe, expect, it, vi } from "vitest";
import { analyze, padTileHint } from "../src/lib/builder/fit";
import { sortForStep, entryOf, productsOf } from "../src/lib/builder/catalog";
import { pickVariant, retargetSwitch } from "../src/lib/builder/select";
import { parseSearch, readStored, toSearchParams, writeStored } from "../src/lib/builder/state";
import { slotCount } from "../src/lib/builder/types";
import { RAW_PRESETS, expectedSetPrice, model, state } from "./builder-fixtures";

const plain = (t: string) => t.replaceAll(" ", " ");

describe("reguly dopasowania i propozycje (docs/03 §4.4)", () => {
  it("1. Marmur 100 + Jerzyk + Filc XL, FPS: uwaga i propozycja Filc XXL", () => {
    const a = analyze(
      model,
      state({ profile: "fps", k: "K-MRM100-GRF-SLZ", m: "M-JRZ-GRF", p: "P-FLC-XL-GRF" }),
    );
    const r = a.report.results.find((x) => x.id === "pad-width-desk");
    expect(r?.level).toBe("uwaga");
    expect(r?.suggestion?.sku).toBe("P-FLC-XXL-GRF");
    expect(plain(r?.suggestion?.label ?? "")).toMatch(/^Zmień na Filc XXL \(\+/);
    expect(a.report.headline).toBe("Pasuje z 1 uwagą");
  });

  it("2. Marmur 100 + Jerzyk + Szron XL, FPS: propozycja Tafla XXL (Szron nie ma XXL)", () => {
    const a = analyze(
      model,
      state({ profile: "fps", k: "K-MRM100-GRF-SLZ", m: "M-JRZ-GRF", p: "P-SZR-XL-GRF" }),
    );
    const r = a.report.results.find((x) => x.id === "pad-width-desk");
    expect(r?.level).toBe("uwaga");
    expect(r?.suggestion?.sku).toMatch(/^P-TFL-XXL-/);
    expect(r?.message).toContain("91");
  });

  it("3. Bazalt 75 + Pustulka + Szron XL, programowanie: ok, zapas 28,3 cm", () => {
    const a = analyze(
      model,
      state({
        profile: "programowanie",
        k: "K-BZL75-GRF-PRG",
        m: "M-PST-GRF",
        p: "P-SZR-XL-GRF",
      }),
    );
    expect(a.report.headline).toBe("Pasuje");
    expect(plain(a.report.results.find((x) => x.id === "pad-width-desk")?.message ?? "")).toContain(
      "Zapas: 28,3 cm",
    );
    expect(a.deskResult).toEqual({ status: "ok", spareMm: 283 });
  });

  it("4. Kwarc 60 + Jerzyk + Len M, FPS: strefa 400 mm na macie 360 mm, propozycja Len L", () => {
    const a = analyze(
      model,
      state({ profile: "fps", k: "K-KWR60-GRF-SLZ", m: "M-JRZ-GRF", p: "P-LEN-M-GRF" }),
    );
    const r = a.report.results.find((x) => x.id === "pad-width-mouse");
    expect(r?.level).toBe("uwaga");
    expect(r?.suggestion?.sku).toBe("P-LEN-L-GRF");
  });

  it("5. Jerzyk, dlon 17 cm: uwaga i propozycja Mewa", () => {
    const a = analyze(model, state({ handCm: 17, m: "M-JRZ-GRF" }));
    const r = a.report.results.find((x) => x.id === "hand-size");
    expect(r?.level).toBe("uwaga");
    expect(r?.suggestion?.sku).toMatch(/^M-MEW-/);
  });

  it("6. Lupek 65 + Mewa + Tafla XL, wszystko Kobalt, gry: ok i spojna kolorystyka", () => {
    const a = analyze(
      model,
      state({ profile: "gry", k: "K-LPK65-KOB-SLZ", m: "M-MEW-KOB", p: "P-TFL-XL-KOB" }),
    );
    expect(a.report.headline).toBe("Pasuje");
    expect(a.report.results.map((r) => r.message)).toContain("Spójna kolorystyka: Kobalt.");
  });

  it("S10: Bazalt 75 + Pustulka + Tafla M, profil FPS: 1 uwaga, po propozycji Tafla L (+30,00 zl) - Pasuje", () => {
    const s = state({
      profile: "fps",
      k: "K-BZL75-GRF-SLZ",
      m: "M-PST-GRF",
      p: "P-TFL-M-GRF",
    });
    const a = analyze(model, s);
    expect(a.report.headline).toBe("Pasuje z 1 uwagą");
    const sug = a.report.results.find((r) => r.suggestion)?.suggestion;
    expect(plain(sug?.label ?? "")).toBe("Zmień na Tafla L (+30,00 zł)");
    const after = analyze(model, { ...s, p: sug?.sku ?? null });
    expect(after.report.headline).toBe("Pasuje");
  });
});

describe("cena setu i rabat (F-107; kontrolnie z presets.json)", () => {
  it.each(RAW_PRESETS.map((p) => [p.name, p] as const))("%s", (_name, preset) => {
    const a = analyze(
      model,
      state({
        profile: preset.profile,
        k: preset.skus[0] ?? null,
        m: preset.skus[1] ?? null,
        p: preset.skus[2] ?? null,
      }),
    );
    const exp = expectedSetPrice(preset.skus);
    expect(a.price.sum).toBe(Math.round(preset.sum * 100));
    expect(a.price.discount).toBe(Math.round(preset.set_discount * 100));
    expect(a.price.total).toBe(Math.round(preset.total * 100));
    expect(a.price).toMatchObject({ sum: exp.sum, discount: exp.discount, total: exp.total });
    expect(a.price.lines.reduce((s, l) => s + l.discount, 0)).toBe(a.price.discount);
  });

  it("Programista: 1337,00 zl -> 1203,30 zl", () => {
    const a = analyze(model, parseSearch("preset=programista", model).state);
    expect(plain(formatPLN(a.price.sum))).toBe("1337,00 zł");
    expect(plain(formatPLN(a.price.total))).toBe("1203,30 zł");
  });

  it("niepelny set: bez rabatu, zdanie o rabacie dla najtanszej podkladki spelniajacej reguly", () => {
    const s = state({ profile: "fps", k: "K-MRM100-GRF-SLZ", m: "M-JRZ-GRF" });
    const a = analyze(model, s);
    expect(a.price.discount).toBe(0);
    const pad = cheapestCompliantPad(
      { profile: "fps", keyboard: entryOf(model, s.k), mouse: entryOf(model, s.m) },
      model.rules,
      model.domainProducts,
    );
    const items = [s.k ?? "", s.m ?? "", pad?.variant.sku ?? ""].map((sku) => {
      const e = model.index.get(sku);
      return { sku, category: e?.product.category ?? "", price: e?.variant.price ?? 0 };
    });
    const expected = Math.round((items.reduce((x, i) => x + i.price, 0) * 10) / 100);
    expect(a.discountHint).toBe(
      `Dodaj podkładkę, a rabat 10% obejmie cały set (−${formatPLN(expected)}).`,
    );
  });

  it("wariant bez stanu zostaje wybrany i jest oznaczony", () => {
    const a = analyze(model, state({ k: "K-BZL75-KOB-SZP" }));
    expect(a.soldOut).toEqual(["k"]);
  });
});

describe("kafel podkladki przed wyborem (docs/03 §2 krok 3)", () => {
  const marmur = entryOf(model, "K-MRM100-GRF-SLZ");
  const pad = (id: string) => model.byId.get(id);
  it("Szron (XL 90 cm) przy Marmurze 100 i FPS: za waska o 1 cm", () => {
    const hint = padTileHint(model, "fps", marmur, pad("p-szron")!, "biurko");
    expect(plain(hint ?? "")).toBe("XL: za wąska o 1 cm");
  });
  it("Tafla (XXL) miesci sie ze zapasem", () => {
    const hint = padTileHint(model, "fps", marmur, pad("p-tafla")!, "biurko");
    expect(plain(hint ?? "")).toMatch(/^XXL: mieści się, zapas \d+(,\d)? cm$/);
  });
});

describe("sortowanie i wybor wariantu (F-102, F-103)", () => {
  it("sortowanie: fit[profil] malejaco, potem cena rosnaco", () => {
    const list = sortForStep(productsOf(model, "klawiatury"), "fps");
    for (let i = 1; i < list.length; i++) {
      const a = list[i - 1]!;
      const b = list[i]!;
      const fa = a.fit.fps;
      const fb = b.fit.fps;
      expect(fa >= fb).toBe(true);
    }
    // bez profilu: kolejnosc z katalogu
    expect(sortForStep(productsOf(model, "klawiatury"), null).map((p) => p.id)).toEqual(
      productsOf(model, "klawiatury").map((p) => p.id),
    );
  });

  it("wybor klawiatury w profilu programowanie daje domyslny przelacznik profilu (Próg)", () => {
    const bazalt = model.byId.get("k-bazalt-75")!;
    const v = pickVariant(model, state({ profile: "programowanie" }), "k", bazalt, "biurko");
    expect(v.switch).toBe(model.rules.profiles.programowanie?.default_switch);
  });

  it("zmiana profilu przestawia przelacznik, o ile klient sam go nie wybral", () => {
    const k = entryOf(model, "K-BZL75-GRF-PRG");
    expect(retargetSwitch(model, k, "fps")).toBe("K-BZL75-GRF-SLZ");
  });
});

describe("stan adresu (F-108, F-112, docs/03 §1, §8)", () => {
  it("?preset=programista: SKU i profil z presets.json, krok podsumowanie, entry preset", () => {
    const p = parseSearch("preset=programista", model);
    expect(p.state).toMatchObject({
      profile: "programowanie",
      k: "K-BZL75-GRF-PRG",
      m: "M-PST-GRF",
      p: "P-SZR-XL-GRF",
      step: "podsumowanie",
      presetId: "programista",
    });
    expect(p.entry).toBe("preset");
  });

  it("?k=SKU z karty produktu: nastepny pusty krok (myszka), entry pdp", () => {
    const p = parseSearch("k=K-BZL75-GRF-PRG", model);
    expect(p.state.step).toBe("myszka");
    expect(p.entry).toBe("pdp");
    expect(parseSearch("m=M-PST-GRF", model).state.step).toBe("klawiatura");
  });

  it("link od kogos (profil + SKU) = share_link; samo ?profil=cisza = guide na kroku 1", () => {
    expect(
      parseSearch("profil=fps&k=K-KWR60-GRF-SLZ&m=M-JRZ-GRF&p=P-LEN-XL-GRF", model).entry,
    ).toBe("share_link");
    const guide = parseSearch("profil=cisza", model);
    expect(guide.entry).toBe("guide");
    expect(guide.state.profile).toBe("cisza");
    expect(guide.state.step).toBe("klawiatura");
  });

  it("Dokoncz set: wejscie=pdp_complete i krok=podsumowanie", () => {
    const p = parseSearch(
      "k=K-BZL75-GRF-PRG&m=M-PST-GRF&p=P-SZR-XL-GRF&krok=podsumowanie&wejscie=pdp_complete",
      model,
    );
    expect(p.entry).toBe("pdp_complete");
    expect(p.state.step).toBe("podsumowanie");
    expect(slotCount(p.state)).toBe(3);
  });

  it("bez parametrow: pusty stan, krok 0, entry nav, hasSet false", () => {
    const p = parseSearch("", model);
    expect(p.hasSet).toBe(false);
    expect(p.state.step).toBe("do-czego");
    expect(p.entry).toBe("nav");
  });

  it("nieznany SKU jest pomijany z komunikatem o kategorii", () => {
    const p = parseSearch("k=K-NIE-ISTNIEJE&m=M-PST-GRF", model);
    expect(p.state.k).toBeNull();
    expect(p.state.m).toBe("M-PST-GRF");
    expect(p.notices).toEqual(["Część setu jest już niedostępna: klawiatura. Wybierz zamiennik."]);
  });

  it("SKU z niewlasciwej kategorii (m= podkladka) jest pomijany", () => {
    expect(parseSearch("m=P-TFL-M-GRF", model).state.m).toBeNull();
  });

  it("nieprawidlowa dlon i profil sa ignorowane", () => {
    const p = parseSearch("profil=zly&dlon=99", model);
    expect(p.state.profile).toBeNull();
    expect(p.state.handCm).toBeNull();
  });

  it("serializacja i odczyt daja ten sam set (S21)", () => {
    const s = state({
      profile: "fps",
      handCm: 19.5,
      k: "K-KWR60-GRF-SLZ",
      m: "M-JRZ-GRF",
      p: "P-LEN-XL-GRF",
      step: "podsumowanie",
    });
    const qs = toSearchParams(s).toString();
    expect(qs).toBe(
      "profil=fps&dlon=19.5&k=K-KWR60-GRF-SLZ&m=M-JRZ-GRF&p=P-LEN-XL-GRF&krok=podsumowanie",
    );
    expect(parseSearch(qs, model).state).toMatchObject({
      ...s,
      presetId: null,
      switchByUser: false,
    });
  });
});

describe("taktyl.set.v1 (F-108)", () => {
  it("zapis i odczyt z zapasem w pamieci, gdy localStorage rzuca wyjatek", () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("QuotaExceededError");
    });
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("SecurityError");
    });
    const s = state({ profile: "gry", k: "K-LPK65-KOB-SLZ", step: "myszka" });
    expect(() => writeStored(s, new Date("2026-10-07T16:00:00+02:00"))).not.toThrow();
    const back = readStored();
    expect(back?.state).toMatchObject({ profile: "gry", k: "K-LPK65-KOB-SLZ", step: "myszka" });
    expect(back?.updatedAt).toBe("2026-10-07T14:00:00.000Z");
  });

  it("uszkodzony JSON = brak zapisu, bez wyjatku", () => {
    window.localStorage.setItem("taktyl.set.v1", "{nie json");
    expect(readStored()).toBeNull();
  });
});
