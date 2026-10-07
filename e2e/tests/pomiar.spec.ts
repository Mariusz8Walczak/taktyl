// I-010 (TAKTYL-44): test przed oddaniem z docs/10 par. 7 - sciezka pomiaru z kolejnoscia zdarzen.
// Zrodlem jest window.dataLayer (kopia w sessionStorage, helpers/tracking.ts); panel podgladu zdarzen (F-243) ma osobne zadanie.
import { expect, test } from "../helpers/fixtures";
import {
  isOrderedSubsequence,
  mirrorDataLayer,
  names,
  trackedEvents,
  type TrackedEvent,
} from "../helpers/tracking";
import {
  applyCode,
  CONTACT,
  loadPreset,
  openCartDrawer,
  pick,
  submitOrder,
  summary,
} from "../helpers/ui";

const isNumber = (value: unknown) => typeof value === "number" && Number.isFinite(value);

test("Pomiar: ścieżka z docs/10 par. 7 daje zdarzenia w kolejności, liczby zamiast tekstów i jeden purchase", async ({
  page,
}) => {
  await mirrorDataLayer(page);

  // 1. Gotowy set Programista, profil FPS i podkladka Tafla M (ostrzezenie 36 cm na 40 cm), propozycja "Zmień na Tafla L".
  await loadPreset(page, "Programista");
  await page
    .getByRole("navigation", { name: "Kroki kreatora" })
    .getByRole("link", { name: /^0 Do czego\?/ })
    .click();
  await pick(page, "radio", /^Gry FPS, niski sens/);
  await page.getByRole("button", { name: /^Zmień podkładkę/ }).click();
  await pick(page, "radio", /^Pod samą myszkę/);
  await pick(page, "radio", /^Tafla/);
  await pick(page, "radio", /^M 36/);
  await expect(
    summary(page).getByRole("region", { name: "Dopasowanie" }).getByRole("status"),
  ).toHaveText("Pasuje z 1 uwagą");
  await page.getByRole("button", { name: "Zmień na Tafla L (+30,00 zł)" }).click();
  await expect(
    summary(page).getByRole("region", { name: "Dopasowanie" }).getByRole("status"),
  ).toHaveText("Pasuje");

  // 2. Dodanie setu do koszyka, koszyk, kod TAKTYL10 (komunikat o setach).
  await page.getByRole("button", { name: "Dodaj set do koszyka" }).click();
  const drawer = await openCartDrawer(page);
  await drawer.getByRole("link", { name: "Zobacz koszyk" }).click();
  await expect(page).toHaveURL(/\/koszyk$/);
  await applyCode(page, "TAKTYL10");
  await expect(
    page.getByText("Kod nie obejmuje setów — rabat za set jest już naliczony."),
  ).toBeVisible();

  // 3. Zamowienie: automat paczkowy, BLIK, symulacja bledu, ponowna proba, sukces.
  await page.getByRole("link", { name: "Przejdź do zamówienia" }).click();
  await expect(page).toHaveURL(/\/zamowienie$/);
  await page.getByRole("textbox", { name: "Adres e-mail" }).fill(CONTACT.email);
  await page.getByRole("textbox", { name: "Telefon" }).fill(CONTACT.phone);
  await pick(page, "radio", /^Automat paczkowy/);
  await page.getByRole("searchbox", { name: "Szukaj automatu po mieście" }).fill("Warszawa");
  await pick(page, "radio", /^Warszawa WAW-001/);
  await pick(page, "radio", "BLIK");
  await page.getByRole("checkbox", { name: /Akceptuję regulamin/ }).check();
  await submitOrder(page);
  const orderId = new URL(page.url()).searchParams.get("id") as string;

  await page.getByRole("button", { name: "Symuluj odrzuconą płatność" }).click();
  await expect(page).toHaveURL(/\/zamowienie\/blad-platnosci\?id=/);
  await page.getByRole("button", { name: "Spróbuj ponownie" }).click();
  await expect(page).toHaveURL(/\/zamowienie\/platnosc\?id=/);
  await page.getByRole("button", { name: "Symuluj udaną płatność" }).click();
  await expect(
    page.getByRole("heading", { name: "Dziękujemy za zamówienie", level: 1 }),
  ).toBeVisible();

  // 4. Odswiezenie potwierdzenia.
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Dziękujemy za zamówienie", level: 1 }),
  ).toBeVisible();
  await page.waitForLoadState("networkidle");

  const events = await trackedEvents(page);
  const order = names(events);
  test.info().annotations.push({ type: "kolejnosc-zdarzen", description: order.join(" > ") });

  // Kolejnosc zdarzen z docs/10 par. 4 i 5. set_complete wymaga zmiany 2 -> 3 kategorii; gotowy set laduje od razu z trzema,
  // wiec go tu nie ma (zapisane w docs/decyzje.md I-010).
  const expectedOrder = [
    "gtag_consent_default",
    "set_builder_start",
    "set_profile_select",
    "set_fit_warning",
    "set_suggestion_apply",
    "add_to_cart",
    "set_add_to_cart",
    "view_cart",
    "begin_checkout",
    "add_shipping_info",
    "add_payment_info",
    "payment_failed",
    "add_payment_info",
    "purchase",
  ];
  expect(isOrderedSubsequence(order, expectedOrder), `kolejnosc: ${order.join(" > ")}`).toBe(true);

  // Jeden purchase i jeden payment_failed przed nim; po odswiezeniu bez drugiego purchase.
  expect(order.filter((n) => n === "purchase")).toHaveLength(1);
  expect(order.filter((n) => n === "payment_failed")).toHaveLength(1);
  expect(order.indexOf("payment_failed")).toBeLessThan(order.indexOf("purchase"));
  expect(order.filter((n) => n === "add_payment_info")).toHaveLength(2);

  const ecommerce = (e: TrackedEvent) => e.ecommerce as Record<string, unknown>;
  const purchase = events.find((e) => e.event === "purchase") as TrackedEvent;
  const failed = events.find((e) => e.event === "payment_failed") as TrackedEvent;
  expect(ecommerce(purchase).transaction_id).toBe(orderId);
  expect(failed.transaction_id).toBe(orderId);

  // Wartosci jako liczby (reguła 9), waluta PLN, wartosc handlowa po rabatach.
  for (const name of [
    "add_to_cart",
    "view_cart",
    "begin_checkout",
    "add_shipping_info",
    "add_payment_info",
    "purchase",
  ]) {
    for (const e of events.filter((x) => x.event === name)) {
      expect(isNumber(ecommerce(e).value), `${name}.value jest liczba`).toBe(true);
      expect(ecommerce(e).currency, `${name}.currency`).toBe("PLN");
    }
  }
  expect(isNumber(failed.value)).toBe(true);
  expect(isNumber(ecommerce(purchase).shipping)).toBe(true);
  expect(isNumber(ecommerce(purchase).tax)).toBe(true);

  // Zestaw 1337 zl - 10% = 1203,30 zl; Tafla L zamiast M (+30 zl): 749 + 399 + 99 = 1247 zl, rabat 124,70 zl, razem 1122,30 zl.
  const setAdd = events.find((e) => e.event === "set_add_to_cart") as TrackedEvent;
  expect(setAdd.value).toBe(1122.3);
  expect(setAdd.discount).toBe(124.7);
  expect(setAdd.profile).toBe("fps");
  expect(setAdd.warnings).toBe(0);

  // `discount` w pozycjach setu sumuje sie do rabatu z podsumowania (w groszach, bez bledu zmiennoprzecinkowego).
  const addToCart = events.find((e) => e.event === "add_to_cart") as TrackedEvent;
  const items = ecommerce(addToCart).items as Array<{ discount?: number }>;
  const discountSum = Math.round(items.reduce((acc, i) => acc + (i.discount ?? 0) * 100, 0));
  expect(discountSum).toBe(12470);

  // Zero danych osobowych w zdarzeniach (docs/10 par. 1.5).
  const serialized = JSON.stringify(events);
  expect(serialized).not.toContain(CONTACT.email);
  expect(serialized).not.toContain(CONTACT.phone);
  expect(serialized).not.toContain(CONTACT.name);
});
