// Testy F-065 (termin wysylki), F-173 (NIP), F-005 (normalizacja wyszukiwania) wg docs/12 par. 2.
import { describe, expect, it } from "vitest";
import {
  addBusinessDays,
  computeDispatch,
  formatDispatchMessage,
  isBusinessDay,
  isValidNip,
  matchesSearch,
  normalizeNip,
  normalizeSearchText,
  type DispatchOptions,
} from "./index.js";
import { loadCatalog } from "./test-utils.js";

const cat = loadCatalog();
const kurier = cat.shop.shippingMethods.find((m) => m.id === "kurier");
const odbior = cat.shop.shippingMethods.find((m) => m.id === "odbior");
if (!kurier || !odbior) throw new Error("Brak metod dostawy w shop.json");

const opts = (eta: number, holidays?: string[]): DispatchOptions => ({
  cutoffHour: cat.shop.dispatchCutoffHour,
  timeZone: cat.shop.timeZone,
  etaBusinessDays: eta,
  ...(holidays ? { holidays } : {}),
});

describe("termin wysylki i dostawy (F-065, strefa Europe/Warsaw)", () => {
  it("konfiguracja z shop.json: odciecie 14, strefa Warszawa", () => {
    expect(cat.shop.dispatchCutoffHour).toBe(14);
    expect(cat.shop.timeZone).toBe("Europe/Warsaw");
  });

  it("sroda 7.10.2026 13:00 -> wysylka dzis, kurier: czwartek, 8 pazdziernika", () => {
    const now = new Date("2026-10-07T13:00:00+02:00");
    const info = computeDispatch(now, opts(kurier.etaBusinessDays));
    expect(info.shipsToday).toBe(true);
    expect(info.label).toBe("Wysyłka dziś");
    expect(info.dispatchIso).toBe("2026-10-07");
    expect(info.deliveryIso).toBe("2026-10-08");
    expect(formatDispatchMessage(info, opts(1), "Dostawa kurierem")).toBe(
      "Zamów do 14:00, wyślemy dziś. Dostawa kurierem: czwartek, 8 października.",
    );
  });

  it("sroda 15:00 -> wysylka czwartek, dostawa piatek 9 pazdziernika", () => {
    const now = new Date("2026-10-07T15:00:00+02:00");
    const info = computeDispatch(now, opts(kurier.etaBusinessDays));
    expect(info.shipsToday).toBe(false);
    expect(info.label).toBe("Wysyłka jutro");
    expect(info.dispatchIso).toBe("2026-10-08");
    expect(info.deliveryIso).toBe("2026-10-09");
    expect(formatDispatchMessage(info, opts(1), "Dostawa kurierem")).toBe(
      "Wyślemy: czwartek, 8 października. Dostawa kurierem: piątek, 9 października.",
    );
  });

  it("sobota 10.10 -> wysylka poniedzialek 12, dostawa wtorek 13 pazdziernika", () => {
    const now = new Date("2026-10-10T10:00:00+02:00");
    const info = computeDispatch(now, opts(kurier.etaBusinessDays));
    expect(info.shipsToday).toBe(false);
    expect(info.dispatchIso).toBe("2026-10-12");
    expect(info.deliveryIso).toBe("2026-10-13");
    expect(info.label).toBe("Wysyłka: poniedziałek, 12 października");
  });

  it("niedziela -> poniedzialek; piatek 13:59 dzis, piatek 14:00 -> poniedzialek", () => {
    expect(computeDispatch(new Date("2026-10-11T09:00:00+02:00"), opts(1)).dispatchIso).toBe("2026-10-12");
    const fri = computeDispatch(new Date("2026-10-09T13:59:59+02:00"), opts(1));
    expect(fri.shipsToday).toBe(true);
    const friAfter = computeDispatch(new Date("2026-10-09T14:00:00+02:00"), opts(1));
    expect(friAfter.shipsToday).toBe(false);
    expect(friAfter.dispatchIso).toBe("2026-10-12");
    expect(friAfter.deliveryIso).toBe("2026-10-13");
  });

  it("dostawa przez weekend: czwartek 15:00 -> wysylka piatek, dostawa poniedzialek", () => {
    const info = computeDispatch(new Date("2026-10-08T15:00:00+02:00"), opts(1));
    expect(info.dispatchIso).toBe("2026-10-09");
    expect(info.deliveryIso).toBe("2026-10-12");
  });

  it("odbior osobisty (eta 0): dostawa w dniu wysylki", () => {
    const info = computeDispatch(new Date("2026-10-07T13:00:00+02:00"), opts(odbior.etaBusinessDays));
    expect(info.deliveryIso).toBe(info.dispatchIso);
  });

  it("strefa jawnie: 22:30 UTC w srode to juz czwartek 00:30 w Warszawie", () => {
    const info = computeDispatch(new Date("2026-10-07T22:30:00Z"), opts(1));
    expect(info.today).toEqual({ year: 2026, month: 10, day: 8 });
    expect(info.shipsToday).toBe(true);
    expect(info.dispatchIso).toBe("2026-10-08");
  });

  it("zmiana czasu: niedziela 25.10.2026 (koniec czasu letniego) nie psuje dat", () => {
    const info = computeDispatch(new Date("2026-10-24T20:00:00Z"), opts(1)); // sobota 22:00 CEST
    expect(info.dispatchIso).toBe("2026-10-26");
    expect(info.deliveryIso).toBe("2026-10-27");
  });

  it("swieta pomijane (lista dat, P2)", () => {
    const holidays = ["2026-10-08"];
    const info = computeDispatch(new Date("2026-10-07T15:00:00+02:00"), opts(1, holidays));
    expect(info.dispatchIso).toBe("2026-10-09");
    expect(isBusinessDay({ year: 2026, month: 10, day: 8 }, holidays)).toBe(false);
    expect(addBusinessDays({ year: 2026, month: 10, day: 7 }, 2, holidays)).toEqual({ year: 2026, month: 10, day: 12 });
  });

  it("nieprawidlowy zegar rzuca wyjatek zamiast zwracac smieci", () => {
    expect(() => computeDispatch(new Date("nie-data"), opts(1))).toThrow(RangeError);
  });
});

