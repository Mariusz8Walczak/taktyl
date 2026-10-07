// F-106: komponent DeskStage (docs/03 §5). Dane z data/*.json i assets/manifest.json.
import { render, screen } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { axe } from "vitest-axe";
import { DeskStage, findManifestEntry } from "../src/index.js";
import type { DeskKeyboard, DeskPad, DeskStageProps, ManifestEntry } from "../src/index.js";

const root = join(__dirname, "..", "..", "..");
const json = <T,>(p: string): T => JSON.parse(readFileSync(join(root, p), "utf8")) as T;
interface RawProduct {
  slug: string;
  name: string;
  attributes: {
    dims_mm: { w: number; d: number };
    sizes: Record<string, { label: string; w: number; d: number; type: "biurko" | "mysz" }>;
  };
}
const manifest = json<ManifestEntry[]>("assets/manifest.json");
const products = json<RawProduct[]>("data/products.json");
const colors = json<Record<string, { label: string; swatch: string }>>("data/colors.json");
const rules = json<{
  profiles: Record<string, { mouse_zone_mm: number }>;
  gap_keyboard_mouse_mm: number;
  edge_margin_mm: number;
}>("data/rules.json");

const entry = (key: string): ManifestEntry => {
  const e = findManifestEntry(manifest, key);
  if (!e) throw new Error(`brak ${key}`);
  return e;
};
const gotowe = (e: ManifestEntry): ManifestEntry => ({ ...e, status: "gotowe" });
const prod = (slug: string): RawProduct => products.find((p) => p.slug === slug)!;
const grafit = colors["grafit"]!;

const kb = (e = entry("k-bazalt-75_grafit_top")): DeskKeyboard => ({
  name: prod("bazalt-75").name,
  colorName: grafit.label,
  dimsMm: prod("bazalt-75").attributes.dims_mm,
  entry: e,
});
const mouse = (e = entry("m-pustulka_grafit_top")): DeskKeyboard => ({
  name: prod("pustulka").name,
  colorName: grafit.label,
  dimsMm: prod("pustulka").attributes.dims_mm,
  entry: e,
});
const padOf = (size: string, e = entry("p-szron_grafit_tekstura")): DeskPad => ({
  name: prod("szron").name,
  sizeLabel: prod("szron").attributes.sizes[size]!.label,
  colorName: grafit.label,
  sizeMm: prod("szron").attributes.sizes[size]!,
  entry: e,
  swatch: grafit.swatch,
});

const base: Pick<DeskStageProps, "zoneMm" | "gapMm" | "marginMm"> = {
  zoneMm: rules.profiles["programowanie"]!.mouse_zone_mm,
  gapMm: rules.gap_keyboard_mouse_mm,
  marginMm: rules.edge_margin_mm,
};
const ok = { status: "ok", spareMm: 283 } as const;

