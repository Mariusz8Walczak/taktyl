// TAKTYL-54 (B-001, B-002, B-S1): jedno logowanie na przebieg e2e. Owner loguje sie przez formularz (to jest tez test
// logowania), editor i viewer to konta tworzone przez API owner. Limit prob (5 na konto, 20 na IP w 15 min) liczy
// tylko BLEDNE logowania, wiec setup nie wyczerpuje limitu; stan sesji idzie do .auth/ (poza repo, .gitignore).
import { expect, test as setup } from "@playwright/test";
import { ADMIN_URL, AdminApi, authFile, credentials, loginViaApi } from "./../helpers/admin";

setup.describe.configure({ mode: "serial" });

setup("owner: logowanie przez formularz", async ({ page }) => {
  const { email, password } = credentials("owner");
  await page.goto(`${ADMIN_URL}/logowanie`);
  await expect(
    page.getByRole("heading", { name: "Zaloguj się do backpanelu", level: 1 }),
  ).toBeVisible();
  await page.getByRole("textbox", { name: "E-mail" }).fill(email);
  await page.getByLabel("Hasło").fill(password);
  await page.getByRole("button", { name: "Zaloguj się" }).click();
  await expect(page).toHaveURL(`${ADMIN_URL}/`);
  await page.context().storageState({ path: authFile("owner") });
});

for (const role of ["editor", "viewer"] as const) {
  setup(`${role}: konto utworzone przez owner i zalogowane`, async () => {
    const owner = await AdminApi.as("owner");
    const { email, password } = credentials(role);
    const created = await owner.post("/v1/admin/users", {
      email,
      role,
      initial_password: password,
    });
    // 409 / 422 = konto z poprzedniego przebiegu (konta przezywaja db:reset-demo).
    expect([201, 200, 409, 422]).toContain(created.status());
    await owner.dispose();

    await loginViaApi(role);
  });
}
