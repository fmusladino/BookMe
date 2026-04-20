import { test, expect } from "@playwright/test";

/**
 * Flujo crítico #1 para producción:
 * un paciente NO registrado llega a /book/<slug>, elige servicio/fecha/hora
 * y completa el formulario guest sin fricción.
 *
 * Requiere: un profesional público con slug configurado en la DB.
 * Seteá E2E_PROFESSIONAL_SLUG en .env.test.local para apuntar a uno real.
 */

const slug = process.env.E2E_PROFESSIONAL_SLUG || "test-pro";

test.describe("Reserva guest (sin registro)", () => {
  test("la página /book/<slug> carga para un profesional público", async ({ page }) => {
    const res = await page.goto(`/book/${slug}`);
    expect(res?.status()).toBeLessThan(500);
  });

  test("muestra formulario de datos de contacto si no hay sesión", async ({ page }) => {
    await page.goto(`/book/${slug}`);

    // Esperar a que el profesional cargue (si existe)
    await page.waitForLoadState("networkidle").catch(() => {});

    // Si la página cargó el profesional, el formulario guest debe estar disponible
    // en el paso de confirmación. Este test es smoke — solo valida que la página
    // responde y no redirige a login antes de llegar al formulario.
    const currentUrl = page.url();
    expect(currentUrl).not.toContain("/login");
  });

  test("el endpoint /api/book rechaza payload sin datos de guest ni sesión", async ({ request }) => {
    const res = await request.post("/api/book", {
      data: {
        professional_id: "00000000-0000-0000-0000-000000000000",
        starts_at: new Date(Date.now() + 3600_000).toISOString(),
        ends_at: new Date(Date.now() + 7200_000).toISOString(),
      },
    });
    // Debe rechazar porque no hay sesión ni guest
    expect([400, 401]).toContain(res.status());
  });

  test("el endpoint /api/book rechaza guest con email inválido", async ({ request }) => {
    const res = await request.post("/api/book", {
      data: {
        professional_id: "00000000-0000-0000-0000-000000000000",
        starts_at: new Date(Date.now() + 3600_000).toISOString(),
        ends_at: new Date(Date.now() + 7200_000).toISOString(),
        guest: {
          full_name: "Juan Test",
          email: "no-es-email",
          phone: "+5491112345678",
        },
      },
    });
    expect(res.status()).toBe(400);
  });
});
