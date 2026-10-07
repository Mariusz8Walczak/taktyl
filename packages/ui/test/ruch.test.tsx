// TAKTYL-36: ruch w @taktyl/ui - A-06 (zmiana elementu DeskStage: stary znika, nowy po img.decode() wchodzi),
// A-10 (skok serca tylko przy dodaniu), reduced-motion (stan koncowy od razu, nic nie znika), reguly CSS ruchu.
import { act, render } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DeskStage, IconButton } from "../src/index.js";
import type { DeskKeyboard, DeskStageProps, ManifestEntry } from "../src/index.js";

const root = join(__dirname, "..", "..", "..");
const manifest = JSON.parse(
  readFileSync(join(root, "assets/manifest.json"), "utf8"),
) as ManifestEntry[];
const tops = manifest.filter((e) => e.kind === "topdown" && e.key.startsWith("k-"));
const dims = { w: 316, d: 134 };
const keyboard = (e: ManifestEntry, name = "Bazalt 75"): DeskKeyboard => ({
  name,
  colorName: "Grafit",
  dimsMm: dims,
  entry: e,
});
const base: Pick<DeskStageProps, "zoneMm" | "gapMm" | "marginMm"> = {
  zoneMm: 220,
  gapMm: 40,
  marginMm: 20,
};
const a = tops[0]!;
const b = tops[1]!;

function endAnimation(el: Element): void {
  const ev = new Event("animationend", { bubbles: true });
  Object.assign(ev, { animationName: "tk-test" });
  act(() => {
    el.dispatchEvent(ev);
  });
}
function matchMediaReduce(matches: boolean): void {
  vi.stubGlobal("matchMedia", () => ({
    matches,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
  }));
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("A-06: zmiana elementu w DeskStage", () => {
  it("pierwszy render bez ruchu: jedna warstwa, bez klas ruchu", () => {
    const { container } = render(<DeskStage {...base} keyboard={keyboard(a)} />);
    const layers = container.querySelectorAll(".scena__klawiatura");
    expect(layers).toHaveLength(1);
    expect(layers[0]!.className).not.toMatch(/is-(czeka|wejscie|wyjscie)/);
  });

  it("zmiana: stary dostaje is-wyjscie, nowy is-wejscie; po animationend zostaje jedna warstwa", () => {
    const { container, rerender } = render(<DeskStage {...base} keyboard={keyboard(a)} />);
    rerender(<DeskStage {...base} keyboard={keyboard(b, "Inny")} />);
    const layers = () => [...container.querySelectorAll<HTMLElement>(".scena__klawiatura")];
    expect(layers()).toHaveLength(2);
    expect(layers()[0]!.className).toContain("is-wyjscie");
    expect(layers()[1]!.className).toContain("is-wejscie");
    endAnimation(layers()[0]!); // koniec wyjscia starego
    expect(layers()).toHaveLength(1);
    endAnimation(layers()[0]!); // koniec wejscia nowego: klasa schodzi (will-change tylko na czas animacji)
    expect(layers()[0]!.className).not.toMatch(/is-(czeka|wejscie|wyjscie)/);
  });

  it("nowy element czeka na img.decode(): do tego czasu niewidoczny (is-czeka), stary jeszcze nie znika", async () => {
    let resolve: () => void = () => undefined;
    const decode = vi.fn(
      () =>
        new Promise<void>((r) => {
          resolve = r;
        }),
    );
    Object.defineProperty(HTMLImageElement.prototype, "decode", {
      value: decode,
      configurable: true,
    });
    try {
      const ready = (e: ManifestEntry) => ({ ...e, status: "gotowe" as const });
      const { container, rerender } = render(<DeskStage {...base} keyboard={keyboard(ready(a))} />);
      rerender(<DeskStage {...base} keyboard={keyboard(ready(b), "Inny")} />);
      const layers = () => [...container.querySelectorAll<HTMLElement>(".scena__klawiatura")];
      expect(decode).toHaveBeenCalled();
      expect(layers()[1]!.className).toContain("is-czeka");
      expect(layers()[0]!.className).not.toContain("is-wyjscie");
      await act(async () => {
        resolve();
      });
      expect(layers()[1]!.className).toContain("is-wejscie");
      expect(layers()[0]!.className).toContain("is-wyjscie");
    } finally {
      delete (HTMLImageElement.prototype as { decode?: unknown }).decode;
    }
  });

  it("zapas czasowy: gdy decode() nie wraca, nowy element i tak wchodzi", async () => {
    vi.useFakeTimers();
    Object.defineProperty(HTMLImageElement.prototype, "decode", {
      value: () => new Promise<void>(() => undefined),
      configurable: true,
    });
    try {
      const ready = (e: ManifestEntry) => ({ ...e, status: "gotowe" as const });
      const { container, rerender } = render(<DeskStage {...base} keyboard={keyboard(ready(a))} />);
      rerender(<DeskStage {...base} keyboard={keyboard(ready(b), "Inny")} />);
      await act(async () => {
        await vi.advanceTimersByTimeAsync(1100);
      });
      const layers = [...container.querySelectorAll<HTMLElement>(".scena__klawiatura")];
      expect(layers[layers.length - 1]!.className).toContain("is-wejscie");
    } finally {
      delete (HTMLImageElement.prototype as { decode?: unknown }).decode;
    }
  });

  it("zapas czasowy: bez animationend warstwa wychodzaca jest sprzatana", async () => {
    vi.useFakeTimers();
    const { container, rerender } = render(<DeskStage {...base} keyboard={keyboard(a)} />);
    rerender(<DeskStage {...base} keyboard={keyboard(b, "Inny")} />);
    expect(container.querySelectorAll(".scena__klawiatura")).toHaveLength(2);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(700);
    });
    expect(container.querySelectorAll(".scena__klawiatura")).toHaveLength(1);
  });

  it("prefers-reduced-motion: wymiana od razu, nic nie znika z opoznieniem, brak klas ruchu", () => {
    matchMediaReduce(true);
    const { container, rerender } = render(<DeskStage {...base} keyboard={keyboard(a)} />);
    rerender(<DeskStage {...base} keyboard={keyboard(b, "Inny")} />);
    const layers = container.querySelectorAll<HTMLElement>(".scena__klawiatura");
    expect(layers).toHaveLength(1);
    expect(layers[0]!.className).not.toMatch(/is-(czeka|wejscie|wyjscie)/);
  });

  it("usuniecie elementu: warstwa wychodzaca znika po animacji", () => {
    const { container, rerender } = render(<DeskStage {...base} keyboard={keyboard(a)} />);
    rerender(<DeskStage {...base} />);
    const layer = container.querySelector<HTMLElement>(".scena__klawiatura")!;
    expect(layer.className).toContain("is-wyjscie");
    endAnimation(layer);
    expect(container.querySelector(".scena__klawiatura")).toBeNull();
  });
});

