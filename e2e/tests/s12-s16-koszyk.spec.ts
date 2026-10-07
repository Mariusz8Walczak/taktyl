// I-010 (TAKTYL-44): scenariusze S12-S16 z docs/12 par. 1 (koszyk: szuflada A-03, grupa setu, kody, rozbicie setu, darmowa dostawa).
import type { Page } from "@playwright/test";
import { expect, test } from "../helpers/fixtures";
import {
  addProductToCart,
  applyCode,
  cartCounter,
  definition,
  goToCartPage,
  loadPreset,
  openCartDrawer,
  pick,
} from "../helpers/ui";

async function counterValue(page: Page): Promise<number> {
  const counter = cartCounter(page);
  return (await counter.count()) === 0 ? 0 : Number((await counter.textContent()) ?? 0);
}

/** Dodaje do koszyka gotowy set Programista i zostawia otwarta szuflade. */
async function addProgramistaSet(page: Page) {
  await loadPreset(page, "Programista");
  await page.getByRole("button", { name: "Dodaj set do koszyka" }).click();
  return openCartDrawer(page);
}

test.describe("Koszyk (S12-S16)", () => {
  test("S12: „Dodaj set do koszyka”: szuflada, grupa „Twój set · −10%”, licznik +1, dostawa darmowa @mobile", async ({
    page,
    isMobile,
  }) => {
    test.fixme(
      isMobile,
      "TAKTYL-79: na 360 px przyklejony podglad kreatora zaslania przyciski gotowych setow",
    );
    await loadPreset(page, "Programista");
    const before = await counterValue(page);

    await page.getByRole("button", { name: "Dodaj set do koszyka" }).click();

    const drawer = await openCartDrawer(page);
    const group = drawer.getByRole("region", { name: "Twój set · −10%" });
    await expect(group).toBeVisible();
    for (const name of ["Bazalt 75", "Pustułka", "Szron"]) {
      await expect(group.getByRole("button", { name: `Usuń z setu: ${name}` })).toBeVisible();
    }
    await expect(definition(group, "Razem")).toContainText("1203,30 zł");
    await expect(
      drawer.getByRole("status").filter({ hasText: "Dostawa jest darmowa." }),
    ).toBeVisible();
    await expect.poll(() => counterValue(page)).toBe(before + 1);
  });

  test("S13: kod TAKTYL10 przy samym secie: „Kod nie obejmuje setów — rabat za set jest już naliczony.”", async ({
    page,
  }) => {
    await addProgramistaSet(page);
    await goToCartPage(page);

    await applyCode(page, "TAKTYL10");

    await expect(
      page.getByText("Kod nie obejmuje setów — rabat za set jest już naliczony."),
    ).toBeVisible();
    const totals = page.getByRole("complementary", { name: "Podsumowanie" });
    await expect(definition(totals, "Razem")).toContainText("1203,30 zł");
  });

  test("S14: set i osobno Tafla M Grafit, kod TAKTYL10: rabat kodu −6,90 zł, razem 1265,40 zł", async ({
    page,
  }) => {
    await addProgramistaSet(page);

    await page.goto("/podkladki/tafla");
    await pick(page, "radio", /^M 36/);
    await page.getByRole("button", { name: "Dodaj do koszyka" }).click();
    await openCartDrawer(page);
    await goToCartPage(page);

    await applyCode(page, "TAKTYL10");

    const totals = page.getByRole("complementary", { name: "Podsumowanie" });
    await expect(definition(totals, "Kod rabatowy")).toContainText("−6,90 zł");
    await expect(definition(totals, "Razem")).toContainText("1265,40 zł");
    // Kod dotyczy tylko pozycji spoza setu: grupa setu zachowuje rabat 10%.
    await expect(page.getByRole("region", { name: "Twój set · −10%" })).toBeVisible();
  });

  test("S15: usunięcie klawiatury z grupy setu: „Set rozdzielony — rabat 10% usunięty. Cofnij”, „Cofnij” przywraca grupę i rabat", async ({
    page,
  }) => {
    await addProgramistaSet(page);
    await goToCartPage(page);
    const group = page.getByRole("region", { name: "Twój set · −10%" });
    await expect(group).toBeVisible();

    await group.getByRole("button", { name: "Usuń z setu: Bazalt 75" }).click();

    await expect(page.getByText(/Set rozdzielony — rabat 10% usunięty\./)).toBeVisible();
    await expect(page.getByRole("region", { name: "Twój set · −10%" })).toHaveCount(0);
    const totals = page.getByRole("complementary", { name: "Podsumowanie" });
    await expect(definition(totals, "Razem")).toContainText("588,00 zł");

    await page.getByRole("button", { name: "Cofnij" }).click();

    await expect(page.getByRole("region", { name: "Twój set · −10%" })).toBeVisible();
    await expect(definition(totals, "Rabat za set")).toContainText("−133,70 zł");
    await expect(definition(totals, "Razem")).toContainText("1203,30 zł");
  });

  test("S16: koszyk z samym Wróblem: „Brakuje 170,00 zł do darmowej dostawy” @mobile", async ({
    page,
  }) => {
    await addProductToCart(page, "/myszki/wrobel");
    const drawer = await openCartDrawer(page);
    await expect(
      drawer.getByRole("status").filter({ hasText: "Brakuje 170,00 zł do darmowej dostawy" }),
    ).toBeVisible();

    await goToCartPage(page);
    await expect(
      page.getByRole("status").filter({ hasText: "Brakuje 170,00 zł do darmowej dostawy" }),
    ).toBeVisible();
  });
});
