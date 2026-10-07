// I-010 (TAKTYL-44): scenariusze S9-S11 i S21 z docs/12 par. 1 (kreator setu, docs/03 par. 4.4, udostepnianie linku).
import type { Page } from "@playwright/test";
import { expect, test } from "../helpers/fixtures";
import { definition, loadPreset, pick, summary } from "../helpers/ui";

/** Przechodzi do kroku kreatora przez pasek krokow ("1 Klawiatura", ...). */
async function openStep(page: Page, label: RegExp) {
  await page
    .getByRole("navigation", { name: "Kroki kreatora" })
    .getByRole("link", { name: label })
    .click();
}

test.describe("Kreator setu (S9-S11)", () => {
  test("S9: gotowy set Programista: razem 1203,30 zł, „Oszczędzasz 133,70 zł”, „Pasuje”, „Zapas: 28,3 cm” @mobile", async ({
    page,
  }) => {
    // Strona glowna (sekcja "Gotowe sety") jest w budowie: wejscie do kreatora jest z listy "Albo zacznij od gotowego setu".
    await loadPreset(page, "Programista");

    const aside = summary(page);
    await expect(definition(aside, "Razem")).toContainText("1203,30 zł");
    await expect(aside.getByText("Oszczędzasz 133,70 zł")).toBeVisible();
    const fit = aside.getByRole("region", { name: "Dopasowanie" });
    await expect(fit.getByRole("status")).toHaveText("Pasuje");
    await expect(fit).toContainText("Zapas: 28,3 cm");
  });

  test("S10: profil „Gry FPS, niski sens” i Tafla M: „Pasuje z 1 uwagą”, „Zmień na Tafla L (+30,00 zł)”, po kliknięciu „Pasuje”", async ({
    page,
  }) => {
    await loadPreset(page, "Programista");

    await openStep(page, /^0 Do czego\?/);
    await pick(page, "radio", /^Gry FPS, niski sens/);

    await page.getByRole("button", { name: /^Zmień podkładkę/ }).click();
    await pick(page, "radio", /^Pod samą myszkę/);
    await pick(page, "radio", /^Tafla/);
    await pick(page, "radio", /^M 36/);

    const aside = summary(page);
    const fit = aside.getByRole("region", { name: "Dopasowanie" });
    await expect(fit.getByRole("status")).toHaveText("Pasuje z 1 uwagą");
    await expect(fit).toContainText("36 cm");
    await expect(fit).toContainText("40 cm");

    const suggestion = page.getByRole("button", { name: "Zmień na Tafla L (+30,00 zł)" });
    await expect(suggestion).toBeVisible();
    await suggestion.click();

    await expect(fit.getByRole("status")).toHaveText("Pasuje");
    await expect(suggestion).toHaveCount(0);
  });

  test("S11: Marmur 100 + Jerzyk + Szron XL na profilu FPS: uwaga o 91 cm i propozycja Tafla XXL", async ({
    page,
  }) => {
    await page.goto("/zbuduj-set");
    await pick(page, "radio", /^Gry FPS, niski sens/);
    await page.getByRole("button", { name: "Dalej: klawiatura" }).click();

    await pick(page, "radio", /^Marmur 100/);
    await page.getByRole("button", { name: "Dalej: myszka" }).click();

    await pick(page, "radio", /^Jerzyk/);
    await page.getByRole("button", { name: "Dalej: podkładka" }).click();

    await pick(page, "radio", /^Na całe biurko/);
    await pick(page, "radio", /^Szron/);
    await pick(page, "radio", /^XL 90/);
    await page.getByRole("button", { name: "Dalej: podsumowanie" }).click();

    const aside = summary(page);
    const fit = aside.getByRole("region", { name: "Dopasowanie" });
    await expect(fit.getByRole("status")).toHaveText("Pasuje z 1 uwagą");
    await expect(fit).toContainText("ten set potrzebuje 91 cm");
    await expect(page.getByRole("button", { name: /^Zmień na Tafla XXL/ })).toBeVisible();
  });
});

test.describe("Udostępnianie setu (S21)", () => {
  test("S21: „Kopiuj link do setu” i wklejenie w nowej karcie: ten sam set, profil i krok", async ({
    page,
    context,
  }) => {
    await context.grantPermissions(["clipboard-read", "clipboard-write"]);
    await loadPreset(page, "Programista");
    await openStep(page, /^0 Do czego\?/);
    await pick(page, "radio", /^Gry FPS, niski sens/);
    await page.getByRole("button", { name: /^Zmień podkładkę/ }).click();
    await pick(page, "radio", /^Pod samą myszkę/);
    await pick(page, "radio", /^Tafla/);
    await pick(page, "radio", /^M 36/);
    await page.getByRole("button", { name: "Dalej: podsumowanie" }).click();
    await expect(page.getByRole("heading", { name: /Krok 4 z 4: Podsumowanie/ })).toBeVisible();

    await page.getByRole("button", { name: "Kopiuj link do setu" }).click();
    const link = await expect
      .poll(async () => page.evaluate(() => navigator.clipboard.readText()), {
        message: "schowek ma link do setu",
      })
      .toMatch(/\/zbuduj-set\?/)
      .then(() => page.evaluate(() => navigator.clipboard.readText()));

    const fresh = await context.newPage();
    await fresh.goto(link);

    await expect(fresh.getByRole("heading", { name: /Krok 4 z 4: Podsumowanie/ })).toBeVisible();
    const aside = summary(fresh);
    await expect(aside.getByRole("button", { name: "Zmień klawiaturę: Bazalt 75" })).toBeVisible();
    await expect(aside.getByRole("button", { name: "Zmień myszkę: Pustułka" })).toBeVisible();
    await expect(aside.getByRole("button", { name: "Zmień podkładkę: Tafla" })).toBeVisible();
    await expect(aside.getByText("Grafit · M", { exact: true })).toBeVisible();
    await expect(aside.getByRole("region", { name: "Dopasowanie" }).getByRole("status")).toHaveText(
      "Pasuje z 1 uwagą",
    );
    await fresh
      .getByRole("navigation", { name: "Kroki kreatora" })
      .getByRole("link", { name: /^0 Do czego\?/ })
      .click();
    await expect(fresh.getByRole("radio", { name: /^Gry FPS, niski sens/ })).toBeChecked();
  });
});
