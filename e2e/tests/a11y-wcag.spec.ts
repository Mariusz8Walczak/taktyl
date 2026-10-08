// TAKTYL-68 (docs/12 par. 6, WCAG 2.1 AA): audyt dostepnosci jako stale testy.
// Zakres: sciezka S9-S19 tylko klawiatura, axe (0 bledow krytycznych i powaznych) w sklepie, 200% zoom i 320 px bez
// przewijania poziomego, prefers-reduced-motion (stany koncowe), formularze z aria-invalid i aria-describedby,
// widoczny fokus, przycisk zamkniecia okien z widoczna etykieta tekstowa (D-010). Backpanel: S36 w backpanel/b-s-panel.
import type { Page } from "@playwright/test";
import { axeBlockingViolations } from "../helpers/a11y";
import { expect, test } from "../helpers/fixtures";
import {
  arrowToRadio,
  hasVisibleFocusIndicator,
  pressEnterOn,
  pressSpaceOn,
  typeInto,
} from "../helpers/keyboard";
import {
  addProductToCart,
  CONTACT,
  definition,
  norm,
  openCartDrawer,
  pick,
} from "../helpers/ui";

/** Szuflada koszyka z jednym produktem i przejscie na /koszyk (mysza dozwolona poza testem klawiatury). */
async function cartWithProduct(page: Page, path = "/myszki/wrobel") {
  await addProductToCart(page, path);
  await page
    .getByRole("dialog", { name: "Koszyk" })
    .getByRole("link", { name: "Zobacz koszyk" })
    .click();
  await expect(page).toHaveURL(/\/koszyk$/);
}

test.describe("Sciezka S9-S19 tylko klawiatura (WCAG 2.1.1)", () => {
  test("klawiatura: baner zgod, kreator (gotowy set), koszyk z kodem, zamowienie, odrzucona i udana platnosc", async ({
    page,
  }) => {
    await page.goto("/zbuduj-set");

    // S24: decyzja w banerze zgod klawiszem Enter na rownorzednym przycisku.
    const banner = page.getByRole("region", { name: "Zgody na pliki cookies" });
    await pressEnterOn(page, banner.getByRole("button", { name: "Tylko niezbędne" }));
    await expect(banner).toBeHidden();

    // S9: gotowy set Programista z kreatora.
    await pressEnterOn(page, page.getByRole("button", { name: "Wczytaj set Programista" }));
    await expect(page.getByRole("heading", { name: /Krok 4 z 4: Podsumowanie/ })).toBeVisible();
    const aside = page.getByRole("complementary", { name: "Podsumowanie setu" });
    await expect(definition(aside, "Razem")).toContainText("1203,30 zł");

    // S12: dodanie setu do koszyka (Enter), szuflada przejmuje fokus.
    await pressEnterOn(page, page.getByRole("button", { name: "Dodaj set do koszyka" }));
    const drawer = await openCartDrawer(page);
    await expect(drawer.getByRole("region", { name: "Twój set · −10%" })).toBeVisible();
    // Pulapka fokusu: Tab nie wychodzi poza szuflade, Shift+Tab tez.
    for (let i = 0; i < 12; i++) {
      await page.keyboard.press("Tab");
      expect(await page.evaluate(() => !!document.activeElement?.closest('[role="dialog"]'))).toBe(
        true,
      );
    }
    await page.keyboard.press("Shift+Tab");
    expect(await page.evaluate(() => !!document.activeElement?.closest('[role="dialog"]'))).toBe(
      true,
    );

    // S13: koszyk, kod rabatowy (pole tekstowe + przycisk), komunikat dla samego setu.
    await pressEnterOn(page, drawer.getByRole("link", { name: "Zobacz koszyk" }));
    await expect(page).toHaveURL(/\/koszyk$/);
    await typeInto(page, page.getByRole("textbox", { name: "Kod rabatowy" }), "TAKTYL10");
    await pressEnterOn(page, page.getByRole("button", { name: "Zastosuj kod" }));
    await expect(
      page.getByText("Kod nie obejmuje setów — rabat za set jest już naliczony."),
    ).toBeVisible();

    // S17-S18: zamowienie (odbior osobisty, BLIK, regulamin), wszystko klawiszami.
    await pressEnterOn(page, page.getByRole("link", { name: "Przejdź do zamówienia" }));
    await expect(page).toHaveURL(/\/zamowienie$/);
    await typeInto(page, page.getByRole("textbox", { name: "Adres e-mail" }), CONTACT.email);
    await typeInto(page, page.getByRole("textbox", { name: "Telefon" }), CONTACT.phone);
    await arrowToRadio(page, page.getByRole("radio", { name: /^Odbiór osobisty/ }));
    await typeInto(page, page.getByRole("textbox", { name: "Imię i nazwisko" }), CONTACT.name);
    await arrowToRadio(page, page.getByRole("radio", { name: "BLIK" }));
    await pressSpaceOn(page, page.getByRole("checkbox", { name: /Akceptuję regulamin/ }));
    await expect(page.getByRole("checkbox", { name: /Akceptuję regulamin/ })).toBeChecked();

    // S19: wyslanie, odrzucona platnosc, ponowna proba, udana platnosc.
    await pressEnterOn(page, page.getByRole("button", { name: "Zamawiam i płacę" }));
    await expect(page).toHaveURL(/\/zamowienie\/platnosc\?id=/);
    await pressEnterOn(page, page.getByRole("button", { name: "Symuluj odrzuconą płatność" }));
    await expect(page).toHaveURL(/\/zamowienie\/blad-platnosci\?id=/);
    await pressEnterOn(page, page.getByRole("button", { name: "Spróbuj ponownie" }));
    await expect(page).toHaveURL(/\/zamowienie\/platnosc\?id=/);
    await pressEnterOn(page, page.getByRole("button", { name: "Symuluj udaną płatność" }));
    await expect(page).toHaveURL(/\/zamowienie\/potwierdzenie\?id=/);
    await expect(
      page.getByRole("heading", { name: "Dziękujemy za zamówienie", level: 1 }),
    ).toBeVisible();
  });

  test("klawiatura: Esc zamyka szuflade koszyka i oddaje fokus przyciskowi, ktory ja otworzyl", async ({
    page,
  }) => {
    await page.goto("/myszki/wrobel");
    const open = page.getByRole("button", { name: "Dodaj do koszyka" });
    await pressEnterOn(page, open);
    await openCartDrawer(page);
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog", { name: "Koszyk" })).toBeHidden();
    await expect(open).toBeFocused();
  });
});

