// TAKTYL-79 (docs/03 par. 3, par. 9; docs/12 par. 3): uklad kreatora na telefonie - podglad kompaktowy <= 30% ekranu,
// wyniki jako zwijana linia, >= 50% okna na tresc kroku, pasek dolny nie zaslania fokusu, brak malych celow i przewijania.
import { expect, test } from "../helpers/fixtures";
import { runDesignAudit } from "../helpers/design-audit";
import { loadPreset } from "../helpers/ui";

test.describe("Kreator: uklad telefonu (TAKTYL-79)", () => {
  test("podglad <= 30% ekranu, tresc kroku >= 50% okna, wyniki zwijane, bez przewijania w poziomie @mobile", async ({
    page,
    isMobile,
  }) => {
    test.skip(!isMobile, "uklad telefonu: tylko projekt mobile");
    await page.goto("/zbuduj-set");
    const vh = page.viewportSize()?.height ?? 0;
    const scene = page.locator(".kreator__scena");
    await expect(scene).toBeVisible();
    expect((await scene.boundingBox())?.height ?? 0).toBeLessThanOrEqual(vh * 0.3);

    // wyniki: zwinieta linia z aria-expanded; klik rozwija liste, drugi klik zwija
    const toggle = page.getByRole("button", { name: /^Wyniki:/ });
    await expect(toggle).toHaveAttribute("aria-expanded", "false");
    await toggle.click();
    await expect(toggle).toHaveAttribute("aria-expanded", "true");
    await toggle.click();
    await expect(toggle).toHaveAttribute("aria-expanded", "false");

    // po przewinieciu: naglowek + (przyklejony) podglad + pasek dolny zostawiaja >= 50% wysokosci na tresc
    await page.evaluate(() => window.scrollBy(0, 300));
    const free = await page.evaluate(() => {
      const bottomOf = (el: Element | null) => (el ? el.getBoundingClientRect().bottom : 0);
      const header = document.querySelector("header");
      const preview = document.querySelector(".kreator__podglad");
      const bar = document.querySelector('[data-testid="pasek-dolny"]');
      const previewTop = preview ? preview.getBoundingClientRect().top : -1;
      const top = Math.max(bottomOf(header), previewTop >= 0 ? bottomOf(preview) : 0);
      const barTop = bar ? bar.getBoundingClientRect().top : window.innerHeight;
      return barTop - top;
    });
    expect(free).toBeGreaterThanOrEqual(vh * 0.5);

    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    ).toBe(true);
  });

  test("elementy z fokusem nie chowaja sie pod paskiem dolnym, a cele dotykowe maja >= 44 px @mobile", async ({
    page,
    isMobile,
  }) => {
    test.skip(!isMobile, "uklad telefonu: tylko projekt mobile");
    await loadPreset(page, "Programista");
    // krok 4 ("Podsumowanie") ma najdluzsza nazwe w pasku krokow: strona nie moze sie poszerzyc ponad 360 px
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    ).toBe(true);
    const bar = page.getByTestId("pasek-dolny");
    await expect(bar.getByRole("button", { name: "Dodaj set do koszyka" })).toBeVisible();
    const barTop = (await bar.boundingBox())?.y ?? 0;
    // Tab przez kontrolki: fokus nigdy nie laduje za paskiem dolnym
    for (let i = 0; i < 25; i++) {
      await page.keyboard.press("Tab");
      const rect = await page.evaluate(() => {
        const el = document.activeElement;
        if (!el || el === document.body || el.closest('[data-testid="pasek-dolny"]')) return null;
        const r = el.getBoundingClientRect();
        return { top: r.top, bottom: r.bottom };
      });
      if (rect) expect(rect.bottom).toBeLessThanOrEqual(barTop + 1);
    }
    const audit = await runDesignAudit(page);
    // pola formularza ukryte w kafelkach (radio w etykiecie) maja wlasny cel w etykiecie
    const small = audit.male_cele.filter((html) => !/type="(radio|checkbox)"/.test(html));
    expect(small).toEqual([]);
  });
});
