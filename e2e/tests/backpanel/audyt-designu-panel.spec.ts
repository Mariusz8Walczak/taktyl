// TAKTYL-66 (docs/12 par. 3, D-002): audyt systemu designu na ekranach backpanelu (te same limity co sklep).
import { test } from "../../helpers/fixtures";
import { assertDesignAudit, runDesignAudit } from "../../helpers/design-audit";
import { ADMIN_URL, authFile, openPanel } from "../../helpers/admin";

test.use({ storageState: authFile("owner") });

const SCREENS: [string, string][] = [
  ["pulpit", "/"],
  ["produkty", "/produkty"],
  ["nowy produkt", "/produkty/nowy"],
  ["zamowienia", "/zamowienia"],
  ["tresci", "/tresci"],
  ["opisy", "/tresci/opisy"],
  ["opinie", "/tresci/opinie"],
  ["poradnik", "/tresci/poradnik"],
  ["strony", "/tresci/strony"],
  ["faq", "/tresci/faq"],
  ["media", "/media"],
  ["zgloszenia", "/zgloszenia"],
  ["ustawienia", "/ustawienia"],
  ["dziennik", "/dziennik"],
];

for (const [name, path] of SCREENS) {
  test(`Audyt designu panelu: ${name} (${path})`, async ({ page }) => {
    await openPanel(page, path);
    await page.waitForLoadState("networkidle");
    const audit = await runDesignAudit(page);
    test.info().annotations.push({ type: "audyt", description: JSON.stringify(audit) });
    assertDesignAudit(audit);
  });
}

test("Audyt designu panelu: ekran logowania", async ({ browser }) => {
  const ctx = await browser.newContext({ storageState: { cookies: [], origins: [] } });
  const page = await ctx.newPage();
  await page.goto(`${ADMIN_URL}/logowanie`);
  const audit = await runDesignAudit(page);
  assertDesignAudit(audit);
  await ctx.close();
});
