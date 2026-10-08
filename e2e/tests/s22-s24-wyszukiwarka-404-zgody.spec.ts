// I-010 (TAKTYL-44): scenariusze S22-S24 z docs/12 par. 1 (wyszukiwarka bez polskich znakow, strona 404, pierwsza wizyta i zgody).
import { expect, test } from "../helpers/fixtures";
import { liveDataLayer, names } from "../helpers/tracking";

test.describe("Wyszukiwarka (S22)", () => {
  // Pelna strona wynikow (/szukaj) jest w budowie, wiec test sprawdza podpowiedzi w oknie wyszukiwarki (F-004).
  const CASES: Array<[query: string, expectedFirst: string]> = [
    ["lupek", "Łupek 65"],
    ["lod", "Lód"],
    ["pustulka", "Pustułka"],
    ["tkl", "Granit TKL"],
  ];

  test("S22: wyszukiwarka znajduje produkty po frazach bez polskich znaków (lupek, lod, pustulka, tkl) @mobile", async ({
    page,
  }) => {
    await page.goto("/");
    await page.getByRole("banner").getByRole("link", { name: "Szukaj" }).click();
    const dialog = page.getByRole("dialog", { name: "Wyszukiwarka" });
    const box = dialog.getByRole("combobox", { name: "Szukaj w sklepie" });
    await expect(box).toBeVisible();

    for (const [query, expectedFirst] of CASES) {
      await box.fill(query);
      const first = dialog.getByRole("option").first();
      await expect(first, `fraza „${query}”`).toContainText(expectedFirst);
    }
  });
});

test.describe("Strona 404 (S23)", () => {
  test("S23: /nie-ma-takiej-strony zwraca kod 404 i stronę błędu ze sklepem (nagłówek, nawigacja, stopka)", async ({
    page,
  }) => {
    const response = await page.goto("/nie-ma-takiej-strony");

    expect(response?.status()).toBe(404);
    await expect(
      page.getByRole("heading", { name: "Nie ma takiej strony", level: 1 }),
    ).toBeVisible();
    await expect(page.getByRole("link", { name: "Wróć na stronę główną" })).toHaveAttribute(
      "href",
      "/",
    );
    await expect(page.getByRole("banner")).toBeVisible();
    await expect(page.getByRole("contentinfo")).toBeVisible();
    // Regula 10: takze odpowiedz bledu jest noindex.
    expect(response?.headers()["x-robots-tag"]).toBe("noindex, nofollow");
  });
});

test.describe("Pierwsza wizyta (S24)", () => {
  test.use({ presetConsent: false });

  test("S24: pasek demo, baner zgód z równorzędnymi przyciskami, brak zdarzeń i żądań do narzędzi przed zgodą @mobile", async ({
    page,
  }) => {
    const hosts = new Set<string>();
    page.on("request", (request) => {
      const url = new URL(request.url());
      if (url.protocol.startsWith("http")) hosts.add(url.hostname);
    });

    await page.goto("/");
    await page.waitForLoadState("networkidle");

    await expect(
      page
        .getByText(
          "Taktyl to sklep demonstracyjny. Nie realizujemy zamówień i nie pobieramy płatności.",
        )
        .first(),
    ).toBeVisible();

    const banner = page.getByRole("region", { name: "Zgody na pliki cookies" });
    await expect(banner).toBeVisible();
    const acceptAll = banner.getByRole("button", { name: "Akceptuję wszystkie" });
    const necessaryOnly = banner.getByRole("button", { name: "Tylko niezbędne" });
    await expect(acceptAll).toBeVisible();
    await expect(necessaryOnly).toBeVisible();
    // Rownorzedne: ten sam rozmiar, ten sam wariant wizualny (tlo, kolor, ramka, waga pisma).
    const look = (locator: typeof acceptAll) =>
      locator.evaluate((el) => {
        const s = getComputedStyle(el);
        const r = el.getBoundingClientRect();
        return {
          width: Math.round(r.width),
          height: Math.round(r.height),
          fontSize: s.fontSize,
          fontWeight: s.fontWeight,
          background: s.backgroundColor,
          color: s.color,
          border: s.border,
        };
      });
    const [a, b] = await Promise.all([look(acceptAll), look(necessaryOnly)]);
    expect(a.height).toBe(b.height);
    expect(Math.abs(a.width - b.width)).toBeLessThanOrEqual(2);
    expect({ ...a, width: 0 }).toEqual({ ...b, width: 0 });

    // Przed zgoda: tylko domyslna odmowa zgody w warstwie danych, zadnych zdarzen handlowych.
    const events = await liveDataLayer(page);
    expect(names(events)[0]).toBe("gtag_consent_default");
    const consentDefault = (events[0]?.args as unknown[])[2] as Record<string, string>;
    for (const key of ["ad_storage", "ad_user_data", "ad_personalization", "analytics_storage"]) {
      expect(consentDefault[key], key).toBe("denied");
    }
    expect(names(events).filter((n) => !n.startsWith("gtag_consent"))).toEqual([]);

    // Zadnego narzedzia: ani zadan do obcych domen, ani menedzera tagow w stronie.
    expect(
      [...hosts].filter((h) => h !== "taktyl.localhost" && h !== "api.taktyl.localhost"),
    ).toEqual([]);
    expect(await page.evaluate(() => "google_tag_manager" in window)).toBe(false);
    expect(
      await page
        .locator('script[src*="googletagmanager"], script[src*="google-analytics"]')
        .count(),
    ).toBe(0);
  });

  test("S24 (TAKTYL-84, LCP): baner jest w HTML z serwera, a po zapisanej decyzji chowa go skrypt w <head> jeszcze przed hydracją", async ({
    page,
  }) => {
    // Surowy HTML (bez JS): baner z przyciskami i stan domyslny, nie dopiero po hydracji. Pobranie z przegladarki
    // (host taktyl.localhost rozwiazuje tylko Chromium, nie klient `request`).
    await page.goto("/");
    const html = await page.evaluate(async () => (await fetch("/klawiatury")).text());
    expect(html).toContain('aria-label="Zgody na pliki cookies"');
    expect(html).toContain("Akceptuję wszystkie");

    // Zapisana decyzja: znacznik na <html> pojawia sie w skrypcie <head>, a baner nie jest widoczny od pierwszej ramki.
    await page.addInitScript(() => {
      localStorage.setItem(
        "taktyl.consent.v1",
        JSON.stringify({ v: 1, at: new Date().toISOString(), analytics: false, marketing: false }),
      );
    });
    await page.route("**/_next/static/**/*.js", (route) => route.abort());
    await page.goto("/klawiatury");
    await expect(page.locator("html")).toHaveAttribute("data-zgody-zapisane", "");
    await expect(page.getByRole("region", { name: "Zgody na pliki cookies" })).toBeHidden();
  });

  test("S24: decyzja w banerze jest zapamiętana i przekazana w trybie zgody", async ({ page }) => {
    await page.goto("/");
    const banner = page.getByRole("region", { name: "Zgody na pliki cookies" });
    await banner.getByRole("button", { name: "Akceptuję wszystkie" }).click();
    await expect(banner).toBeHidden();

    const events = await liveDataLayer(page);
    const update = events.find((e) => e.event === "gtag_consent_update");
    expect(update, "aktualizacja zgody po decyzji").toBeTruthy();
    expect(((update?.args as unknown[])[2] as Record<string, string>).analytics_storage).toBe(
      "granted",
    );

    await page.reload();
    await expect(page.getByRole("region", { name: "Zgody na pliki cookies" })).toBeHidden();
  });
});
