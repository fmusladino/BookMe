import { test, expect } from "@playwright/test";

const email = process.env.E2E_PROFESSIONAL_EMAIL;
const password = process.env.E2E_PROFESSIONAL_PASSWORD;

test.describe("Login profesional", () => {
  test("la página /login carga", async ({ page }) => {
    await page.goto("/login");
    // Busca cualquier input de email (el selector exacto depende del form)
    await expect(page.locator('input[type="email"]')).toBeVisible();
  });

  test("rechaza credenciales inválidas", async ({ page }) => {
    await page.goto("/login");
    await page.locator('input[type="email"]').fill("nope@example.com");
    await page.locator('input[type="password"]').fill("wrongpassword");
    await page.locator('button[type="submit"]').click();
    // Debe quedarse en /login (no redirige al dashboard)
    await page.waitForTimeout(2000);
    expect(page.url()).toContain("/login");
  });

  test.skip(!email || !password, "requiere E2E_PROFESSIONAL_EMAIL/PASSWORD");
  test("un profesional existente puede loguearse y entra al dashboard", async ({ page }) => {
    if (!email || !password) return; // guard redundante por TS
    await page.goto("/login");
    await page.locator('input[type="email"]').fill(email);
    await page.locator('input[type="password"]').fill(password);
    await page.locator('button[type="submit"]').click();
    // Esperar que redirija al dashboard (o a /onboarding si es primera vez)
    await page.waitForURL(/\/(dashboard|onboarding)/, { timeout: 10_000 });
    expect(page.url()).toMatch(/\/(dashboard|onboarding)/);
  });
});
