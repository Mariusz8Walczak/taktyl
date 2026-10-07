// I-010 (TAKTYL-44): wspolne pomocniki testow e2e. Selektory przez role i etykiety (getByRole), bez klas CSS.
import { expect, type Locator, type Page } from "@playwright/test";

/** Zwija biale znaki (twarde spacje z Intl tez) do jednej spacji. */
export const norm = (s: string): string => s.replace(/\s+/g, " ").trim();

/**
 * Kafle wyboru (profil, dostawa, platnosc, wariant) ukrywaja natywny input, a klik w srodek trafia w etykiete.
 * Klikamy wiec etykiete otaczajaca pole, tak jak robi to czlowiek.
 */
export async function pick(
  page: Page,
  role: "radio" | "checkbox",
  name: string | RegExp,
): Promise<void> {
  const input = page.getByRole(role, { name });
  await expect(input).toHaveCount(1);
  const label = page.locator("label").filter({ has: input });
  await label.click();
  await expect(input).toBeChecked();
}

/** Licznik wynikow listingu ("4 produkty"): element role=status z liczebnikiem. */
export function resultCount(page: Page): Locator {
  return page.getByRole("status").filter({ hasText: /^\d+ produkt/ });
}

export function cartCounter(page: Page): Locator {
  return page.getByTestId("licznik-koszyka");
}

/** Wczytuje gotowy set w kreatorze i czeka na podsumowanie. */
export async function loadPreset(page: Page, name: string): Promise<void> {
  await page.goto("/zbuduj-set");
  await page.getByRole("button", { name: `Wczytaj set ${name}` }).click();
  await expect(page.getByRole("heading", { name: /Krok 4 z 4: Podsumowanie/ })).toBeVisible();
}

export function summary(page: Page): Locator {
  return page.getByRole("complementary", { name: "Podsumowanie setu" });
}

/** Wartosc z listy definicji (dt/dd) w podanym obszarze, np. "Razem". */
export function definition(scope: Locator, term: string): Locator {
  return scope
    .locator("dt", { hasText: new RegExp(`^${term}$`) })
    .locator("xpath=following-sibling::dd[1]");
}

export async function openCartDrawer(page: Page): Promise<Locator> {
  const drawer = page.getByRole("dialog", { name: "Koszyk" });
  await expect(drawer).toBeVisible();
  return drawer;
}

/** Dodaje do koszyka produkt ze strony karty (wariant domyslny); szuflada koszyka zostaje otwarta. */
export async function addProductToCart(page: Page, path: string): Promise<void> {
  await page.goto(path);
  await page.getByRole("button", { name: "Dodaj do koszyka" }).click();
  await openCartDrawer(page);
}

export async function goToCartPage(page: Page): Promise<void> {
  await page
    .getByRole("dialog", { name: "Koszyk" })
    .getByRole("link", { name: "Zobacz koszyk" })
    .click();
  await expect(page).toHaveURL(/\/koszyk$/);
  await expect(page.getByRole("heading", { name: "Koszyk", level: 1 })).toBeVisible();
}

export async function applyCode(page: Page, code: string): Promise<void> {
  await page.getByRole("textbox", { name: "Kod rabatowy" }).fill(code);
  await page.getByRole("button", { name: "Zastosuj kod" }).click();
}

export const CONTACT = {
  email: "jan@taktyl.example",
  phone: "500000000",
  name: "Jan Testowy",
};

/**
 * Wysyla zamowienie i czeka na strone platnosci. Przed pierwsza wycena koszyka (kilkaset ms po wejsciu na /zamowienie)
 * przycisk nic nie robi i nie daje znaku (TAKTYL-80), wiec test klika ponownie, tak jak zrobilby to czlowiek;
 * ponowienie jest bezpieczne (ten sam klucz idempotencji, jedno zamowienie).
 */
export async function submitOrder(page: Page): Promise<void> {
  await expect(async () => {
    await page.getByRole("button", { name: "Zamawiam i płacę" }).click();
    await expect(page).toHaveURL(/\/zamowienie\/platnosc\?id=/, { timeout: 2_000 });
  }).toPass({ timeout: 20_000 });
}

/** Wypelnia formularz zamowienia (odbior osobisty: najmniej pol) i wysyla. Zwraca numer zamowienia z adresu platnosci. */
export async function placeOrder(page: Page, opts: { payment?: string } = {}): Promise<string> {
  await expect(page).toHaveURL(/\/zamowienie$/);
  await page.getByRole("textbox", { name: "Adres e-mail" }).fill(CONTACT.email);
  await page.getByRole("textbox", { name: "Telefon" }).fill(CONTACT.phone);
  await pick(page, "radio", /^Odbiór osobisty/);
  await page.getByRole("textbox", { name: "Imię i nazwisko" }).fill(CONTACT.name);
  await pick(page, "radio", opts.payment ?? "BLIK");
  await page.getByRole("checkbox", { name: /Akceptuję regulamin/ }).check();
  await submitOrder(page);
  const id = new URL(page.url()).searchParams.get("id");
  expect(id).toMatch(/^TK-\d{6}-[A-Z0-9]{4}$/);
  return id as string;
}

/** Na telefonie filtry sa w oknie "Filtry" (przycisk w nad listingiem); na komputerze stoja obok listy. */
export async function openFilters(page: Page): Promise<boolean> {
  const button = page.getByRole("button", { name: /^Filtry/ });
  if (!(await button.first().isVisible())) return false;
  await button.first().click();
  await expect(page.getByRole("dialog", { name: "Filtry" })).toBeVisible();
  return true;
}

export async function closeFilters(page: Page): Promise<void> {
  await page
    .getByRole("dialog", { name: "Filtry" })
    .getByRole("button", { name: /^Pokaż \d+ produkt/ })
    .click();
  await expect(page.getByRole("dialog", { name: "Filtry" })).toBeHidden();
}
