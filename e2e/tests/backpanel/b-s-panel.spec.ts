// TAKTYL-54: scenariusze akceptacji backpanelu B-S1, B-S4, B-S7, B-S8 (docs/15 par. 14) oraz dostepnosc ekranow panelu (S36, axe).
// B-S2 = S25, B-S3 = S27, B-S5 = S28, B-S6 = S26 (osobne pliki). Kazdy test, ktory zmienia dane wspolne, przywraca je w finally.
import { expect, test } from "../../helpers/fixtures";
import { axeBlockingViolations } from "../../helpers/a11y";
import {
  ADMIN_URL,
  AdminApi,
  authFile,
  getSettings,
  openPanel,
  patchSettings,
} from "../../helpers/admin";
import { norm } from "../../helpers/ui";
import { SITE_URL } from "../../playwright.config";

test.use({ storageState: authFile("owner") });

test("B-S1: owner szuka „lupek” w /produkty: „1 produkt”, Łupek 65", async ({ page }) => {
  await openPanel(page, "/produkty");
  await page.getByLabel("Szukaj po nazwie lub SKU").fill("lupek");
  await expect(page.getByText("1 produkt", { exact: true })).toBeVisible();
  const rows = page.getByRole("row").filter({ hasText: "Łupek 65" });
  await expect(rows).toHaveCount(1);
});

test("B-S4: zmiana progu darmowej dostawy w ustawieniach zmienia komunikat w koszyku sklepu; prog wraca do 299,00 zl", async ({
  page,
  browser,
}) => {
  const owner = await AdminApi.as("owner");
  const original = await getSettings(owner);
  expect(original.settings.free_shipping_threshold_gr).toBe(29_900);
  const shop = await browser.newContext({
    baseURL: SITE_URL,
    locale: "pl-PL",
    timezoneId: "Europe/Warsaw",
  });
  const cart = await shop.newPage();
  const remaining = async (): Promise<number> => {
    await cart.goto("/koszyk");
    const status = cart
      .getByRole("status")
      .filter({ hasText: /Brakuje[\s\d,]+zł do darmowej dostawy/ });
    await expect(status.first()).toBeVisible();
    const text = norm((await status.first().textContent()) ?? "");
    const m = /Brakuje ([\d\s]+),(\d{2}) zł/.exec(text);
    if (!m) throw new Error(`Nieczytelny komunikat: ${text}`);
    return Number(m[1]!.replace(/\s/g, "")) * 100 + Number(m[2]);
  };
  try {
    await cart.goto("/myszki/czapla");
    await cart.getByRole("button", { name: "Dodaj do koszyka" }).click();
    await expect(cart.getByRole("dialog", { name: "Koszyk" })).toBeVisible();
    const before = await remaining();
    expect(before).toBe(29_900 - 24_900);

    await openPanel(page, "/ustawienia");
    await page.getByRole("textbox", { name: "Próg darmowej dostawy (zł)" }).fill("260,00");
    await page.getByRole("button", { name: "Zapisz" }).first().click();
    await expect(page.getByText(/^Zapisano\./)).toBeVisible();

    await expect(async () => {
      expect(await remaining()).toBe(26_000 - 24_900);
    }).toPass({ timeout: 8_000, intervals: [250, 500, 500] });

    // wpis w dzienniku: ustawienia, prog przed -> po
    const audit = await owner.json<{
      items: { action: string; before: unknown; after: unknown }[];
    }>(await owner.get("/v1/admin/audit?entity=settings&per_page=10"));
    const entry = audit.items.find((e) => e.action === "settings.update");
    expect(JSON.stringify(entry?.before)).toContain("29900");
    expect(JSON.stringify(entry?.after)).toContain("26000");
  } finally {
    const current = await getSettings(owner);
    await patchSettings(owner, current.version, { free_shipping_threshold_gr: 29_900 });
    await owner.dispose();
    await shop.close();
  }
});

