// TAKTYL-36: ruch w sklepie - A-04 (animujKwote), A-02 (hak sesyjny), A-16 (is-komplet), A-03 (licznik koszyka),
// reduced-motion (stan koncowy od razu). Logika bez przegladarki; wyglad i Layout sprawdzane osobno w przegladarce.
import { act, render, renderHook, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ToastProvider } from "@taktyl/ui";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Builder } from "../src/components/builder/builder";
import { SceneIntro } from "../src/components/motion/scene-intro";
import { Kwota } from "../src/components/motion/kwota";
import { CartLink } from "../src/components/layout/cart-link";
import { CART_CHANGED_EVENT, CART_STORAGE_KEY } from "../src/lib/cart/count";
import { animujKwote } from "../src/lib/motion/animuj-kwote";
import { SCENE_SESSION_KEY } from "../src/lib/motion/scene-start";
import { COMPLETE_FALLBACK_MS, useCompleteRing } from "../src/lib/motion/set-complete";
import { builderData } from "./builder-fixtures";

const nb = (t: string | null | undefined) => (t ?? "").replace(/[\u00a0\u202f]/g, " ");

function fireAnimationEnd(el: Element, animationName: string): void {
  const ev = new Event("animationend", { bubbles: true });
  Object.assign(ev, { animationName });
  act(() => {
    el.dispatchEvent(ev);
  });
}
function stubReducedMotion(reduce: boolean): void {
  vi.stubGlobal("matchMedia", (q: string) => ({
    matches: reduce && q.includes("prefers-reduced-motion"),
    media: q,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
  }));
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("A-04: animujKwote", () => {
  function setup() {
    document.body.innerHTML = `<span data-kwota><span id="v">1203,30 zł</span><span data-kwota-live aria-live="polite">1203,30 zł</span></span>`;
    return {
      el: document.getElementById("v") as HTMLElement,
      live: document.querySelector("[data-kwota-live]") as HTMLElement,
    };
  }

  it("prefers-reduced-motion: wartosc koncowa od razu, region live dostaje wynik", () => {
    stubReducedMotion(true);
    const { el, live } = setup();
    animujKwote(el, 120330, 125000, 300);
    expect(nb(el.textContent)).toBe("1250,00 zł");
    expect(nb(live.textContent)).toBe("1250,00 zł");
  });

  it("rowne wartosci: bez ruchu", () => {
    const { el, live } = setup();
    const raf = vi.spyOn(globalThis, "requestAnimationFrame");
    animujKwote(el, 120330, 120330, 300);
    expect(raf).not.toHaveBeenCalled();
    expect(nb(el.textContent)).toBe("1203,30 zł");
    expect(nb(live.textContent)).toBe("1203,30 zł");
  });

  it("czas 0 (token wyzerowany): wartosc koncowa od razu", () => {
    const { el } = setup();
    animujKwote(el, 120330, 100000, 0);
    expect(nb(el.textContent)).toBe("1000,00 zł");
  });

  it("w trakcie: wartosci posrednie w widocznym elemencie, czytnik dostaje WYLACZNIE wynik koncowy", () => {
    vi.useFakeTimers({ toFake: ["requestAnimationFrame", "cancelAnimationFrame", "performance"] });
    const { el, live } = setup();
    const seen: string[] = [];
    const obs = new MutationObserver(() => undefined);
    obs.observe(live, { childList: true, characterData: true, subtree: true });
    animujKwote(el, 100000, 120000, 300);
    vi.advanceTimersByTime(150);
    const mid = Number(
      nb(el.textContent)
        .replace(/[^\d,]/g, "")
        .replace(",", "."),
    );
    expect(mid).toBeGreaterThan(1000);
    expect(mid).toBeLessThan(1200);
    expect(nb(live.textContent)).toBe("1203,30 zł"); // nadal stara wartosc: zero ogloszen w trakcie
    seen.push(nb(live.textContent));
    vi.advanceTimersByTime(400);
    expect(nb(el.textContent)).toBe("1200,00 zł");
    expect(nb(live.textContent)).toBe("1200,00 zł");
    obs.disconnect();
    expect(seen).toEqual(["1203,30 zł"]);
  });

  it("kolejne wywolanie przerywa poprzednie (bez migotania wartoscia ze starej animacji)", () => {
    vi.useFakeTimers({ toFake: ["requestAnimationFrame", "cancelAnimationFrame", "performance"] });
    const { el } = setup();
    animujKwote(el, 100000, 120000, 300);
    vi.advanceTimersByTime(100);
    animujKwote(el, 110000, 90000, 300);
    vi.advanceTimersByTime(400);
    expect(nb(el.textContent)).toBe("900,00 zł");
  });

  it("szerokosc nie skacze: .kwota ma cyfry tabelaryczne", () => {
    const css = readFileSync(join(__dirname, "..", "src", "styles", "builder.css"), "utf8");
    expect(css).toMatch(/\.kwota \{[^}]*font-variant-numeric: tabular-nums/);
  });
});

describe("A-04: komponent Kwota", () => {
  it("renderuje wartosc, aria-hidden na widocznej i region live; zmiana props ustawia wynik koncowy", () => {
    const { container, rerender } = render(<Kwota gr={120330} />);
    const visible = container.querySelector(".kwota__wartosc")!;
    const live = container.querySelector("[data-kwota-live]")!;
    expect(visible).toHaveAttribute("aria-hidden", "true");
    expect(nb(visible.textContent)).toBe("1203,30 zł");
    expect(nb(live.textContent)).toBe("1203,30 zł");
    rerender(<Kwota gr={100000} />);
    expect(nb(visible.textContent)).toBe("1000,00 zł"); // jsdom: brak tokenu czasu -> bez animacji
    expect(nb(live.textContent)).toBe("1000,00 zł");
  });
});

describe("A-02: hak sesyjny", () => {
  type Cb = (entries: { isIntersecting: boolean }[]) => void;
  let callbacks: Cb[];
  beforeEach(() => {
    callbacks = [];
    class IO {
      constructor(cb: Cb) {
        callbacks.push(cb);
      }
      observe() {}
      disconnect() {}
    }
    vi.stubGlobal("IntersectionObserver", IO);
  });
  const stage = () => screen.getByTestId("scena").parentElement as HTMLElement;
  const mount = () =>
    render(
      <SceneIntro>
        <div data-testid="scena" />
      </SceneIntro>,
    );

  it("klasa scena-start dopiero po zgloszeniu widocznosci, raz na sesje (sessionStorage)", () => {
    const first = mount();
    expect(stage()).not.toHaveClass("scena-start");
    act(() => callbacks[0]!([{ isIntersecting: false }]));
    expect(stage()).not.toHaveClass("scena-start");
    act(() => callbacks[0]!([{ isIntersecting: true }]));
    expect(stage()).toHaveClass("scena-start");
    expect(window.sessionStorage.getItem(SCENE_SESSION_KEY)).toBe("1");
    first.unmount();
    callbacks.length = 0;
    mount();
    expect(callbacks).toHaveLength(0); // druga wizyta w tej sesji: nawet nie obserwujemy
    expect(stage()).not.toHaveClass("scena-start");
  });

  it("klasa schodzi po animationend ostatniej animacji (nie po animacji potomka o innej nazwie)", () => {
    mount();
    act(() => callbacks[0]!([{ isIntersecting: true }]));
    fireAnimationEnd(screen.getByTestId("scena"), "tk-opadanie");
    expect(stage()).toHaveClass("scena-start");
    fireAnimationEnd(screen.getByTestId("scena"), "tk-pojawienie");
    expect(stage()).not.toHaveClass("scena-start");
  });

  it("zapas czasowy zdejmuje klase, gdy animationend nie nadejdzie", async () => {
    vi.useFakeTimers();
    mount();
    act(() => callbacks[0]!([{ isIntersecting: true }]));
    expect(stage()).toHaveClass("scena-start");
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1600);
    });
    expect(stage()).not.toHaveClass("scena-start");
  });

  it("sessionStorage rzuca wyjatek (tryb prywatny): bez bledu, animacja gra, zapas w pamieci", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new DOMException("zablokowane", "SecurityError");
    });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new DOMException("zablokowane", "SecurityError");
    });
    mount();
    act(() => callbacks[0]!([{ isIntersecting: true }]));
    expect(stage()).toHaveClass("scena-start");
  });

  it("prefers-reduced-motion: sekwencji nie ma (stan koncowy od razu), sesja oznaczona", () => {
    stubReducedMotion(true);
    mount();
    expect(callbacks).toHaveLength(0);
    expect(stage()).not.toHaveClass("scena-start");
    expect(window.sessionStorage.getItem(SCENE_SESSION_KEY)).toBe("1");
  });

  it("bez IntersectionObserver: start od razu", () => {
    vi.unstubAllGlobals();
    vi.stubGlobal("IntersectionObserver", undefined);
    mount();
    expect(stage()).toHaveClass("scena-start");
  });
});

