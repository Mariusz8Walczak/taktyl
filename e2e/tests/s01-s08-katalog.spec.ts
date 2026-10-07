// I-010 (TAKTYL-44): scenariusze S1-S8 z docs/12 par. 1 (listingi, filtry w adresie, karty produktow).
// Wartosci oczekiwane wynikaja z data/*.json (docs/12): jesli wychodzi inna, blad jest w kodzie, nie w tescie.
import { expect, test } from "../helpers/fixtures";
import { closeFilters, openFilters, pick, resultCount } from "../helpers/ui";

const productLink = (page: import("@playwright/test").Page, name: string) =>
  page
    .getByRole("main")
    .getByRole("heading", { level: 3 })
    .getByRole("link", { name, exact: true });

test.describe("Listing: filtry w adresie (S1-S4)", () => {
  test("S1: klawiatury, rozmiar 75% i Bluetooth dają 1 produkt, adres ?rozmiar=75&lacznosc=bt, odświeżenie zachowuje widok @mobile", async ({
    page,
  }) => {
    await page.goto("/klawiatury");
    await expect(resultCount(page)).toHaveText("6 produktów");

    const inDialog = await openFilters(page);
    await pick(page, "checkbox", /^75%/);
    await pick(page, "checkbox", /^Bluetooth/);
    if (inDialog) await closeFilters(page);

    await expect(resultCount(page)).toHaveText("1 produkt");
    await expect(productLink(page, "Bazalt 75")).toBeVisible();
    await expect(page).toHaveURL(/\/klawiatury\?rozmiar=75&lacznosc=bt$/);

    await page.reload();
    await expect(resultCount(page)).toHaveText("1 produkt");
    await expect(productLink(page, "Bazalt 75")).toBeVisible();
    if (inDialog) await openFilters(page);
    await expect(page.getByRole("checkbox", { name: /^75%/ })).toBeChecked();
    await expect(page.getByRole("checkbox", { name: /^Bluetooth/ })).toBeChecked();
  });

  test("S2: klawiatury w cenie 300-700 zł to 4 produkty (Łupek 65, Kreda 98, Granit TKL, Marmur 100)", async ({
    page,
  }) => {
    await page.goto("/klawiatury");
    const from = page.getByRole("spinbutton", { name: "Od (zł)" });
    const to = page.getByRole("spinbutton", { name: "Do (zł)" });
    // Oba pola pod rzad, bez czekania na adres miedzy nimi (TAKTYL-81: druga wartosc nie moze zginac).
    await from.fill("300");
    await to.fill("700");
    await to.blur();
    await expect(page).toHaveURL(/\?cena=300-700$/);
    await expect(to).toHaveValue("700");

    await expect(resultCount(page)).toHaveText("4 produkty");
    for (const name of ["Łupek 65", "Kreda 98", "Granit TKL", "Marmur 100"]) {
      await expect(productLink(page, name)).toBeVisible();
    }
    for (const name of ["Kwarc 60", "Bazalt 75"]) {
      await expect(productLink(page, name)).toHaveCount(0);
    }
  });

  test("S3: myszki dla dłoni 19,5 cm to 5 produktów, wszystkie poza Mewą", async ({ page }) => {
    await page.goto("/myszki");
    await expect(resultCount(page)).toHaveText("6 produktów");

    await page.getByRole("textbox", { name: "Twoja dłoń (cm)" }).fill("19,5");
    await page.getByRole("textbox", { name: "Twoja dłoń (cm)" }).blur();

    await expect(resultCount(page)).toHaveText("5 produktów");
    await expect(productLink(page, "Mewa")).toHaveCount(0);
    for (const name of ["Jerzyk", "Kos", "Pustułka", "Wróbel"]) {
      await expect(productLink(page, name)).toBeVisible();
    }
  });

  test("S4: podkładki na biurko to 5 produktów, bez Lodu", async ({ page }) => {
    await page.goto("/podkladki");
    await expect(resultCount(page)).toHaveText("6 produktów");

    await pick(page, "checkbox", /^Na biurko/);

    await expect(resultCount(page)).toHaveText("5 produktów");
    await expect(productLink(page, "Lód")).toHaveCount(0);
    for (const name of ["Len", "Tafla", "Szron", "Korek", "Filc"]) {
      await expect(productLink(page, name)).toBeVisible();
    }
  });
});

test.describe("Karta produktu (S5-S8)", () => {
  test("S5: Granit TKL kosztuje 599,00 zł, przekreślone 699,00 zł, plakietka −14% i najniższa cena z 30 dni", async ({
    page,
  }) => {
    await page.goto("/klawiatury/granit-tkl");
    const main = page.getByRole("main");
    await expect(main.getByRole("heading", { name: "Granit TKL", level: 1 })).toBeVisible();
    await expect(main.getByText("599,00 zł", { exact: true }).first()).toBeVisible();
    await expect(main.locator("del", { hasText: "699,00 zł" }).first()).toBeVisible();
    await expect(main.getByRole("list", { name: "Oznaczenia" }).getByText("−14%")).toBeVisible();
    await expect(main.getByText("Najniższa cena z 30 dni przed obniżką: 699,00 zł")).toBeVisible();
  });

  test("S6: Wróbel kosztuje 129,00 zł, przekreślone 139,00 zł (nie 149,00 zł), plakietka −7%", async ({
    page,
  }) => {
    await page.goto("/myszki/wrobel");
    const main = page.getByRole("main");
    await expect(main.getByRole("heading", { name: "Wróbel", level: 1 })).toBeVisible();
    await expect(main.getByText("129,00 zł", { exact: true }).first()).toBeVisible();
    await expect(main.locator("del", { hasText: "139,00 zł" }).first()).toBeVisible();
    await expect(main.locator("del", { hasText: "149,00 zł" })).toHaveCount(0);
    await expect(main.getByRole("list", { name: "Oznaczenia" }).getByText("−7%")).toBeVisible();
    await expect(main.getByText("Najniższa cena z 30 dni przed obniżką: 139,00 zł")).toBeVisible();
  });

  test("S7: Bazalt 75 w kolorze Kobalt z przełącznikiem Szept: „Brak w tym kolorze”, „Dodaj do koszyka” nieaktywny z wyjaśnieniem", async ({
    page,
  }) => {
    await page.goto("/klawiatury/bazalt-75");
    await expect(page.getByRole("button", { name: "Dodaj do koszyka" })).toBeEnabled();

    await pick(page, "radio", "Kobalt");
    await pick(page, "radio", /^Szept/);

    const main = page.getByRole("main");
    await expect(main.getByText("Brak w tym kolorze")).toBeVisible();
    const add = page.getByRole("button", { name: "Dodaj do koszyka" });
    await expect(add).toBeDisabled();
    // Wyjaśnienie powiązane z przyciskiem (aria-describedby), nie tylko widoczne obok.
    await expect(add).not.toHaveAccessibleDescription("");
  });

  test("S8: Jerzyk w kolorze Mgła: „Ostatnie sztuki (zostały 2 szt.)”, ilość maksymalnie 2", async ({
    page,
  }) => {
    await page.goto("/myszki/jerzyk");
    await pick(page, "radio", "Mgła");

    const main = page.getByRole("main");
    await expect(main.getByText("Ostatnie sztuki (zostały 2 szt.)")).toBeVisible();

    const qty = main.getByRole("group", { name: /^Ilość/ });
    const plus = qty.getByRole("button", { name: "Zwiększ ilość" });
    await expect(qty.getByRole("status")).toHaveText("1");
    await plus.click();
    await expect(qty.getByRole("status")).toHaveText("2");
    await expect(plus).toBeDisabled();
  });
});
