// TAKTYL-66 (docs/12 par. 3, docs/06 par. 6): audyt systemu designu na zywych stronach P0 sklepu, build produkcyjny w Dockerze.
// Limity: <= 7 rozmiarow czcionki, 1 rodzina, 1 wariant przycisku glownego, promienie tylko 10px/999px (0px dla ikon),
// 0 malych celow dotykowych (< 44 px), 0 zdublowanych id. Uruchamiane na 1280 px (desktop) i 360 px (@mobile).
import { test } from "../helpers/fixtures";
import { assertDesignAudit, runDesignAudit } from "../helpers/design-audit";

const PAGES: [string, string][] = [
  ["glowna", "/"],
  ["listing klawiatur", "/klawiatury"],
  ["listing myszek", "/myszki"],
  ["listing podkladek", "/podkladki"],
  ["karta produktu", "/klawiatury/kwarc-60"],
  ["kreator setu", "/zbuduj-set"],
  ["koszyk", "/koszyk"],
  ["zamowienie", "/zamowienie"],
  ["porownanie", "/porownaj"],
  ["ulubione", "/ulubione"],
  ["szukaj", "/szukaj?q=klawiatura"],
  ["poradnik", "/poradnik"],
  ["faq", "/faq"],
  ["kontakt", "/kontakt"],
  ["regulamin", "/regulamin"],
  ["dostawa i platnosci", "/dostawa-i-platnosci"],
  ["404", "/nie-ma-takiej-strony"],
];

for (const [name, path] of PAGES) {
  test(`Audyt designu: ${name} (${path}) @mobile`, async ({ page }) => {
    await page.goto(path);
    await page.waitForLoadState("networkidle");
    const audit = await runDesignAudit(page);
    test.info().annotations.push({ type: "audyt", description: JSON.stringify(audit) });
    assertDesignAudit(audit);
  });
}