describe("A-16: is-komplet", () => {
  const data = builderData();
  const aside = () => screen.getByRole("complementary", { name: "Podsumowanie setu" });
  const renderBuilder = (search: string) => {
    window.history.replaceState(null, "", `/zbuduj-set?${search}`);
    return render(
      <ToastProvider>
        <Builder data={data} initialSearch={search} />
      </ToastProvider>,
    );
  };

  it("wczytanie gotowego setu (3 kategorie) nie uruchamia ringu", () => {
    renderBuilder("preset=programista");
    expect(aside()).not.toHaveClass("is-komplet");
  });

  it("2 -> 3: klasa jest; animationend potomka (inna nazwa) jej nie zdejmuje, 'obieg' tak", async () => {
    const user = userEvent.setup();
    renderBuilder("profil=programowanie&k=K-BZL75-GRF-PRG&m=M-PST-GRF&krok=podkladka");
    await user.click(screen.getByRole("radio", { name: /Szron/ }));
    expect(aside()).toHaveClass("is-komplet");
    const rabat = aside().querySelector(".ceny__wiersz--rabat") as HTMLElement;
    expect(rabat).not.toBeNull();
    fireAnimationEnd(rabat, "tk-rabat-we");
    expect(aside()).toHaveClass("is-komplet");
    fireAnimationEnd(aside(), "obieg");
    expect(aside()).not.toHaveClass("is-komplet");
  });

  it("zmiana trzeciego elementu po skompletowaniu nie uruchamia ringu ponownie", async () => {
    const user = userEvent.setup();
    renderBuilder("profil=programowanie&k=K-BZL75-GRF-PRG&m=M-PST-GRF&krok=podkladka");
    await user.click(screen.getByRole("radio", { name: /Szron/ }));
    fireAnimationEnd(aside(), "obieg");
    await user.click(screen.getByRole("radio", { name: /Tafla/ }));
    expect(aside()).not.toHaveClass("is-komplet");
  });

  it("zapas czasowy (reduced-motion: animationend nie nadejdzie) zdejmuje klase", () => {
    vi.useFakeTimers();
    const clear = vi.fn();
    renderHook(() => useCompleteRing(true, clear));
    expect(clear).not.toHaveBeenCalled();
    act(() => {
      vi.advanceTimersByTime(COMPLETE_FALLBACK_MS + 1);
    });
    expect(clear).toHaveBeenCalledTimes(1);
  });

  it("CSS: pierscien @property, animacja o nazwie obieg raz, reduced-motion wylacza", () => {
    const css = readFileSync(join(__dirname, "..", "src", "styles", "builder.css"), "utf8");
    expect(css).toContain("@property --kat");
    expect(css).toMatch(/animation: obieg var\(--d-scena\) var\(--e-wyjscie\) 1 forwards/);
    expect(css).toMatch(/prefers-reduced-motion: reduce\)[^]*is-komplet::before/);
  });
});

