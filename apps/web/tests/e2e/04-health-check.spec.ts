import { test, expect } from "@playwright/test";

/**
 * Smoke tests de endpoints críticos de la API.
 * Verifican que las rutas respondan con status esperado ante payloads obvios.
 * No validan lógica de negocio (eso es Vitest unit tests).
 */

test.describe("API health check", () => {
  test("/api/auth/me sin sesión responde 401", async ({ request }) => {
    const res = await request.get("/api/auth/me");
    expect(res.status()).toBe(401);
  });

  test("/api/appointments sin sesión responde 401", async ({ request }) => {
    const res = await request.get("/api/appointments");
    expect(res.status()).toBe(401);
  });

  test("/api/directory/filters responde con JSON válido", async ({ request }) => {
    const res = await request.get("/api/directory/filters");
    expect(res.status()).toBeLessThan(500);
    if (res.status() === 200) {
      const body = await res.json();
      expect(body).toBeTruthy();
    }
  });

  test("/api/book rechaza GET (solo POST)", async ({ request }) => {
    const res = await request.get("/api/book");
    expect([404, 405]).toContain(res.status());
  });

  test("/api/professionals/search responde a query válida", async ({ request }) => {
    const res = await request.get("/api/professionals/search?q=test");
    expect(res.status()).toBeLessThan(500);
  });
});
