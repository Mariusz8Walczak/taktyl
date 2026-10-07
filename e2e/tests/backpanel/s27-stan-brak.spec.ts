// TAKTYL-54, S27 (docs/12 par. 7, B-S3, ADR-0003): stan M-JRZ-MGL z 2 na 0 w backpanelu -> w <= 5 s karta /myszki/jerzyk
// pokazuje kolor Mgla jako niedostepny ("Brak"), koszyk z ta pozycja blokuje przejscie do zamowienia, a API odrzuca wycene
// i zamowienie z tym SKU z lista problematycznych pozycji. Stan wraca do 2 szt. (PUT stock nie dotyka historii cen).
//
// Odstepstwo od brzmienia docs/12 S27 ("Brak w tym kolorze" + nieaktywny "Dodaj do koszyka"): przy stanie 0 jedynego wariantu
// koloru kafel Mgla jest nieaktywny z dopiskiem "Brak" (variant-picker.tsx, S7 dotyczy kombinacji kolor x przelacznik), wiec
// stanu "wybrana Mgla" nie da sie osiagnac. Test sprawdza aktualne zachowanie; pytanie Q-08 w docs/decyzje.md.
import { expect, test } from "../../helpers/fixtures";
import {
  ADMIN_URL,
  AdminApi,
  apiContext,
  authFile,
  createOrder,
  setStock,
} from "../../helpers/admin";
import { pick } from "../../helpers/ui";

test.use({ storageState: authFile("editor") });

const SKU = "M-JRZ-MGL";

test("S27: editor ustawia stan Jerzyka Mgla na 0; karta w <= 5 s pokazuje Brak, koszyk blokuje zamowienie, API odrzuca SKU", async ({
  page,
}) => {
  test.setTimeout(150_000); // limit 429 na POST /v1/orders: czekanie na Retry-After (retryOn429)
  const owner = await AdminApi.as("owner");
  const shop = await page.context().newPage();
  const card = await page.context().newPage();
  try {
    // klient ma Jerzyka w kolorze Mgla w koszyku (stan 2)
    await shop.goto("/myszki/jerzyk");
    await pick(shop, "radio", "Mgła");
    await shop.getByRole("button", { name: "Dodaj do koszyka" }).click();
    await expect(shop.getByRole("dialog", { name: "Koszyk" })).toBeVisible();

    // panel: stan 2 -> 0
    await page.goto(`${ADMIN_URL}/produkty/m-jerzyk?zakladka=warianty`);
    await page.getByRole("button", { name: `Edytuj wariant ${SKU}` }).click();
    const dialog = page.getByRole("dialog", { name: `Wariant ${SKU}` });
    await expect(dialog.getByRole("textbox", { name: "Stan (szt.)" })).toHaveValue("2");
    await dialog.getByRole("textbox", { name: "Stan (szt.)" }).fill("0");
    // powod korekty jest wymagany (B-107): bez niego formularz podaje blad przy polu
    await dialog.getByRole("button", { name: "Zapisz wariant" }).click();
    const reason = dialog.getByRole("textbox", { name: "Powód korekty" });
    await expect(reason).toHaveAttribute("aria-invalid", "true");
    await reason.fill("S27 e2e");

    const startedAt = Date.now();
    await dialog.getByRole("button", { name: "Zapisz wariant" }).click();
    await expect(dialog.getByText(/^Zapisano\./)).toBeVisible();

    // karta produktu: kolor Mgla niedostepny z dopiskiem "Brak" w <= 5 s od zapisu
    await expect(async () => {
      await card.goto("/myszki/jerzyk");
      await expect(card.getByRole("radio", { name: /^Mgła\s*Brak$/ })).toBeDisabled({
        timeout: 1_000,
      });
    }).toPass({ timeout: 6_000, intervals: [100, 250, 250] });
    const elapsed = Date.now() - startedAt;
    test.info().annotations.push({ type: "propagacja", description: `${elapsed} ms` });
    expect(elapsed, "budzet propagacji ADR-0003: 5 s od zapisu").toBeLessThanOrEqual(5_500);

    // koszyk klienta: pozycja bez stanu blokuje przejscie do zamowienia
    await shop.goto("/koszyk");
    const line = shop.getByRole("article", { name: "Jerzyk" });
    await expect(line.getByRole("alert")).toContainText("Brak w tym wariancie.");
    await expect(shop.getByRole("button", { name: "Przejdź do zamówienia" })).toBeDisabled();

    // API: wycena zglasza problem, zamowienie jest odrzucone z lista pozycji (409 out_of_stock, items[n].sku)
    const api = await apiContext();
    const quote = await api.post("/v1/cart/quote", {
      data: { items: [{ type: "item", sku: SKU, qty: 1 }] },
    });
    expect(quote.status()).toBe(200);
    const quoted = (await quote.json()) as { problems: { sku: string; code: string }[] };
    expect(quoted.problems).toEqual([expect.objectContaining({ sku: SKU, code: "out_of_stock" })]);
    await api.dispose();

    const order = await createOrder(SKU, crypto.randomUUID(), 44_900);
    expect(order.status).toBe(409);
    expect(order.body.code).toBe("out_of_stock");
    expect(JSON.stringify(order.body.errors)).toContain("items[0].sku");

    // pulpit: wariant na liscie niskich stanow (B-S3)
    await page.goto(`${ADMIN_URL}/`);
    await expect(page.getByRole("heading", { name: "Niski stan", level: 2 })).toBeVisible();
    await expect(page.getByRole("main")).toContainText(SKU);
  } finally {
    await setStock(owner, SKU, 2, "S27 e2e: przywrocenie stanu");
    await owner.dispose();
  }
});