describe("A-10: skok serca", () => {
  it("skacze tylko przy przejsciu z nie na tak, nie przy montowaniu ani usuwaniu", () => {
    const first = render(<IconButton icon="heart" aria-label="Ulubione" pressed />);
    expect(first.getByRole("button").className).not.toContain("is-skok");
    first.unmount();
    const { getByRole, rerender } = render(
      <IconButton icon="heart" aria-label="Ulubione" pressed={false} />,
    );
    expect(getByRole("button").className).not.toContain("is-skok");
    rerender(<IconButton icon="heart" aria-label="Ulubione" pressed />);
    expect(getByRole("button").className).toContain("is-skok");
    const ev = new Event("animationend", { bubbles: true });
    Object.assign(ev, { animationName: "tk-serce" });
    act(() => {
      getByRole("button").dispatchEvent(ev);
    });
    expect(getByRole("button").className).not.toContain("is-skok");
    rerender(<IconButton icon="heart" aria-label="Ulubione" pressed={false} />);
    expect(getByRole("button").className).not.toContain("is-skok");
  });

  it("zapas czasowy zdejmuje klase, gdy animationend nie nadejdzie (reduced-motion)", async () => {
    vi.useFakeTimers();
    const { getByRole, rerender } = render(
      <IconButton icon="heart" aria-label="Ulubione" pressed={false} />,
    );
    rerender(<IconButton icon="heart" aria-label="Ulubione" pressed />);
    expect(getByRole("button").className).toContain("is-skok");
    await act(async () => {
      await vi.advanceTimersByTimeAsync(600);
    });
    expect(getByRole("button").className).not.toContain("is-skok");
  });
});

describe("CSS ruchu (TAKTYL-36)", () => {
  const scena = readFileSync(join(__dirname, "..", "css", "scena.css"), "utf8");
  it("A-02: kolejnosc, brak opacity:0 na macie, klawiaturze i myszce (LCP), reduced-motion wylacza", () => {
    for (const k of ["mata", "klawiatura", "myszka", "strefa"]) {
      expect(scena).toContain(`.scena-start .scena__${k}`);
    }
    const frames = (name: string) =>
      scena.match(new RegExp(`@keyframes ${name} \\{[^]*?\\n\\}`))![0];
    for (const n of ["tk-mata-wejscie", "tk-opadanie", "tk-wjazd-z-prawej"]) {
      expect(frames(n)).not.toContain("opacity");
    }
    expect(frames("tk-pojawienie")).toContain("opacity: 0");
    expect(scena).toMatch(/prefers-reduced-motion: reduce[^]*\.scena-start \.scena__mata/);
  });

  it("A-06: wejscie translateY(-12px) + opacity, wyjscie opacity + translateY(6px)", () => {
    expect(scena).toMatch(/tk-obiekt-we \{[^}]*from \{[^}]*opacity: 0;[^}]*translateY\(-12px\)/);
    expect(scena).toMatch(/tk-obiekt-wy \{[^}]*to \{[^}]*opacity: 0;[^}]*translateY\(6px\)/);
  });
});
