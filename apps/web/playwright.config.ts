import { defineConfig, devices } from "@playwright/test";

/**
 * Config de Playwright para tests E2E de los 5 flujos críticos.
 * Uso:
 *   pnpm test:e2e          # corre todo headless
 *   pnpm test:e2e:ui       # modo UI interactivo
 *   pnpm test:e2e --headed # ver el navegador corriendo
 */
export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? "github" : "list",
  timeout: 30_000,

  use: {
    // URL base apuntando al dev server o a staging
    baseURL: process.env.E2E_BASE_URL || "http://localhost:3000",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
    // Locale argentino (dates y números)
    locale: "es-AR",
    timezoneId: "America/Argentina/Buenos_Aires",
  },

  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
    // Otros browsers se pueden agregar cuando haya tiempo
  ],

  // Levantar el dev server automáticamente si no hay E2E_BASE_URL custom.
  // En CI conviene levantar el server antes separado (pnpm start) y solo apuntar.
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : {
        command: "pnpm dev",
        url: "http://localhost:3000",
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
      },
});