/** Okno skrotow z odnosnika w stopce; ponawia klik, dopoki wyspa nie jest po hydracji (delegacja zdarzenia dziala dopiero wtedy). */
async function openShortcuts(page: Page) {
  await page.waitForLoadState("networkidle");
  const dialog = page.getByRole("dialog", { name: "Skróty klawiszowe" });
  await expect(async () => {
    if (!(await dialog.isVisible())) {
      await page.getByRole("button", { name: "Skróty klawiszowe" }).first().click();
    }
    await expect(dialog).toBeVisible({ timeout: 1500 });
  }).toPass({ timeout: 10_000 });
}

const SHOP_PAGES: Array<[name: string, path: string]> = [
  ["strona glowna", "/"],
  ["listing klawiatur", "/klawiatury"],
  ["karta produktu", "/klawiatury/bazalt-75"],
  ["kreator setu", "/zbuduj-set"],
  ["regulamin", "/regulamin"],
  ["kontakt", "/kontakt"],
  ["faq", "/faq"],
  ["poradnik", "/poradnik"],
  ["strona 404", "/nie-ma-takiej-strony"],
];

test.describe("axe-core: sklep, 0 bledow krytycznych i powaznych (WCAG 2.1 AA)", () => {
  for (const [name, path] of SHOP_PAGES) {
    test(`axe: ${name}`, async ({ page }) => {
      await page.goto(path);
      await page.waitForLoadState("networkidle");
      expect(await axeBlockingViolations(page)).toEqual([]);
    });
  }

  test("axe: koszyk, zamowienie, platnosc i potwierdzenie", async ({ page }) => {
    await cartWithProduct(page);
    await page.waitForLoadState("networkidle");
    expect(await axeBlockingViolations(page), "koszyk").toEqual([]);

    await page.getByRole("link", { name: "Przejdź do zamówienia" }).click();
    await expect(page).toHaveURL(/\/zamowienie$/);
    await page.waitForLoadState("networkidle");
    expect(await axeBlockingViolations(page), "zamowienie").toEqual([]);

    // pusty formularz: komunikaty bledow tez nie lamia axe
    await page.getByRole("button", { name: "Zamawiam i płacę" }).click();
    await expect(page.locator('[aria-invalid="true"]').first()).toBeVisible();
    expect(await axeBlockingViolations(page), "zamowienie z bledami").toEqual([]);
  });

  test("axe: otwarte okna (szuflada koszyka, skroty klawiszowe, wyszukiwarka)", async ({ page }) => {
    await page.goto("/myszki/wrobel");
    await page.getByRole("button", { name: "Dodaj do koszyka" }).click();
    await openCartDrawer(page);
    await expect(page.locator(".tk-overlay[data-anim]")).toHaveCount(0); // axe mierzy kontrast dopiero po wjezdzie (A-12)
    expect(await axeBlockingViolations(page), "szuflada").toEqual([]);
    await page.keyboard.press("Escape");

    await openShortcuts(page);
    await expect(page.locator(".tk-overlay[data-anim]")).toHaveCount(0);
    expect(await axeBlockingViolations(page), "skroty").toEqual([]);
    await page.keyboard.press("Escape");

    await page.getByRole("banner").getByRole("link", { name: "Szukaj" }).click();
    await expect(page.getByRole("dialog", { name: "Wyszukiwarka" })).toBeVisible();
    await expect(page.locator(".tk-overlay[data-anim]")).toHaveCount(0);
    expect(await axeBlockingViolations(page), "wyszukiwarka").toEqual([]);
  });
});

