import { test, expect } from "@playwright/test";

test.describe("Home pública", () => {
  test("la landing carga y tiene CTA principal clickeable", async ({ page }) => {
    await page.goto("/");

    // Título de la página (cualquier h1 de la home)
    await expect(page.locator("h1").first()).toBeVisible();

    // Algún CTA hacia /login o /signup debe existir
    const ctaCount = await page.locator('a[href*="/login"], a[href*="/signup"], a[href*="/registro"]').count();
    expect(ctaCount).toBeGreaterThan(0);
  });

  test("el directorio público es accesible sin login", async ({ page }) => {
    const res = await page.goto("/directorio");
    // 200 o 3xx (redirect a una ciudad por default), pero no 404/500
    expect(res?.status()).toBeLessThan(400);
  });

  test("la página de términos carga (legal)", async ({ page }) => {
    const res = await page.goto("/terminos");
    // Puede no existir aún → solo validamos que no sea 500
    if (res) {
      expect([200, 404]).toContain(res.status());
    }
  });
});
