// I-010 (TAKTYL-44): scenariusze S17-S20 z docs/12 par. 1 (zamowienie, faktura, symulacja platnosci, potwierdzenie).
// Numery NIP sa generowane w tescie (regula 5); dane osobowe to wylacznie fikcyjne wartosci w domenie taktyl.example.
import type { Page } from "@playwright/test";
import { expect, test } from "../helpers/fixtures";
import { generateNip, breakNip } from "../helpers/nip";
import { liveDataLayer, mirrorDataLayer, names, trackedEvents } from "../helpers/tracking";
import {
  addProductToCart,
  CONTACT,
  cartCounter,
  pick,
  placeOrder,
  submitOrder,
} from "../helpers/ui";

/** Dodaje Wroblem do koszyka i przechodzi do zamowienia przez szuflade. */
async function startCheckout(page: Page) {
  await addProductToCart(page, "/myszki/wrobel");
  await page
    .getByRole("dialog", { name: "Koszyk" })
    .getByRole("link", { name: "Przejdź do zamówienia" })
    .click();
  await expect(page).toHaveURL(/\/zamowienie$/);
  await expect(page.getByRole("heading", { name: "Zamówienie", level: 1 })).toBeVisible();
}

/** Data w strefie Europe/Warsaw w formacie RRMMDD (jak w numerze zamowienia). */
function warsawYymmdd(date = new Date()): string {
  const parts = new Intl.DateTimeFormat("pl-PL", {
    timeZone: "Europe/Warsaw",
    year: "2-digit",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  return `${get("year")}${get("month")}${get("day")}`;
}

test.describe("Zamówienie (S17-S18)", () => {
  test("S17: automat paczkowy: brak pól adresu, lista punktów filtrowana po mieście @mobile", async ({
    page,
  }) => {
    await startCheckout(page);
    const delivery = page.getByRole("group", { name: "2. Dostawa" });

    await pick(page, "radio", /^Automat paczkowy/);

    // Jedyne pole tekstowe w sekcji dostawy to wyszukiwarka punktow, nie adres.
    await expect(delivery.getByRole("textbox")).toHaveCount(0);
    await expect(
      delivery.getByRole("searchbox", { name: "Szukaj automatu po mieście" }),
    ).toBeVisible();
    for (const field of [/ulic/i, /kod pocztowy/i, /miejscowo/i]) {
      await expect(delivery.getByLabel(field)).toHaveCount(0);
    }

    const points = delivery
      .getByRole("radiogroup", { name: "Automat paczkowy" })
      .getByRole("radio");
    await expect(points).toHaveCount(6);

    await delivery.getByRole("searchbox", { name: "Szukaj automatu po mieście" }).fill("Warszawa");
    await expect(points).toHaveCount(2);
    await expect(points.first()).toHaveAccessibleName(/^Warszawa WAW-001/);
    await expect(points.nth(1)).toHaveAccessibleName(/^Warszawa WAW-002/);

    await delivery.getByRole("searchbox", { name: "Szukaj automatu po mieście" }).fill("krakow");
    await expect(points).toHaveCount(1);
    await expect(points.first()).toHaveAccessibleName(/^Kraków KRK-001/);
  });

  test("S18: faktura na firmę z błędnym NIP: komunikat pod polem, fokus na polu po próbie wysłania", async ({
    page,
  }) => {
    await startCheckout(page);
    const validNip = generateNip();
    const wrongNip = breakNip(validNip);

    await page.getByRole("textbox", { name: "Adres e-mail" }).fill(CONTACT.email);
    await page.getByRole("textbox", { name: "Telefon" }).fill(CONTACT.phone);
    await pick(page, "radio", /^Odbiór osobisty/);
    await page.getByRole("textbox", { name: "Imię i nazwisko" }).fill(CONTACT.name);
    await pick(page, "radio", "BLIK");
    await page.getByRole("checkbox", { name: /Akceptuję regulamin/ }).check();
    await page.getByRole("checkbox", { name: "Chcę otrzymać fakturę na firmę" }).check();
    const nip = page.getByRole("textbox", { name: "NIP" });
    await nip.fill(wrongNip);
    await page.getByRole("textbox", { name: "Nazwa firmy" }).fill("Firma Testowa Sp. z o.o.");
    await page.getByRole("textbox", { name: "Adres firmy" }).fill("ul. Testowa 1, 00-000 Warszawa");

    await page.getByRole("button", { name: "Zamawiam i płacę" }).click();

    await expect(page).toHaveURL(/\/zamowienie$/);
    await expect(nip).toBeFocused();
    await expect(nip).toHaveAttribute("aria-invalid", "true");
    // Komunikat jest powiazany z polem (aria-describedby) i stoi pod nim.
    await expect(nip).toHaveAccessibleDescription(/Numer NIP jest nieprawidłowy/);
    await expect(page.getByText(/Numer NIP jest nieprawidłowy/)).toBeVisible();

    // Poprawny numer (z sumą kontrolną) pozwala złożyć zamówienie.
    await nip.fill(validNip);
    await submitOrder(page);
  });
});

test.describe("Płatność i potwierdzenie (S19-S20)", () => {
  test("S19: „Zamawiam i płacę”, odrzucona płatność, „Spróbuj ponownie”, udana płatność: potwierdzenie TK-RRMMDD-XXXX, pusty koszyk, payment_failed i jeden purchase", async ({
    page,
  }) => {
    await mirrorDataLayer(page);
    await startCheckout(page);
    const orderId = await placeOrder(page);
    expect(orderId.slice(3, 9)).toBe(warsawYymmdd());

    await page.getByRole("button", { name: "Symuluj odrzuconą płatność" }).click();
    await expect(page).toHaveURL(/\/zamowienie\/blad-platnosci\?id=/);
    await expect(
      page.getByRole("heading", { name: "Płatność nie powiodła się", level: 1 }),
    ).toBeVisible();

    await page.getByRole("button", { name: "Spróbuj ponownie" }).click();
    await expect(page).toHaveURL(/\/zamowienie\/platnosc\?id=/);
    await page.getByRole("button", { name: "Symuluj udaną płatność" }).click();

    await expect(page).toHaveURL(/\/zamowienie\/potwierdzenie\?id=/);
    await expect(
      page.getByRole("heading", { name: "Dziękujemy za zamówienie", level: 1 }),
    ).toBeVisible();
    await expect(page.getByText(/^TK-\d{6}-[A-Z0-9]{4}$/)).toHaveText(orderId);

    // Koszyk jest pusty: brak licznika w naglowku i komunikat na stronie koszyka.
    await expect(cartCounter(page)).toHaveCount(0);
    await page.getByRole("link", { name: "Koszyk" }).first().click();
    await expect(page.getByText("Koszyk jest pusty.")).toBeVisible();

    // Pomiar: payment_failed przed purchase, dokladnie jeden purchase, wartosci jako liczby.
    const events = await trackedEvents(page);
    const order = names(events);
    expect(order.filter((n) => n === "payment_failed")).toHaveLength(1);
    expect(order.filter((n) => n === "purchase")).toHaveLength(1);
    expect(order.indexOf("payment_failed")).toBeLessThan(order.indexOf("purchase"));
    const failed = events.find((e) => e.event === "payment_failed") as Record<string, unknown>;
    expect(failed.transaction_id).toBe(orderId);
    expect(failed.value).toBe(129);
    const purchase = events.find((e) => e.event === "purchase") as unknown as {
      ecommerce: Record<string, unknown>;
    };
    expect(purchase.ecommerce.transaction_id).toBe(orderId);
    expect(purchase.ecommerce.currency).toBe("PLN");
    expect(purchase.ecommerce.value).toBe(129);
    expect(typeof purchase.ecommerce.value).toBe("number");
  });

  test("S20: odświeżenie potwierdzenia nie wysyła drugiego purchase", async ({ page }) => {
    await mirrorDataLayer(page);
    await startCheckout(page);
    const orderId = await placeOrder(page);
    await page.getByRole("button", { name: "Symuluj udaną płatność" }).click();
    await expect(
      page.getByRole("heading", { name: "Dziękujemy za zamówienie", level: 1 }),
    ).toBeVisible();
    await expect
      .poll(async () => names(await trackedEvents(page)).filter((n) => n === "purchase").length)
      .toBe(1);

    await page.reload();

    await expect(
      page.getByRole("heading", { name: "Dziękujemy za zamówienie", level: 1 }),
    ).toBeVisible();
    await expect(page.getByText(orderId, { exact: true })).toBeVisible();
    await page.waitForLoadState("networkidle");
    // Po przeladowaniu warstwa danych jest nowa, ale kopia z sesji pokazuje cala historie: nadal jeden purchase.
    expect((await liveDataLayer(page)).filter((e) => e.event === "purchase")).toHaveLength(0);
    expect(names(await trackedEvents(page)).filter((n) => n === "purchase")).toHaveLength(1);
  });
});
