// TAKTYL-54, S25 (docs/12 par. 7, B-S2, ADR-0003): zmiana ceny Wrobla w backpanelu (rola editor) jest widoczna w sklepie
// w <= 5 s, a "najnizsza z 30 dni" jest wyliczona z historii cen (pole tylko do odczytu), nie wpisana recznie.
// Test zmienia dane wspolne ze sklepem, wiec jest w projekcie `backpanel` (po S1-S24). Ceny nie da sie "cofnac" przez API
// bez dopisania wiersza do historii (129 po 119 to juz nie obnizka), dlatego stan wraca przy kolejnym db:reset-demo.
import { expect, test } from "@playwright/test";
import { ADMIN_URL, AdminApi, authFile, shopContext, waitForShop } from "../../helpers/admin";

test.use({ storageState: authFile("editor") });

const PRODUCT = "m-wrobel";
const SKU = "M-WRB-GRF";

test("S25: editor zmienia cene Wrobla 129,00 -> 119,00 zl; sklep w <= 5 s, przekreslone 139,00 zl z historii, plakietka -14%, wpis w audit_log", async ({
  page,
}) => {
  const shop = await shopContext();
  await page.goto(`${ADMIN_URL}/produkty/${PRODUCT}?zakladka=warianty`);
  await page.getByRole("button", { name: `Edytuj wariant ${SKU}` }).click();
  const dialog = page.getByRole("dialog", { name: `Wariant ${SKU}` });
  await expect(dialog).toBeVisible();

  // Najnizsza z 30 dni to tekst do odczytu (dd), nie pole formularza.
  await expect(dialog.getByTestId("lowest-30d")).toContainText("139,00 zł");
  await expect(dialog.getByRole("textbox", { name: /najniższa/i })).toHaveCount(0);
  await expect(dialog.getByLabel(/najniższa/i)).toHaveCount(0);

  await dialog.getByRole("textbox", { name: "Nowa cena (zł)" }).fill("119,00");
  await dialog.getByRole("textbox", { name: "Powód zmiany ceny (opcjonalnie)" }).fill("S25 e2e");
  // B-106: podglad skutku Omnibus jeszcze przed zapisem.
  const preview = dialog.getByRole("status").filter({ hasText: "Obniżka pokaże przekreśloną" });
  await expect(preview).toContainText("139,00 zł");
  await expect(preview).toContainText("−14%");

  const startedAt = Date.now();
  await dialog.getByRole("button", { name: "Zapisz wariant" }).click();
  await expect(dialog.getByText(/^Zapisano\./)).toBeVisible();

  // Propagacja ADR-0003: outbox -> webhook -> rewalidacja; HTML karty zawiera nowa cene bez recznego odswiezania serwera.
  const elapsedMs = await waitForShop(shop, "/myszki/wrobel", (html) =>
    /119,00[\s\u00a0]*zł/.test(html),
  );
  const sinceClick = Date.now() - startedAt;
  test.info().annotations.push({
    type: "propagacja",
    description: `${elapsedMs} ms (od kliknięcia ${sinceClick} ms)`,
  });
  expect(sinceClick, "budzet propagacji ADR-0003: 5 s od zapisu").toBeLessThanOrEqual(5_000);

  // W panelu: wyliczone, tylko do odczytu.
  await expect(dialog.getByTestId("lowest-30d")).toContainText("139,00 zł");
  await expect(dialog.getByTestId("lowest-30d")).toContainText("−14%");

  // B-S2: nowy wiersz w historii cen i blok "Cena przy obnizce" (wyliczone, tylko do odczytu).
  await page.goto(`${ADMIN_URL}/produkty/${PRODUCT}/ceny?sku=${SKU}`);
  const history = page.getByRole("table", { name: `Historia cen wariantu ${SKU}` });
  // kolejnosc wierszy nie jest okreslona w docs/15 B-105 (zob. TAKTYL-82), wiec szukamy wiersza po tresci
  const newest = history.getByRole("row").filter({ hasText: "119,00 zł" });
  await expect(newest).toHaveCount(1);
  await expect(newest).toContainText("editor-e2e@taktyl.example");
  const omnibus = page.getByRole("region", { name: "Cena przy obniżce" });
  await expect(omnibus).toContainText("139,00 zł");
  await expect(omnibus).toContainText("−14%");
  await expect(omnibus).toContainText("Najniższa cena z 30 dni przed obniżką: 139,00 zł");

  // Sklep w przegladarce.
  await page.goto("/myszki/wrobel");
  const main = page.getByRole("main");
  await expect(main.getByRole("heading", { name: "Wróbel", level: 1 })).toBeVisible();
  await expect(main.getByText("119,00 zł", { exact: true }).first()).toBeVisible();
  await expect(main.locator("del", { hasText: "139,00 zł" }).first()).toBeVisible();
  await expect(main.locator("del", { hasText: "149,00 zł" })).toHaveCount(0);
  await expect(main.getByRole("list", { name: "Oznaczenia" }).getByText("−14%")).toBeVisible();
  await expect(main.getByText("Najniższa cena z 30 dni przed obniżką: 139,00 zł")).toBeVisible();

  // audit_log: kto, co, przed -> po (S29 sprawdza to samo w interfejsie dziennika).
  const owner = await AdminApi.as("owner");
  const audit = await owner.get(`/v1/admin/audit?entity=variant&entity_id=${SKU}&per_page=50`);
  expect(audit.status()).toBe(200);
  const body = await owner.json<{
    items: { action: string; actor_role: string; before: unknown; after: unknown }[];
  }>(audit);
  const entry = body.items.find((e) => e.action === "variant.price.set");
  expect(entry, "wpis variant.price.set").toBeTruthy();
  expect(entry?.actor_role).toBe("editor");
  expect(JSON.stringify(entry?.before)).toContain("12900");
  expect(JSON.stringify(entry?.after)).toContain("11900");
  await owner.dispose();
});
