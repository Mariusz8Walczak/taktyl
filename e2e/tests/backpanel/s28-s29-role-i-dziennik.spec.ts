// TAKTYL-54, S28 i S29 (docs/12 par. 7, B-S5, B-010, B-012, B-070): rola viewer nie zapisuje niczego (interfejs nieaktywny,
// API 403 na bezposrednie wywolanie, brak wpisu w audit_log), a kazda mutacja zostawia wpis w dzienniku: kto, rola, encja,
// pola przed -> po, czas w Europe/Warsaw; wpisu nie da sie zmienic ani usunac przez API.
// Viewer to konto utworzone przez owner w setupie (DEMO_MODE=false na stosie e2e, wiec przycisku "Wejdz jako viewer" nie
// ma; zob. drugi test i docs/decyzje.md).
import { expect, test } from "../../helpers/fixtures";
import {
  ADMIN_URL,
  AdminApi,
  authFile,
  createOrder,
  getSettings,
  getVariant,
  payOrder,
  setStock,
} from "../../helpers/admin";

test.describe("S28: rola viewer", () => {
  test.use({ storageState: authFile("viewer") });

  test("S28: UI ma kontrolki nieaktywne z objasnieniem, API odpowiada 403, w audit_log brak wpisow viewera", async ({
    page,
  }) => {
    test.setTimeout(150_000); // limit 429 na POST /v1/orders: czekanie na Retry-After (retryOn429)
    const viewer = await AdminApi.as("viewer");
    const owner = await AdminApi.as("owner");
    const me = await viewer.json<{ user: { id: string; role: string } }>(
      await viewer.get("/v1/admin/auth/me"),
    );
    expect(me.user.role).toBe("viewer");

    // zamowienie do proby zmiany statusu (oplacone przez symulacje)
    const created = await createOrder("M-CZP-GRF", crypto.randomUUID());
    expect(created.status).toBe(201);
    const number = created.body.number as string;
    await payOrder(number, created.body.order_token as string);

    // --- interfejs: wariant
    await page.goto(`${ADMIN_URL}/produkty/m-kos?zakladka=warianty`);
    await page.getByRole("button", { name: "Zobacz wariant M-KOS-GRF" }).click();
    const dialog = page.getByRole("dialog", { name: "Wariant M-KOS-GRF" });
    await expect(dialog.getByRole("textbox", { name: "Nowa cena (zł)" })).toBeDisabled();
    await expect(dialog.getByRole("textbox", { name: "Stan (szt.)" })).toBeDisabled();
    const save = dialog.getByRole("button", { name: "Zapisz wariant" });
    await expect(save).toBeDisabled();
    await expect(save).not.toHaveAccessibleDescription("");
    await page.keyboard.press("Escape");

    // --- interfejs: ustawienia
    await page.goto(`${ADMIN_URL}/ustawienia`);
    await expect(page.locator("#powod-ustawienia")).toHaveText(
      "Tylko właściciel zmienia ustawienia sklepu.",
    );
    await expect(page.getByRole("textbox", { name: "Próg darmowej dostawy (zł)" })).toBeDisabled();
    await expect(page.getByRole("button", { name: "Zapisz" }).first()).toBeDisabled();

    // --- interfejs: status zamowienia
    await page.goto(`${ADMIN_URL}/zamowienia/${number}`);
    await expect(page.getByRole("heading", { level: 1 })).toContainText(number);
    // viewer nie dostaje zadnych przejsc (API: pusta lista), panel pokazuje powod zamiast przyciskow akcji
    await expect(
      page.getByRole("button", { name: /Rozpocznij realizację|Oznacz jako|Anuluj zamówienie/ }),
    ).toHaveCount(0);
    await expect(page.locator('section[aria-labelledby="akcje"]')).toContainText(
      "Konto viewer jest tylko do odczytu. Nic nie zmienisz.",
    );
    const detail = await viewer.json<{ allowed_transitions: string[] }>(
      await viewer.get(`/v1/admin/orders/${number}`),
    );
    expect(detail.allowed_transitions).toEqual([]);

    // --- API: bezposrednie wywolania z poprawnym CSRF (blokuje rola, nie token)
    const before = await getVariant(owner, "m-kos", "M-KOS-GRF");
    const settings = await getSettings(owner);
    const attempts = [
      await viewer.put("/v1/admin/variants/M-KOS-GRF/price", { price_gr: 30_000 }),
      await viewer.put("/v1/admin/variants/M-KOS-GRF/stock", { stock: 1, reason: "S28 e2e" }),
      await viewer.patch(
        "/v1/admin/settings",
        { free_shipping_threshold_gr: 10_000 },
        { "if-match": `"${settings.version}"` },
      ),
      await viewer.post(`/v1/admin/orders/${number}/transition`, { to: "processing" }),
    ];
    for (const res of attempts) {
      expect(res.status(), res.url()).toBe(403);
      expect(((await res.json()) as { code: string }).code).toBe("forbidden");
    }
    // dane bez zmian
    const after = await getVariant(owner, "m-kos", "M-KOS-GRF");
    expect(after.price_gr).toBe(before.price_gr);
    expect(after.stock).toBe(before.stock);
    expect((await getSettings(owner)).settings.free_shipping_threshold_gr).toBe(
      settings.settings.free_shipping_threshold_gr,
    );
    const order = await owner.json<{ status: string }>(
      await owner.get(`/v1/admin/orders/${number}`),
    );
    expect(order.status).toBe("paid");

    // audit_log: konto viewer nie ma zadnego wpisu o zmianie danych
    const audit = await owner.json<{ items: { action: string }[] }>(
      await owner.get(`/v1/admin/audit?actor_id=${me.user.id}&per_page=100`),
    );
    expect(audit.items.filter((e) => !e.action.startsWith("auth."))).toEqual([]);

    // sklep nadal bez pol hasla
    for (const path of ["/", "/koszyk", "/zamowienie"]) {
      await page.goto(path);
      await expect(page.locator('input[type="password"]')).toHaveCount(0);
    }
    await viewer.dispose();
    await owner.dispose();
  });
});