test.describe("B-S7: media", () => {
  const KEY = "k-kwarc-60_grafit_top";

  /** Nagłówek WebP (RIFF/VP8X, 30 B) o zadanych wymiarach: fixture testowy dla kontroli wymiarów, nie grafika. */
  function webpHeader(width: number, height: number, alpha = true): Buffer {
    const b = Buffer.alloc(30);
    b.write("RIFF", 0, "ascii");
    b.writeUInt32LE(22, 4);
    b.write("WEBP", 8, "ascii");
    b.write("VP8X", 12, "ascii");
    b.writeUInt32LE(10, 16);
    b[20] = alpha ? 0x10 : 0;
    b.writeUIntLE(width - 1, 24, 3);
    b.writeUIntLE(height - 1, 27, 3);
    return b;
  }

  test("B-S7: plik o zlych wymiarach jest odrzucony z komunikatem o wymiarach, zly typ pliku z „Wgraj plik WebP.”", async ({
    page,
  }) => {
    await openPanel(page, `/media?product_id=k-kwarc-60&kind=topdown`);
    await page.getByRole("button", { name: `Wgraj plik: ${KEY}` }).click();
    const dialog = page.getByRole("dialog", { name: `Wgraj pliki: ${KEY}` });

    // zle wymiary: 330 x 102 zamiast 293 x 102
    await dialog.getByLabel(/^Plik 1x:/).setInputFiles({
      name: "zle-wymiary.webp",
      mimeType: "image/webp",
      buffer: webpHeader(330, 102),
    });
    await dialog.getByRole("button", { name: "Wgraj", exact: true }).click();
    const error = dialog.getByRole("alert").or(dialog.getByText("Nie wgrano plików"));
    await expect(error.first()).toBeVisible();
    await expect(dialog).toContainText(
      "Plik ma 330 × 102 px. Ten wpis wymaga 293 × 102 px (1 px = 1 mm).",
    );

    // zly typ: tekst udajacy obraz
    await dialog.getByLabel(/^Plik 1x:/).setInputFiles({
      name: "to-nie-obraz.webp",
      mimeType: "image/webp",
      buffer: Buffer.from("to nie jest plik WebP, tylko tekst do kontroli typu".repeat(2)),
    });
    await dialog.getByRole("button", { name: "Wgraj", exact: true }).click();
    await expect(dialog).toContainText("Wgraj plik WebP.");
  });

  test("B-S7: plik o poprawnych wymiarach (293 x 102 i 586 x 204) ustawia status gotowe, usuniecie przywraca brak", async () => {
    const owner = await AdminApi.as("owner");
    try {
      const form = {
        "1x": { name: "a.webp", mimeType: "image/webp", buffer: webpHeader(293, 102) },
        "2x": { name: "b.webp", mimeType: "image/webp", buffer: webpHeader(586, 204) },
      };
      const up = await owner.ctx.post(`/v1/admin/media/${KEY}`, {
        multipart: form,
        headers: { "x-csrf-token": await csrf(owner) },
      });
      expect([200, 201], await up.text()).toContain(up.status());
      const list = await owner.json<{ items: { key: string; status: string }[] }>(
        await owner.get(`/v1/admin/media?product_id=k-kwarc-60&kind=topdown`),
      );
      expect(list.items.find((e) => e.key === KEY)?.status).toBe("gotowe");
    } finally {
      const del = await owner.delete(`/v1/admin/media/${KEY}`);
      expect([200, 204]).toContain(del.status());
      const list = await owner.json<{ items: { key: string; status: string }[] }>(
        await owner.get(`/v1/admin/media?product_id=k-kwarc-60&kind=topdown`),
      );
      expect(list.items.find((e) => e.key === KEY)?.status).toBe("brak");
      await owner.dispose();
    }
  });
});

async function csrf(api: AdminApi): Promise<string> {
  const me = await api.json<{ csrf_token: string }>(await api.get("/v1/admin/auth/me"));
  return me.csrf_token;
}

