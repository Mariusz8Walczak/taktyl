// TAKTYL-68 (WCAG 2.1.1, 2.4.7): pomocniki sciezki "tylko klawiatura". Zadnego click()/check()/fill() na elementach:
// dojscie do celu klawiszem Tab, uruchomienie Enter albo Spacja, tekst przez keyboard.type.
import { expect, type Locator, type Page } from "@playwright/test";

const isActive = (target: Locator): Promise<boolean> =>
  target.evaluate((el) => el === document.activeElement).catch(() => false);

/** Tab (albo Shift+Tab) do skutku, az fokus trafi na `target`; blad, gdy nie da sie dojsc w `max` krokach. */
export async function tabTo(page: Page, target: Locator, max = 120): Promise<void> {
  await expect(target, "cel fokusu ma byc w DOM").toHaveCount(1);
  for (let i = 0; i < max; i++) {
    if (await isActive(target)) return;
    await page.keyboard.press("Tab");
  }
  throw new Error(`Fokus nie dotarl do elementu w ${max} krokach Tab`);
}

/** Dojscie klawiszem Tab i Enter (przyciski i odnosniki). */
export async function pressEnterOn(page: Page, target: Locator): Promise<void> {
  await tabTo(page, target);
  await page.keyboard.press("Enter");
}

/** Dojscie klawiszem Tab i Spacja (przyciski, pola wyboru). */
export async function pressSpaceOn(page: Page, target: Locator): Promise<void> {
  await tabTo(page, target);
  await page.keyboard.press("Space");
}

/** Pole tekstowe: Tab do pola, wpisanie znak po znaku. */
export async function typeInto(page: Page, target: Locator, text: string): Promise<void> {
  await tabTo(page, target);
  await page.keyboard.type(text);
}

/**
 * Kafel wyboru (radio): Tab do grupy (Tab zatrzymuje sie na jednym radiu grupy), potem strzalki do celu.
 * Strzalka w radiu zaznacza je, wiec wystarczy zatrzymac sie na celu.
 */
export async function arrowToRadio(page: Page, target: Locator, max = 12): Promise<void> {
  await expect(target).toHaveCount(1);
  const group = await target.getAttribute("name");
  const sameGroup = (): Promise<boolean> =>
    page.evaluate(
      (name) => {
        const a = document.activeElement as HTMLInputElement | null;
        return a?.type === "radio" && a.name === name;
      },
      group,
    );
  for (let i = 0; i < 160 && !(await sameGroup()); i++) await page.keyboard.press("Tab");
  expect(await sameGroup(), "fokus w grupie radio").toBe(true);
  for (let i = 0; i < max && !(await isActive(target)); i++) await page.keyboard.press("ArrowDown");
  await expect(target).toBeFocused();
  // Tab na radiu zadnej zaznaczonej grupy nie zaznacza go (dopiero strzalka albo Spacja).
  if (!(await target.isChecked())) await page.keyboard.press("Space");
  await expect(target).toBeChecked();
}

/** Obrys fokusu widoczny (WCAG 2.4.7): outline o niezerowej grubosci albo cien w stylu. */
export async function hasVisibleFocusIndicator(target: Locator): Promise<boolean> {
  const check = () =>
    target.evaluate((el) => {
      // Wskaznik moze lezec na samym elemencie albo na kontenerze z :has(:focus-visible) (rozciagniety odnosnik karty).
      let node: Element | null = el;
      for (let depth = 0; node && depth < 4; depth++, node = node.parentElement) {
        const s = getComputedStyle(node);
        const outline = s.outlineStyle !== "none" && parseFloat(s.outlineWidth) > 0;
        const shadow = s.boxShadow !== "none" && s.boxShadow !== "";
        if (outline || shadow) return true;
      }
      return false;
    });
  // Obrys moze dochodzic przejsciem (transition): czekamy krotko na stan ustalony.
  for (let i = 0; i < 10; i++) {
    if (await check()) return true;
    await target.page().waitForTimeout(50);
  }
  return false;
}
