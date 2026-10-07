// B-502..B-505 (TAKTYL-63): testy jednostkowe odczytu naglowka WebP, miejsc na pliki z manifestu i ochrony sciezek.
import { describe, expect, it } from "vitest";
import { fakeWebp } from "../../test/webp-fixture.js";
import { dimensionsMessage, isSafeMediaPath, resolveInMediaDir, slotSpecs } from "./media-spec.js";
import { readWebpInfo } from "./webp.js";

describe("B-503 readWebpInfo", () => {
  it("czyta wymiary i flage alfa z naglowka VP8L", () => {
    expect(readWebpInfo(fakeWebp(327, 140))).toEqual({ width: 327, height: 140, hasAlpha: true });
    expect(readWebpInfo(fakeWebp(1600, 1600, { alpha: false }))).toEqual({
      width: 1600,
      height: 1600,
      hasAlpha: false,
    });
  });

  it("odrzuca to, co nie jest WebP: tekst, ucieta tresc, zly rozmiar RIFF", () => {
    expect(
      readWebpInfo(Buffer.from("to nie jest obraz, tylko tekst o dlugosci ponad trzydziesci")),
    ).toBeNull();
    expect(readWebpInfo(fakeWebp(10, 10).subarray(0, 20))).toBeNull();
    const bad = Buffer.from(fakeWebp(10, 10));
    bad.writeUInt32LE(9999, 4);
    expect(readWebpInfo(bad)).toBeNull();
  });
});

describe("B-502 slotSpecs i sciezki", () => {
  it("topdown: miejsca 1x/2x z pixels manifestu, nazwa z manifestu", () => {
    const specs = slotSpecs({
      kind: "topdown",
      files: ["img/top/k-kwarc-60_grafit_top@1x.webp", "img/top/k-kwarc-60_grafit_top@2x.webp"],
      pixels: { "1x": [293, 102], "2x": [586, 204] },
    });
    expect(specs.map((s) => [s.slot, s.fileName, s.width, s.height])).toEqual([
      ["1x", "k-kwarc-60_grafit_top@1x.webp", 293, 102],
      ["2x", "k-kwarc-60_grafit_top@2x.webp", 586, 204],
    ]);
  });

  it("packshot: kwadraty 400/800/1600", () => {
    const specs = slotSpecs({
      kind: "packshot",
      files: [400, 800, 1600].map((w) => `img/produkty/x_grafit_01-34-${w}.webp`),
      pixels: null,
    });
    expect(specs.map((s) => [s.slot, s.width, s.height])).toEqual([
      ["400", 400, 400],
      ["800", 800, 800],
      ["1600", 1600, 1600],
    ]);
  });

  it("odrzuca sciezki z .., ukosnikiem wiodacym i obcym rozszerzeniem", () => {
    for (const bad of [
      "../x.webp",
      "/etc/x.webp",
      "img/../../x.webp",
      "img/x.png",
      "img\\x.webp",
    ]) {
      expect(isSafeMediaPath(bad), bad).toBe(false);
      expect(resolveInMediaDir("/data/media", bad), bad).toBeNull();
    }
    expect(resolveInMediaDir("/data/media", "img/top/a_b@1x.webp")).toMatch(
      /img[\\/]top[\\/]a_b@1x\.webp$/,
    );
  });

  it("komunikat wymiarow jak w docs/15 B-503", () => {
    expect(
      dimensionsMessage("topdown", "1x", { width: 330, height: 140 }, { width: 327, height: 140 }),
    ).toBe("Plik ma 330 × 140 px. Ten wpis wymaga 327 × 140 px (1 px = 1 mm).");
    expect(
      dimensionsMessage("topdown", "2x", { width: 1, height: 1 }, { width: 654, height: 280 }),
    ).toContain("(2 px = 1 mm)");
    expect(
      dimensionsMessage("texture", "1x", { width: 1, height: 1 }, { width: 200, height: 200 }),
    ).toBe("Plik ma 1 × 1 px. Ten wpis wymaga 200 × 200 px.");
  });
});