/** True, gdy dokument nie przewija sie poziomo (tolerancja 1 px na zaokraglenia). */
async function noHorizontalScroll(page: Page): Promise<{ ok: boolean; scroll: number; client: number }> {
  return page.evaluate(() => {
    const el = document.documentElement;
    return {
      ok: el.scrollWidth <= el.clientWidth + 1,
      scroll: el.scrollWidth,
      client: el.clientWidth,
    };
  });
}

test.describe("Reflow (WCAG 1.4.10, 1.4.4): 320 px i 200% zoom bez przewijania poziomego", () => {
  // 320 px = szerokosc z kryterium 1.4.10; 200% zoomu na 1280 px = 640 px CSS (okno 640 px w ukladzie o tej szerokosci).
  const VIEWPORTS = [
    { name: "320 px", width: 320, height: 640 },
    { name: "200% zoom (640 px CSS)", width: 640, height: 400 },
  ];
  const PAGES: Array<[string, string]> = [
    ["strona glowna", "/"],
    ["listing klawiatur", "/klawiatury"],
    ["karta produktu", "/klawiatury/bazalt-75"],
    ["kreator setu", "/zbuduj-set"],
    ["koszyk (pusty)", "/koszyk"],
    ["zamowienie", "/zamowienie"],
    ["regulamin", "/regulamin"],
    ["strona 404", "/nie-ma-takiej-strony"],
  ];
  for (const vp of VIEWPORTS) {
    for (const [name, path] of PAGES) {
      test(`${vp.name}: ${name}`, async ({ page }) => {
        await page.setViewportSize({ width: vp.width, height: vp.height });
        await page.goto(path);
        await page.waitForLoadState("networkidle");
        const r = await noHorizontalScroll(page);
        expect(r.ok, `scrollWidth ${r.scroll} > clientWidth ${r.client}`).toBe(true);
      });
    }
  }

  test("320 px: koszyk z produktem i formularz zamowienia z bledami bez przewijania poziomego", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 320, height: 640 });
    await cartWithProduct(page);
    let r = await noHorizontalScroll(page);
    expect(r.ok, `koszyk: ${r.scroll} > ${r.client}`).toBe(true);
    await page.getByRole("link", { name: "Przejdź do zamówienia" }).click();
    await expect(page).toHaveURL(/\/zamowienie$/);
    await page.getByRole("button", { name: "Zamawiam i płacę" }).click();
    await expect(page.locator('[aria-invalid="true"]').first()).toBeVisible();
    r = await noHorizontalScroll(page);
    expect(r.ok, `zamowienie: ${r.scroll} > ${r.client}`).toBe(true);
  });
});

