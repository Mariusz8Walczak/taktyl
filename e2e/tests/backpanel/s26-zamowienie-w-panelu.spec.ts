// TAKTYL-54, S26 (docs/12 par. 7, B-S6, B-200..B-202, B-208): zamowienie zlozone w sklepie jest widoczne w backpanelu:
// lista (numer TK-RRMMDD-XXXX, status po symulacji platnosci, zamaskowany e-mail), szczegoly (pozycje i kwoty co do grosza
// zgodne z tym, co zaplacil klient), owner widzi dane w calosci, viewer zamaskowane (maskowanie robi API).
import { expect, test } from "../../helpers/fixtures";
import { ADMIN_URL, authFile } from "../../helpers/admin";
import { addProductToCart, CONTACT, norm, placeOrder } from "../../helpers/ui";

test.use({ storageState: authFile("owner") });

test("S26: zamowienie ze sklepu (Jerzyk, odbior osobisty, BLIK) na liscie i w szczegolach panelu; kwoty co do grosza; viewer widzi dane zamaskowane", async ({
  page,
  browser,
}) => {
  // --- sklep: pelna sciezka klienta az do udanej platnosci
  await addProductToCart(page, "/myszki/jerzyk");
  await page
    .getByRole("dialog", { name: "Koszyk" })
    .getByRole("link", { name: "Przejdź do zamówienia" })
    .click();
  await expect(page).toHaveURL(/\/zamowienie$/);
  const number = await placeOrder(page);
  const paid = norm((await page.getByTestId("platnosc-kwota").textContent()) ?? "");
  expect(paid).toMatch(/^449,00 zł$/);
  await page.getByRole("button", { name: "Symuluj udaną płatność" }).click();
  await expect(page).toHaveURL(/\/zamowienie\/potwierdzenie\?id=/);

  // --- panel (owner): lista z filtrem po numerze
  await page.goto(`${ADMIN_URL}/zamowienia`);
  await page.getByRole("textbox", { name: "Numer zamówienia" }).fill(number);
  const row = page.getByRole("row").filter({ hasText: number });
  await expect(row).toHaveCount(1);
  await expect(row).toContainText("Opłacone");
  await expect(row).toContainText("449,00 zł");
  // lista zawsze pokazuje e-mail zamaskowany (pelne dane dopiero w szczegolach)
  await expect(row).toContainText("j***@taktyl.example");
  await expect(row).not.toContainText(CONTACT.email);

  // --- szczegoly
  await row.getByRole("link", { name: number }).click();
  await expect(page).toHaveURL(`${ADMIN_URL}/zamowienia/${number}`);
  await expect(page.getByRole("heading", { level: 1 })).toContainText(number);
  const items = page.getByRole("table", { name: `Pozycje zamówienia ${number}` });
  await expect(items.getByRole("row").filter({ hasText: "M-JRZ-GRF" })).toContainText("449,00 zł");
  const amounts = page.locator('dl[aria-label="Kwoty"]');
  await expect(amounts).toContainText("Razem");
  expect(norm((await amounts.locator("dd").last().textContent()) ?? "")).toBe(paid);
  await expect(page.getByRole("heading", { name: "Status", level: 2, exact: true })).toBeVisible();
  await expect(
    page
      .getByRole("complementary", { name: "Status i szczegóły" })
      .getByText("Opłacone", { exact: true }),
  ).toBeVisible();
  await expect(page.getByText(CONTACT.email, { exact: true })).toBeVisible();

  // --- viewer: to samo zamowienie, dane osobowe zamaskowane przez API
  const viewer = await browser.newContext({ storageState: authFile("viewer") });
  const vp = await viewer.newPage();
  await vp.goto(`${ADMIN_URL}/zamowienia/${number}`);
  await expect(vp.getByRole("heading", { level: 1 })).toContainText(number);
  await expect(vp.getByText(CONTACT.email)).toHaveCount(0);
  await expect(vp.getByText("j***@taktyl.example")).toBeVisible();
  await expect(vp.getByText(CONTACT.phone)).toHaveCount(0);
  await expect(vp.getByText("+48 *** *** 000")).toBeVisible();
  await viewer.close();
});