describe("NIP (F-173): numery generowane w tescie, nigdy na stale", () => {
  const WEIGHTS = [6, 5, 7, 2, 3, 4, 5, 6, 7];

  /** Niezalezna od implementacji generacja poprawnego NIP z losowych cyfr i wyliczonej cyfry kontrolnej. */
  function generateValidNip(): string {
    for (;;) {
      const digits = Array.from({ length: 9 }, () => Math.floor(Math.random() * 10));
      const sum = digits.reduce((acc, d, i) => acc + d * (WEIGHTS[i] as number), 0);
      const check = sum % 11;
      if (check === 10) continue;
      return [...digits, check].join("");
    }
  }

  it("poprawny wygenerowany numer przechodzi (z separatorami tez)", () => {
    for (let n = 0; n < 300; n++) {
      const nip = generateValidNip();
      expect(isValidNip(nip)).toBe(true);
      expect(isValidNip(`${nip.slice(0, 3)}-${nip.slice(3, 6)}-${nip.slice(6, 8)}-${nip.slice(8)}`)).toBe(true);
      expect(isValidNip(` ${nip.slice(0, 3)} ${nip.slice(3)} `)).toBe(true);
    }
  });

  it("zmieniona jedna cyfra odpada (na kazdej pozycji, kazda zmiana)", () => {
    for (let n = 0; n < 50; n++) {
      const nip = generateValidNip();
      for (let pos = 0; pos < 10; pos++) {
        for (let delta = 1; delta <= 9; delta++) {
          const changed = nip.split("");
          changed[pos] = String((Number(nip[pos]) + delta) % 10);
          expect(isValidNip(changed.join(""))).toBe(false);
        }
      }
    }
  });

  it("wymaga dokladnie 10 cyfr i samych cyfr", () => {
    const nip = generateValidNip();
    expect(isValidNip(nip.slice(0, 9))).toBe(false);
    expect(isValidNip(`${nip}0`)).toBe(false);
    expect(isValidNip("")).toBe(false);
    expect(isValidNip(`${nip.slice(0, 9)}x`)).toBe(false);
    expect(isValidNip("abcdefghij")).toBe(false);
    expect(normalizeNip("12-3 4")).toBe("1234");
    expect(normalizeNip("PL12")).toBeNull();
  });
});

describe("wyszukiwanie (F-005): normalizacja", () => {
  it("l z kreska nie rozklada sie w NFD - osobna linia", () => {
    expect(normalizeSearchText("Łupek")).toBe("lupek");
    expect(normalizeSearchText("ŁÓDŹ żółć")).toBe("lodz zolc");
    expect(normalizeSearchText("Pustułka")).toBe("pustulka");
  });

  it("S22: lupek, lod, pustulka, tkl znajduja Lupek 65, Lod, Pustulke, Granit TKL (na danych z products.json)", () => {
    const find = (q: string) => cat.products.filter((p) => matchesSearch(p.name, q)).map((p) => p.name);
    expect(find("lupek")).toEqual(["Łupek 65"]);
    expect(find("lod")).toEqual(["Lód"]);
    expect(find("pustulka")).toEqual(["Pustułka"]);
    expect(find("tkl")).toEqual(["Granit TKL"]);
    expect(find("ŁUPEK")).toEqual(["Łupek 65"]);
    expect(find("granit tkl")).toEqual(["Granit TKL"]);
    expect(find("   ")).toEqual([]);
  });
});