test.describe("prefers-reduced-motion: stany koncowe bez ruchu (reguła 6)", () => {
  test.beforeEach(async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
  });

  test("A-04: zmiana ilosci w koszyku od razu pokazuje wlasciwa kwote „Razem”", async ({ page }) => {
    await cartWithProduct(page); // Wrobel x 1
    const total = page.getByTestId("koszyk-razem");
    await expect(total).toContainText(/zł/); // koszyk po pierwszej wycenie (szkielet nie ma kwoty)
    const before = norm((await total.locator(".kwota__wartosc").textContent()) ?? "");
    const unit = Number(before.replace(/[^\d,]/g, "").replace(",", "."));
    expect(unit).toBeGreaterThan(0);

    await page.getByRole("button", { name: "Zwiększ ilość" }).first().click();
    // Bez ruchu: tekst widoczny i region live od razu maja kwote koncowa (dwa razy cena sztuki, z darmowa dostawa lub bez).
    await expect
      .poll(async () => norm((await total.locator(".kwota__wartosc").textContent()) ?? ""))
      .not.toBe(before);
    const visible = norm((await total.locator(".kwota__wartosc").textContent()) ?? "");
    const live = norm((await total.locator("[data-kwota-live]").textContent()) ?? "");
    expect(visible).toBe(live);
    // wartosc produktow w podsumowaniu = 2 x cena sztuki; "Razem" nie moze byc mniejsze od niej
    const products = definition(page.getByRole("complementary", { name: "Podsumowanie" }), "Wartość produktów");
    await expect(products).toContainText(
      new Intl.NumberFormat("pl-PL", { style: "currency", currency: "PLN" })
        .format(unit * 2)
        .replace(/\s/g, " "),
    );
    const razem = Number(visible.replace(/[^\d,]/g, "").replace(",", "."));
    expect(razem).toBeGreaterThanOrEqual(unit * 2);
  });

  test("A-16: trzecia kategoria ustawia is-komplet na podsumowaniu, bez ruchu klasa schodzi po zapasie czasowym", async ({
    page,
  }) => {
    await page.goto("/zbuduj-set");
    await pick(page, "radio", /^Gry FPS, niski sens/);
    await page.getByRole("button", { name: "Dalej: klawiatura" }).click();
    await pick(page, "radio", /^Marmur 100/);
    await page.getByRole("button", { name: "Dalej: myszka" }).click();
    await pick(page, "radio", /^Jerzyk/);
    await page.getByRole("button", { name: "Dalej: podkładka" }).click();
    const aside = page.getByRole("complementary", { name: "Podsumowanie setu" });
    await expect(aside).not.toHaveClass(/is-komplet/);

    await pick(page, "radio", /^Na całe biurko/);
    await pick(page, "radio", /^Szron/);
    await pick(page, "radio", /^XL 90/);
    // 2 -> 3 kategorie: hak klasy ustawiony od razu...
    await expect(aside).toHaveClass(/is-komplet/);
    // ...a przy reduced-motion animationend nie nadejdzie, wiec klasa schodzi po zapasie 1,5 s (set-complete.ts).
    await expect(aside).not.toHaveClass(/is-komplet/, { timeout: 4000 });
    // stan koncowy: dopasowanie i cena widoczne, pierscien (::before) nie zaslania tresci
    await page.getByRole("button", { name: "Dalej: podsumowanie" }).click();
    await expect(definition(aside, "Razem")).toBeVisible();
    const ring = await aside.evaluate((el) => getComputedStyle(el, "::before").content);
    expect(["none", "normal", '""']).toContain(ring);
  });
});

test.describe("Formularz zamowienia: aria-invalid i aria-describedby (WCAG 3.3.1, 3.3.3, 4.1.2)", () => {
  test("puste pola: kazde pole z bledem ma aria-invalid i opis wskazujacy istniejacy komunikat; fokus na pierwszym bledzie", async ({
    page,
  }) => {
    await cartWithProduct(page);
    await page.getByRole("link", { name: "Przejdź do zamówienia" }).click();
    await expect(page).toHaveURL(/\/zamowienie$/);
    await page.getByRole("button", { name: "Zamawiam i płacę" }).click();

    const invalid = page.locator('[aria-invalid="true"]');
    await expect(invalid.first()).toBeVisible();
    expect(await invalid.count()).toBeGreaterThanOrEqual(3);
    // pierwsze pole z bledem dostaje fokus
    await expect(invalid.first()).toBeFocused();

    const report = await invalid.evaluateAll((els) =>
      els.map((el) => {
        // Kafle radio (dostawa, platnosc): opis niesie fieldset grupy (aria-describedby na grupie), wiec liczy sie najblizszy opis.
        const owner = el.hasAttribute("aria-describedby")
          ? el
          : el.closest("fieldset[aria-describedby], [role=radiogroup][aria-describedby]");
        const ids = (owner?.getAttribute("aria-describedby") ?? "").split(/\s+/).filter(Boolean);
        const messages = ids.map((id) => document.getElementById(id)?.textContent?.trim() ?? "");
        return {
          label: el.getAttribute("aria-label") ?? el.id ?? el.tagName,
          describedby: ids.length,
          nonEmpty: messages.some((m) => m.length > 0),
        };
      }),
    );
    for (const r of report) {
      expect(r.describedby, `${r.label}: brak aria-describedby`).toBeGreaterThan(0);
      expect(r.nonEmpty, `${r.label}: aria-describedby wskazuje pusty lub nieistniejacy element`).toBe(true);
    }
    // komunikat jest tez w dostepnym opisie pola (nie tylko w DOM)
    await expect(invalid.first()).toHaveAccessibleDescription(/\S/);

    // poprawa pola zdejmuje blad
    const email = page.getByRole("textbox", { name: "Adres e-mail" });
    await email.fill(CONTACT.email);
    await expect(email).not.toHaveAttribute("aria-invalid", "true");
  });
});