test.describe("S28/S32: tryb demo wylaczony na stosie e2e", () => {
  test.use({ storageState: authFile("owner") });

  test("bez DEMO_MODE nie ma przycisku viewer, resetu demo w panelu ani dzialajacego endpointu demo", async ({
    page,
    browser,
  }) => {
    const anon = await browser.newContext({ storageState: { cookies: [], origins: [] } });
    const login = await anon.newPage();
    await login.goto(`${ADMIN_URL}/logowanie`);
    await expect(login.getByRole("heading", { name: "Zaloguj się do backpanelu" })).toBeVisible();
    await expect(login.getByRole("button", { name: "Wejdź jako viewer" })).toHaveCount(0);
    await anon.close();

    await page.goto(`${ADMIN_URL}/ustawienia`);
    await expect(page.getByRole("heading", { name: "Ustawienia", level: 1 })).toBeVisible();
    await expect(page.getByRole("button", { name: /reset/i })).toHaveCount(0);

    const owner = await AdminApi.as("owner");
    const reset = await owner.post("/v1/admin/demo/reset", { confirm: "reset" });
    expect([403, 404]).toContain(reset.status());
    await owner.dispose();
  });
});

test.describe("S29: dziennik zmian", () => {
  test.use({ storageState: authFile("owner") });

  test("S29: cena, stan i status zamowienia zostawiaja wpisy (kto, rola, encja, przed -> po), widoczne w /dziennik; API nie pozwala ich zmienic", async ({
    page,
  }) => {
    test.setTimeout(150_000); // limit 429 na POST /v1/orders: czekanie na Retry-After (retryOn429)
    const owner = await AdminApi.as("owner");
    const SKU = "P-KRK-XL-NAT";
    const variant = await getVariant(owner, "p-korek", SKU);
    expect(variant.price_gr).toBe(11_900);

    // 1) cena 119,00 -> 129,00 zl (podwyzka, nie rusza Omnibus), 2) stan -1, 3) zamowienie paid -> processing
    const priceRes = await owner.put(`/v1/admin/variants/${SKU}/price`, {
      price_gr: 12_900,
      reason: "S29 e2e",
    });
    expect(priceRes.status()).toBe(200);
    await setStock(owner, SKU, variant.stock - 1, "S29 e2e: korekta");

    const created = await createOrder("M-CZP-GRF", crypto.randomUUID());
    expect(created.status).toBe(201);
    const number = created.body.number as string;
    await payOrder(number, created.body.order_token as string);
    const transition = await owner.post(`/v1/admin/orders/${number}/transition`, {
      to: "processing",
      note: "S29 e2e",
    });
    expect(transition.status()).toBe(200);

    // dziennik w interfejsie: wpis ceny z rozbiciem przed -> po
    await page.goto(`${ADMIN_URL}/dziennik?entity=variant`);
    await expect(page.getByRole("heading", { name: "Dziennik zmian", level: 1 })).toBeVisible();
    const priceRow = page
      .getByRole("row")
      .filter({ hasText: "Zmiana ceny wariantu" })
      .filter({ hasText: SKU })
      .first();
    await expect(priceRow).toContainText("właściciel");
    await expect(priceRow).toContainText(/\d{2}:\d{2}/);
    await priceRow.getByRole("button", { name: /^Szczegóły wpisu/ }).click();
    const details = page.getByRole("dialog", { name: /Zmiana ceny wariantu/ });
    await expect(details).toContainText("właściciel");
    await expect(details).toContainText(SKU);
    const diff = details.getByRole("table", { name: /Zmienione pola wpisu/ });
    await expect(diff).toContainText("Przed");
    await expect(diff).toContainText("Po");
    const priceDiff = diff.getByRole("row").filter({ hasText: /price/ });
    await expect(priceDiff).toContainText("11 900");
    await expect(priceDiff).toContainText("12 900");
    await page.keyboard.press("Escape");

    // pozostale wpisy przez API: stan i status zamowienia
    const audit = await owner.json<{
      items: {
        id: string;
        at: string;
        action: string;
        actor_role: string;
        actor_id: string | null;
        entity: string;
        entity_id: string;
        before: unknown;
        after: unknown;
      }[];
    }>(await owner.get(`/v1/admin/audit?per_page=100`));
    const find = (action: string, entityId: string) =>
      audit.items.find((e) => e.action === action && e.entity_id === entityId);
    const stock = find("variant.stock.set", SKU);
    expect(stock, "wpis zmiany stanu").toBeTruthy();
    expect(JSON.stringify(stock?.before)).toContain(String(variant.stock));
    expect(JSON.stringify(stock?.after)).toContain(String(variant.stock - 1));
    const status = find("order.transition", number);
    expect(status, "wpis zmiany statusu").toBeTruthy();
    expect(JSON.stringify(status?.before)).toContain("paid");
    expect(JSON.stringify(status?.after)).toContain("processing");
    for (const e of [stock, status]) {
      expect(e?.actor_role).toBe("owner");
      expect(e?.actor_id).toBeTruthy();
      expect(e?.at).toMatch(/[+-]\d{2}:\d{2}$|Z$/);
    }

    // dziennik jest tylko do odczytu: zadne zmieniajace wywolanie nie dziala (404/405), wpis zostaje
    const id = stock?.id ?? "0";
    for (const res of [
      await owner.patch(`/v1/admin/audit/${id}`, { action: "x.y" }),
      await owner.put(`/v1/admin/audit/${id}`, { action: "x.y" }),
      await owner.post("/v1/admin/audit", { action: "x.y" }),
      await owner.delete(`/v1/admin/audit/${id}`),
    ]) {
      expect([404, 405], res.url()).toContain(res.status());
    }
    const again = await owner.json<{ items: { id: string }[] }>(
      await owner.get(`/v1/admin/audit?entity=variant&entity_id=${SKU}&per_page=50`),
    );
    expect(again.items.some((e) => e.id === id)).toBe(true);
    await owner.dispose();
  });
});
