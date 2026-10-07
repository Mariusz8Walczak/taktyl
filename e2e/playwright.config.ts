// I-010 (TAKTYL-44): konfiguracja Playwright. Testy chodza w kontenerze `e2e` przeciw pelnemu stosowi compose.
// Hosty sklepu, backpanelu i API to te same adresy co dla czlowieka (taktyl.localhost, admin.taktyl.localhost,
// api.taktyl.localhost, port 80), a Chromium mapuje je na usluge `proxy:8080` (--host-resolver-rules): adresy w
// zbudowanym sklepie (PUBLIC_API_URL) i CORS zostaja bez zmian, a test nie zalezy od DNS ani od portu na hoscie.
import { defineConfig, devices } from "@playwright/test";

const proxy = process.env.E2E_PROXY ?? "proxy:8080";
const hosts = (
  process.env.E2E_HOSTS ?? "taktyl.localhost,admin.taktyl.localhost,api.taktyl.localhost"
).split(",");
export const SITE_URL = process.env.E2E_SITE_URL ?? "http://taktyl.localhost";
export const ADMIN_URL = process.env.E2E_ADMIN_URL ?? "http://admin.taktyl.localhost";

const launchOptions = {
  args: [`--host-resolver-rules=${hosts.map((h) => `MAP ${h} ${proxy}`).join(",")}`],
};

export default defineConfig({
  testDir: "./tests",
  outputDir: "./test-results",
  // Kazdy test ma wlasny kontekst przegladarki (czysty localStorage); testy nie zalezą od kolejnosci.
  fullyParallel: true,
  forbidOnly: true,
  retries: Number(process.env.E2E_RETRIES ?? 1),
  workers: Number(process.env.E2E_WORKERS ?? 3),
  timeout: 45_000,
  expect: { timeout: 10_000 },
  reporter: [
    ["list"],
    ["html", { outputFolder: "playwright-report", open: "never" }],
    ["junit", { outputFile: "test-results/junit.xml" }],
  ],
  use: {
    baseURL: SITE_URL,
    locale: "pl-PL",
    timezoneId: "Europe/Warsaw",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    launchOptions,
  },
  projects: [
    // TAKTYL-54 (S25-S36): jedno logowanie na przebieg (limity prob logowania), stan sesji w .auth/ (poza repo).
    { name: "setup", testMatch: /auth\.setup\.ts/ },
    {
      name: "desktop",
      testIgnore: [/auth\.setup\.ts/, /[\/]backpanel[\/]/],
      use: { ...devices["Desktop Chrome"], viewport: { width: 1280, height: 800 } },
    },
    {
      name: "mobile",
      grep: /@mobile/,
      testIgnore: [/auth\.setup\.ts/, /[\/]backpanel[\/]/],
      use: {
        ...devices["Pixel 7"],
        viewport: { width: 360, height: Number(process.env.E2E_MOBILE_HEIGHT ?? 740) },
        launchOptions,
      },
    },
    // Scenariusze backpanelu i propagacji zmieniaja dane wspolne ze sklepem (cena Wrobla, stan Jerzyka), wiec startuja
    // dopiero po zakonczeniu S1-S24; dane wracaja do seedu przy kolejnym przebiegu (e2e-reset) albo `make reset`.
    {
      name: "backpanel",
      testMatch: /[\/]backpanel[\/].*\.spec\.ts$/,
      dependencies: ["setup", "desktop", "mobile"],
      use: { ...devices["Desktop Chrome"], viewport: { width: 1280, height: 800 } },
    },
  ],
});