describe("A-03: licznik koszyka", () => {
  const cartWith = (qty: number) =>
    window.localStorage.setItem(
      CART_STORAGE_KEY,
      JSON.stringify({ lines: [{ type: "item", sku: "K-BZL75-GRF-PRG", qty }] }),
    );
  const notify = () => act(() => void window.dispatchEvent(new Event(CART_CHANGED_EVENT)));

  it("podskakuje przy dodaniu, nie przy wczytaniu strony ani przy usuwaniu", async () => {
    cartWith(1);
    render(<CartLink />);
    const counter = () => screen.getByTestId("licznik-koszyka");
    await waitFor(() => expect(counter()).toHaveTextContent("1"));
    expect(counter().className).not.toContain("is-skok");
    cartWith(2);
    notify();
    await waitFor(() => expect(counter().className).toContain("is-skok"));
    cartWith(1);
    notify();
    await waitFor(() => expect(counter()).toHaveTextContent("1"));
    expect(within(document.body).getByTestId("licznik-koszyka")).toBeInTheDocument();
  });
});

describe("CSS A-03, A-07, A-08", () => {
  const read = (f: string) => readFileSync(join(__dirname, "..", "src", "styles", f), "utf8");
  it("A-07: pasek krokow = scaleX od lewej z przejsciem --d-l", () => {
    expect(read("builder.css")).toMatch(
      /\.kroki__wypelnienie \{[^}]*scaleX[^}]*transform-origin: left;[^}]*transition: transform var\(--d-l\) var\(--e-wyjscie\)/,
    );
  });
  it("A-11: pasek darmowej dostawy = scaleX z przejsciem --d-l", () => {
    expect(read("cart.css")).toMatch(
      /\.koszyk-dostawa__wypelnienie \{[^}]*scaleX[^}]*transition: transform var\(--d-l\)/,
    );
  });
  it("A-03: skok licznika scale 1.25, reduced-motion wylacza", () => {
    const css = read("animacje.css");
    expect(css).toMatch(/tk-skok-licznika \{[^}]*scale: 1\.25/);
    expect(css).toMatch(/prefers-reduced-motion: reduce\)[^]*\.licznik\.is-skok/);
  });
});
