// TAKTYL-54, S26 (docs/12 par. 7, B-S6, B-200..B-202, B-208): zamowienie zlozone w sklepie jest widoczne w backpanelu:
// lista (numer TK-RRMMDD-XXXX, status po symulacji platnosci, zamaskowany e-mail), szczegoly (pozycje i kwoty co do grosza
// zgodne z tym, co zaplacil klient), owner widzi dane w calosci, viewer zamaskowane (maskowanie robi API).
import { expect, test } from "../../helpers/fixtures";
import { ADMIN_URL, authFile, createOrder, payOrder } from "../../helpers/admin";
import { CONTACT, norm } from "../../helpers/ui";

test.use({ storageState: authFile("owner") });

test("S26: zamowienie ze sklepu (Jerzyk, odbior osobisty, BLIK) na liscie i w szczegolach panelu; kwoty co do grosza; viewer widzi dane zamaskowane", async ({
  page,
  browser,
}) => {
  // --- sklep: to samo zamowienie, ktore sklep wysyla z kasy (POST /v1/orders z SKU, kwota z wyceny serwera) i udana
  // platnosc. Sciezke interfejsu kasy pokrywaja S17-S20; tu przez API (z ponowieniem po 429: limit 10/min/IP dzielony
  // z rownolegle dzialajacymi testami), zeby test panelu nie zalezal od obciazenia limitu zamowien (TAKTYL-68).
  const created = await createOrder("M-JRZ-GRF", crypto.randomUUID());
  expect(created.status, JSON.stringify(created.body)).toBe(201);
  const number = created.body.number as string;
  expect(number).toMatch(/^TK-\d{6}-[A-Z0-9]{4}$/);
  await payOrder(number, created.body.order_token as string);
  expect(JSON.stringify(created.body)).toMatch(/44900/); // kwota z odpowiedzi API: 449,00 zl w groszach
  const paid = "449,00 zł";

  // --- panel (owner): lista otwarta od razu z filtrem po numerze w adresie (bez wpisywania w pole przed hydracja
  // i bez czekania na debounce); wiersz moze pojawic sie z opoznieniem, wiec ponawiamy z odswiezeniem.
  const row = page.getByRole("row").filter({ hasText: number });
  await expect(async () => {
    await page.goto(`${ADMIN_URL}/zamowienia?number=${number}`);
    await expect(page.getByRole("textbox", { name: "Numer zamówienia" })).toHaveValue(number);
    await expect(row).toHaveCount(1, { timeout: 4000 });
  }).toPass({ timeout: 30_000 });
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