describe("DeskStage", () => {
  it("aria-label skladany z danych: nazwy, mata, zapas", () => {
    render(<DeskStage {...base} keyboard={kb()} mouse={mouse()} pad={padOf("xl")} result={ok} />);
    expect(screen.getByRole("img")).toHaveAttribute(
      "aria-label",
      "Podgląd: Bazalt 75 i Pustułka na macie Szron XL. Zapas 28,3 cm.",
    );
  });

  it("aria-label: uwaga z brakiem, podkladka pod myszke, bez podkladki", () => {
    const { rerender } = render(
      <DeskStage
        {...base}
        keyboard={kb()}
        mouse={mouse()}
        pad={padOf("l")}
        result={{ status: "uwaga", shortfallMm: 40 }}
      />,
    );
    expect(screen.getByRole("img").getAttribute("aria-label")).toBe(
      "Podgląd: Bazalt 75 i Pustułka na podkładce Szron L. Uwaga: brakuje 4 cm.",
    );
    rerender(<DeskStage {...base} keyboard={kb()} mouse={mouse()} />);
    expect(screen.getByRole("img").getAttribute("aria-label")).toBe(
      "Podgląd: Bazalt 75 i Pustułka bez podkładki.",
    );
  });

  it("status brak: placeholdery (klawiatura, mysz, tekstura), podpis strefy i plakietka wyniku", () => {
    const { container } = render(
      <DeskStage
        {...base}
        keyboard={kb()}
        mouse={mouse()}
        pad={padOf("xl")}
        result={ok}
        initialScale={1}
      />,
    );
    expect(container.querySelectorAll(".tk-obraz--placeholder")).toHaveLength(3);
    expect(container.querySelector("img")).toBeNull();
    expect(screen.getByText("Ruch myszki: 22 cm")).toBeInTheDocument();
    expect(container.querySelector(".scena__wynik")).toHaveTextContent("Pasuje · zapas 28,3 cm");
    // klasy-haki A-02 / A-06
    for (const k of ["mata", "klawiatura", "myszka", "strefa", "wynik"]) {
      expect(container.querySelector(`.scena__${k}`)).not.toBeNull();
    }
  });

  it("status gotowe: obrazy z alt pustym i srcset, tekstura jako tlo (bez placeholdera)", () => {
    const { container } = render(
      <DeskStage
        {...base}
        keyboard={kb(gotowe(entry("k-bazalt-75_grafit_top")))}
        mouse={mouse(gotowe(entry("m-pustulka_grafit_top")))}
        pad={padOf("xl", gotowe(entry("p-szron_grafit_tekstura")))}
      />,
    );
    const imgs = container.querySelectorAll("img");
    expect(imgs).toHaveLength(2);
    imgs.forEach((i) => {
      expect(i).toHaveAttribute("alt", "");
      expect(i.getAttribute("srcset")).toMatch(/1x.*2x/);
    });
    expect(container.querySelector(".tk-obraz--placeholder")).toBeNull();
  });

  it("podpis placeholdera tylko gdy po przeskalowaniu >= 80 px w obu wymiarach", () => {
    const wide = render(<DeskStage {...base} keyboard={kb()} mouse={mouse()} initialScale={1} />);
    // klawiatura 327 x 140 przy skali 1: podpis jest; mysz 66 x 126: za waska, bez podpisu
    expect(wide.container.textContent).toContain("Bazalt 75 ·");
    expect(wide.container.textContent).not.toContain("Pustułka ·");
    wide.unmount();
    const small = render(
      <DeskStage {...base} keyboard={kb()} mouse={mouse()} initialScale={0.2} />,
    );
    expect(small.container.textContent).not.toContain("Bazalt 75 ·");
  });

  it("trzy uklady: brak podkladki, mata, podkladka pod myszke", () => {
    const { container, rerender } = render(<DeskStage {...base} keyboard={kb()} mouse={mouse()} />);
    const rootEl = () => container.firstElementChild as HTMLElement;
    expect(rootEl().dataset["layout"]).toBe("brak");
    expect(screen.getByTestId("desk-pad-hint")).toHaveTextContent(
      "Tu będzie podkładka (XL: 90 × 40 cm)",
    );
    expect(rootEl().style.getPropertyValue("--tk-sc-w")).toBe("900");
    rerender(<DeskStage {...base} keyboard={kb()} mouse={mouse()} pad={padOf("xl")} />);
    expect(rootEl().dataset["layout"]).toBe("mata");
    expect(screen.queryByTestId("desk-pad-hint")).toBeNull();
    rerender(<DeskStage {...base} keyboard={kb()} mouse={mouse()} pad={padOf("l")} />);
    expect(rootEl().dataset["layout"]).toBe("podkladka");
  });

  it("strefa poza podkladka pokazana, stan uwaga oznaczony", () => {
    const { container } = render(
      <DeskStage
        {...base}
        zoneMm={500}
        keyboard={kb()}
        mouse={mouse()}
        pad={padOf("l")}
        result={{ status: "uwaga", shortfallMm: 50 }}
      />,
    );
    expect(screen.getByTestId("desk-zone-outside")).toBeInTheDocument();
    expect(screen.getByTestId("desk-zone")).toHaveClass("is-uwaga");
    expect(container.querySelector(".scena__wynik")).toHaveTextContent("Uwaga · brakuje 5 cm");
  });

  it("prop compact dodaje modyfikator; rezerwacja miejsca z wymiarow plotna", () => {
    const { container } = render(
      <DeskStage {...base} keyboard={kb()} mouse={mouse()} pad={padOf("xl")} compact />,
    );
    const el = container.firstElementChild as HTMLElement;
    expect(el).toHaveClass("tk-scena--kompakt");
    expect(el.style.getPropertyValue("--tk-sc-w")).toBe(
      String(prod("szron").attributes.sizes["xl"]!.w),
    );
  });

  it("axe: 0 naruszen (placeholdery i obrazy)", async () => {
    const a = render(
      <DeskStage {...base} keyboard={kb()} mouse={mouse()} pad={padOf("xl")} result={ok} />,
    );
    expect(await axe(a.container)).toHaveNoViolations();
    a.unmount();
    const b = render(
      <DeskStage
        {...base}
        keyboard={kb(gotowe(entry("k-bazalt-75_grafit_top")))}
        mouse={mouse(gotowe(entry("m-pustulka_grafit_top")))}
        pad={padOf("xl", gotowe(entry("p-szron_grafit_tekstura")))}
        compact
      />,
    );
    expect(await axe(b.container)).toHaveNoViolations();
  });
});
