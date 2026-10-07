// I-010 (TAKTYL-44): wspolny `test` dla scenariuszy. Na telefonie (360 px) baner zgod zajmuje ~1/3 ekranu i zaslania tresc,
// wiec czlowiek najpierw podejmuje decyzje; tak samo robi test (zapisuje decyzje "tylko niezbedne" jak baner).
// Scenariusze o pierwszej wizycie (S24) wylaczaja to przez test.use({ presetConsent: false }).
import { test as base, expect } from "@playwright/test";

export const test = base.extend<{ presetConsent: boolean }>({
  presetConsent: [async ({ isMobile }, use) => use(isMobile), { option: true }],
  page: async ({ page, presetConsent }, use) => {
    if (presetConsent) {
      await page.addInitScript(() => {
        try {
          if (!localStorage.getItem("taktyl.consent.v1")) {
            localStorage.setItem(
              "taktyl.consent.v1",
              JSON.stringify({
                v: 1,
                at: new Date().toISOString(),
                analytics: false,
                marketing: false,
              }),
            );
          }
        } catch {
          /* brak localStorage */
        }
      });
    }
    await use(page);
  },
});

export { expect };
