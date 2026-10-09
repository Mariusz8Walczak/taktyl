import { render, screen } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { axe } from "vitest-axe";
import {
  ProductImage,
  buildSrcSet,
  findManifestEntry,
  intrinsicSize,
  topdownCaption,
} from "../src/index.js";
import type { ManifestEntry } from "../src/index.js";

const manifest = JSON.parse(
  readFileSync(join(__dirname, "..", "..", "..", "assets", "manifest.json"), "utf8"),
) as ManifestEntry[];

const packshot = findManifestEntry(manifest, "k-kwarc-60_grafit_01-34")!;
const topdown = findManifestEntry(manifest, "k-kwarc-60_grafit_top")!;
const texture = findManifestEntry(manifest, "p-tafla_grafit_tekstura")!;
const gotowe = (e: ManifestEntry): ManifestEntry => ({ ...e, status: "gotowe" });

describe("manifest (assets/manifest.json)", () => {
  it("ma 300 wpisow, kazdy z kind i status, wszystkie na razie brak", () => {
    expect(manifest).toHaveLength(300);
    expect(new Set(manifest.map((e) => e.kind))).toEqual(
      new Set(["packshot", "topdown", "texture"]),
    );
    expect(new Set(manifest.map((e) => e.status))).toEqual(new Set(["brak"]));
  });

  it("srcset: packshot po szerokosciach, topdown po gestosci", () => {
    expect(buildSrcSet(packshot)).toBe(
      "/img/produkty/k-kwarc-60_grafit_01-34-400.webp 400w, /img/produkty/k-kwarc-60_grafit_01-34-800.webp 800w, /img/produkty/k-kwarc-60_grafit_01-34-1600.webp 1600w",
    );
    expect(buildSrcSet(topdown, "https://cdn.taktyl.example")).toBe(
      "https://cdn.taktyl.example/img/top/k-kwarc-60_grafit_top@1x.webp 1x, https://cdn.taktyl.example/img/top/k-kwarc-60_grafit_top@2x.webp 2x",
    );
  });

  it("wymiary wlasne: packshot 1:1, topdown z pixels 1x", () => {
    expect(intrinsicSize(packshot)).toEqual({ width: 1600, height: 1600 });
    expect(intrinsicSize(topdown)).toEqual({ width: 293, height: 102 });
    expect(intrinsicSize(texture)).toEqual({ width: 200, height: 200 });
  });
});

describe("ProductImage: status gotowe", () => {
  it("packshot: img z srcset, sizes, width, height i alt wg docs/09 §4.4", () => {
    render(
      <ProductImage
        entry={gotowe(packshot)}
        productName="Kwarc 60"
        colorName="Grafit"
        sizes="(min-width: 62rem) 25vw, 50vw"
      />,
    );
    const img = screen.getByRole("img", { name: "Kwarc 60 w kolorze Grafit, ujęcie 3/4 z przodu" });
    expect(img.tagName).toBe("IMG");
    expect(img).toHaveAttribute("srcset", buildSrcSet(packshot) ?? "");
    expect(img).toHaveAttribute("sizes", "(min-width: 62rem) 25vw, 50vw");
    expect(img).toHaveAttribute("width", "1600");
    expect(img).toHaveAttribute("height", "1600");
    expect(img).toHaveAttribute("loading", "lazy");
    expect(img).toHaveAttribute("src", "/img/produkty/k-kwarc-60_grafit_01-34-1600.webp");
  });

  it("priority: pierwszy ekran bez lazy, z fetchpriority=high", () => {
    render(
      <ProductImage entry={gotowe(packshot)} productName="Kwarc 60" colorName="Grafit" priority />,
    );
    const img = screen.getByRole("img");
    expect(img).toHaveAttribute("loading", "eager");
    expect(img).toHaveAttribute("fetchpriority", "high");
  });

  it("topdown: alt pusty (opis niesie plotno), wymiary 1 px = 1 mm i srcset 1x/2x", () => {
    const { container } = render(
      <ProductImage entry={gotowe(topdown)} productName="Kwarc 60" colorName="Grafit" />,
    );
    const img = container.querySelector("img")!;
    expect(img).toHaveAttribute("alt", "");
    expect(img).toHaveAttribute("width", "293");
    expect(img).toHaveAttribute("height", "102");
    expect(img.getAttribute("srcset")).toContain("@2x.webp 2x");
    expect(img.style.getPropertyValue("--tk-w")).toBe("293");
    expect(img.style.getPropertyValue("--tk-d")).toBe("102");
  });

  it("decorative=true dla packshotu (miniatura galerii) daje alt pusty", () => {
    const { container } = render(
      <ProductImage
        entry={gotowe(packshot)}
        productName="Kwarc 60"
        colorName="Grafit"
        decorative
      />,
    );
    expect(container.querySelector("img")).toHaveAttribute("alt", "");
  });

  it("status gotowe bez plikow wraca do placeholdera", () => {
    render(
      <ProductImage
        entry={{ ...packshot, status: "gotowe", files: [] }}
        productName="Kwarc 60"
        colorName="Grafit"
      />,
    );
    expect(screen.getByText("zdjęcie w przygotowaniu")).toBeInTheDocument();
  });
});