test("B-S8 (Q-07): opis z zakazanym slowem „idealny” jest ZAPISANY z ostrzezeniem i lista slow (aktualne zachowanie API-013), nie zablokowany", async ({
  page,
}) => {
  const owner = await AdminApi.as("owner");
  const ID = "k-lupek-65";
  const detail = await owner.json<{ description: string | null; version: number }>(
    await owner.get(`/v1/admin/products/${ID}`),
  );
  const original = detail.description ?? "";
  try {
    await openPanel(page, `/tresci/opisy/${ID}`);
    const field = page.getByRole("textbox", { name: "Opis produktu" });
    await expect(field).toBeVisible();
    await field.fill(`${original}\n\nTo jest idealny wybór.`);
    // podglad na zywo podswietla slowo tekstem, nie tylko kolorem
    await expect(page.getByRole("region", { name: "Podgląd opisu" })).toContainText(
      "Zakazane słowo: idealny",
    );
    await page.getByRole("button", { name: "Zapisz opis" }).click();
    await expect(page.getByText(/Zakazane słowa: idealny/).first()).toBeVisible();
    await expect(page.getByText("Ostrzeżenia z zapisu (nie blokują zapisu)")).toBeVisible();

    // aktualne zachowanie: zapis przeszedl (Q-07 w docs/decyzje.md czeka na decyzje, czy dodac blokade zatwierdzenia)
    const saved = await owner.json<{ description: string | null }>(
      await owner.get(`/v1/admin/products/${ID}`),
    );
    expect(saved.description).toContain("idealny");
  } finally {
    const fresh = await owner.json<{ version: number }>(
      await owner.get(`/v1/admin/products/${ID}`),
    );
    const res = await owner.put(
      `/v1/admin/products/${ID}/description`,
      { description: original === "" ? null : original },
      { "if-match": `"${fresh.version}"` },
    );
    expect(res.status(), "przywrocenie opisu").toBe(200);
    await owner.dispose();
  }
});

test.describe("S36 (axe): ekrany backpanelu P0", () => {
  for (const [name, path] of [
    ["pulpit", "/"],
    ["produkty", "/produkty"],
    ["edycja produktu", "/produkty/m-wrobel?zakladka=warianty"],
    ["zamowienia", "/zamowienia"],
    ["ustawienia", "/ustawienia"],
    ["dziennik", "/dziennik"],
    ["zdjecia", "/media"],
  ] as const) {
    test(`S36: ${name}: 0 bledow krytycznych i powaznych axe`, async ({ page }) => {
      await openPanel(page, path);
      await page.waitForLoadState("networkidle");
      await expect(page).toHaveTitle(/\S/);
      expect(await axeBlockingViolations(page)).toEqual([]);
    });
  }

  test("S36: logowanie: 0 bledow krytycznych i powaznych axe", async ({ browser }) => {
    const ctx = await browser.newContext({ storageState: { cookies: [], origins: [] } });
    const page = await ctx.newPage();
    await page.goto(`${ADMIN_URL}/logowanie`);
    await expect(page.getByRole("heading", { name: "Zaloguj się do backpanelu" })).toBeVisible();
    await expect(page).toHaveTitle(/\S/);
    expect(await axeBlockingViolations(page)).toEqual([]);
    await ctx.close();
  });
});

test("B-105: okno wariantu pokazuje w „Historia cen (ostatnie wpisy)” NAJNOWSZE zmiany ceny", async ({
  page,
}) => {
  const owner = await AdminApi.as("owner");
  const SKU = "P-LEN-M-GRF";
  for (let zl = 60; zl <= 66; zl++) {
    const res = await owner.put(`/v1/admin/variants/${SKU}/price`, {
      price_gr: zl * 100,
      reason: "B-105 e2e",
    });
    expect(res.status()).toBe(200);
  }
  await owner.dispose();
  await page.goto(`${ADMIN_URL}/produkty/p-len?zakladka=warianty`);
  await page.getByRole("button", { name: `Edytuj wariant ${SKU}` }).click();
  const dialog = page.getByRole("dialog", { name: `Wariant ${SKU}` });
  const rows = dialog
    .getByRole("region", { name: "Historia cen (ostatnie wpisy)" })
    .getByRole("row");
  await expect(rows.nth(1)).toContainText("66,00 zł");
});