test.describe("Widoczny fokus (WCAG 2.4.7, 2.4.11)", () => {
  test("Tab po stronie glownej: kazdy fokusowany element ma widoczny wskaznik", async ({
    page,
  }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");
    // zamkniecie banera zgod, zeby nie zaslanial elementow
    await page.getByRole("button", { name: "Tylko niezbędne" }).click();
    const problems: string[] = [];
    for (let i = 0; i < 40; i++) {
      await page.keyboard.press("Tab");
      const active = page.locator(":focus");
      if ((await active.count()) !== 1) continue;
      const desc = await active.evaluate((el) => {
        return `${el.tagName.toLowerCase()}[${el.getAttribute("aria-label") ?? el.textContent?.trim().slice(0, 30) ?? ""}]`;
      });
      if (!(await hasVisibleFocusIndicator(active))) problems.push(`${desc}: brak wskaznika fokusu`);
    }
    expect(problems).toEqual([]);
  });

  test("odnosnik „Przejdz do tresci” jest pierwszym fokusem i prowadzi do glownej tresci", async ({
    page,
  }) => {
    await page.goto("/klawiatury");
    await page.keyboard.press("Tab");
    const skip = page.locator(":focus");
    await expect(skip).toContainText(/Przejd. do tre.ci|Pomi. nawigacj/i);
    await expect(skip).toBeVisible();
    expect(await hasVisibleFocusIndicator(skip)).toBe(true);
    await page.keyboard.press("Enter");
    await expect(page.locator("main")).toBeVisible();
  });
});

test.describe("Okna: przycisk zamkniecia ma dostepna nazwe i widoczna etykiete tekstowa (D-010)", () => {
  async function checkClose(page: Page, name: string) {
    const dialog = page.getByRole("dialog", { name });
    await expect(dialog).toBeVisible();
    await expect(page.locator(".tk-overlay[data-anim]")).toHaveCount(0); // rozmiar mierzymy po animacji A-12 (scale)
    const close = dialog.getByRole("button", { name: /^Zamknij/ });
    await expect(close).toHaveCount(1);
    await expect(close).toBeVisible();
    // widoczna etykieta: tekst przycisku (innerText) niepusty, a nie sama pusta ikona
    const visibleText = await close.evaluate((el) => (el as HTMLElement).innerText.trim());
    expect(visibleText, `okno „${name}”: przycisk zamkniecia bez widocznego tekstu`).toMatch(/\S/);
    const box = await close.boundingBox();
    expect(
      box && box.width >= 44 && box.height >= 44,
      `cel dotyku >= 44 px (docs/06), jest ${box?.width} x ${box?.height}`,
    ).toBe(true);
    return close;
  }

  test("okno skrotow klawiszowych", async ({ page }) => {
    await page.goto("/");
    await openShortcuts(page);
    const close = await checkClose(page, "Skróty klawiszowe");
    await close.focus();
    await page.keyboard.press("Enter");
    await expect(page.getByRole("dialog", { name: "Skróty klawiszowe" })).toBeHidden();
  });

  test("szuflada koszyka", async ({ page }) => {
    await page.goto("/myszki/wrobel");
    await page.getByRole("button", { name: "Dodaj do koszyka" }).click();
    await checkClose(page, "Koszyk");
  });

  test("wyszukiwarka", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("banner").getByRole("link", { name: "Szukaj" }).click();
    await checkClose(page, "Wyszukiwarka");
  });
});