describe("ProductImage: status brak (placeholdery, docs/09 §5)", () => {
  it("packshot: kwadrat z nazwa, kolorem i podpisem; bez img, svg i canvas", () => {
    const { container } = render(
      <ProductImage entry={packshot} productName="Kwarc 60" colorName="Grafit" />,
    );
    const ph = screen.getByRole("img", {
      name: "Kwarc 60 w kolorze Grafit, ujęcie 3/4 z przodu, zdjęcie w przygotowaniu",
    });
    expect(ph).toHaveClass("tk-obraz", "tk-obraz--packshot", "tk-obraz--placeholder");
    expect(screen.getByText("Kwarc 60")).toBeVisible();
    expect(screen.getByText("Grafit")).toBeVisible();
    expect(screen.getByText("zdjęcie w przygotowaniu")).toBeVisible();
    expect(container.querySelector("img, svg, canvas, picture")).toBeNull();
  });

  it("topdown: prostokat dims_mm z przerywanym obrysem i podpisem w cm", () => {
    const { container } = render(
      <ProductImage entry={topdown} productName="Kwarc 60" colorName="Grafit" />,
    );
    const ph = container.querySelector<HTMLElement>(".tk-obraz--topdown")!;
    expect(ph).toHaveClass("tk-obraz--placeholder");
    expect(ph.style.getPropertyValue("--tk-w")).toBe("293");
    expect(ph.style.getPropertyValue("--tk-d")).toBe("102");
    expect(screen.getByText("Kwarc 60 · 29,3 × 10,2 cm")).toBeInTheDocument();
    expect(ph).toHaveAttribute("aria-hidden", "true");
  });

  it("topdown z decorative=false ma role img i nazwe", () => {
    render(
      <ProductImage entry={topdown} productName="Kwarc 60" colorName="Grafit" decorative={false} />,
    );
    expect(screen.getByRole("img")).toHaveAccessibleName(/zdjęcie w przygotowaniu/);
  });

  it("topdown: podpis w cm formatuje Intl (14 cm bez miejsc po przecinku)", () => {
    expect(topdownCaption("Bazalt 75", { w: 327, d: 140 })).toBe("Bazalt 75 · 32,7 × 14 cm");
  });

  it("texture: wypelnienie kolorem probki przekazanym propsem i wymiar kafla", () => {
    const { container } = render(
      <ProductImage entry={texture} productName="Tafla" colorName="Grafit" swatch="var(--tekst)" />,
    );
    const ph = container.querySelector<HTMLElement>(".tk-obraz--texture")!;
    expect(ph.style.getPropertyValue("--tk-swatch")).toBe("var(--tekst)");
    expect(ph.style.getPropertyValue("--tk-w")).toBe("200");
    expect(ph.style.getPropertyValue("--tk-d")).toBe("200");
  });

  it("texture: wymiary maty z matMm", () => {
    const { container } = render(
      <ProductImage
        entry={texture}
        productName="Tafla"
        colorName="Grafit"
        swatch="var(--tekst)"
        matMm={{ w: 900, d: 400 }}
      />,
    );
    const ph = container.querySelector<HTMLElement>(".tk-obraz--texture")!;
    expect(ph.style.getPropertyValue("--tk-w")).toBe("900");
    expect(ph.style.getPropertyValue("--tk-d")).toBe("400");
  });

  it("CLS = 0: placeholder i zdjecie maja te same klasy rozmiaru i zmienne wymiarow", () => {
    for (const entry of [packshot, topdown, texture]) {
      const a = render(
        <ProductImage
          entry={entry}
          productName="X"
          colorName="Y"
          swatch="var(--tekst)"
          decorative
        />,
      ).container.firstElementChild as HTMLElement;
      const b = render(
        <ProductImage
          entry={gotowe(entry)}
          productName="X"
          colorName="Y"
          swatch="var(--tekst)"
          decorative
        />,
      ).container.firstElementChild as HTMLElement;
      expect(a.getAttribute("style")).toBe(b.getAttribute("style"));
      expect(a).toHaveClass(`tk-obraz--${entry.kind}`);
      expect(b).toHaveClass(`tk-obraz--${entry.kind}`);
    }
  });

  it("wszystkie 300 wpisow manifestu renderuje sie jako placeholder o wymiarach z manifestu", () => {
    for (const entry of manifest) {
      const { container, unmount } = render(
        <ProductImage entry={entry} productName="X" colorName="Y" swatch="var(--tekst)" />,
      );
      const el = container.firstElementChild as HTMLElement;
      expect(el, entry.key).toHaveAttribute("data-status", "brak");
      if (entry.kind === "topdown") {
        expect(el.style.getPropertyValue("--tk-w"), entry.key).toBe(String(entry.dims_mm!.w));
        expect(el.style.getPropertyValue("--tk-d"), entry.key).toBe(String(entry.dims_mm!.d));
      }
      unmount();
    }
  });
});

describe("obraz.css", () => {
  const css = readFileSync(join(__dirname, "..", "css", "obraz.css"), "utf8");
  it("rezerwuje miejsce przez aspect-ratio i ma przerywany obrys placeholdera topdown", () => {
    expect(css).toMatch(/\.tk-obraz--packshot[\s\S]*aspect-ratio: 1 \/ 1/);
    expect(css).toMatch(/aspect-ratio: var\(--tk-w\) \/ var\(--tk-d\)/);
    expect(css).toMatch(/dashed var\(--linia-pola\)/);
  });
  it("nie uzywa gradientow ani obrazow tla", () => {
    expect(css).not.toMatch(/gradient|url\(/);
  });
});

describe("axe: 0 naruszen", () => {
  it("placeholdery i zdjecia", async () => {
    const { container } = render(
      <main>
        <h1>Obrazy</h1>
        <ProductImage entry={packshot} productName="Kwarc 60" colorName="Grafit" />
        <ProductImage entry={gotowe(packshot)} productName="Kwarc 60" colorName="Grafit" priority />
        <ProductImage
          entry={topdown}
          productName="Kwarc 60"
          colorName="Grafit"
          decorative={false}
        />
        <ProductImage entry={gotowe(topdown)} productName="Kwarc 60" colorName="Grafit" />
        <ProductImage
          entry={texture}
          productName="Tafla"
          colorName="Grafit"
          swatch="var(--tekst)"
        />
      </main>,
    );
    expect(await axe(container)).toHaveNoViolations();
  });
});
