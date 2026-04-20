import { test, expect } from "@playwright/test";

/**
 * Smoke test de seguridad: valida que los headers críticos configurados en
 * next.config.ts estén efectivamente presentes en producción.
 * Falla si se regresiona la config (ej. alguien borra el CSP).
 */

test.describe("Security headers", () => {
  test("la home retorna headers de seguridad", async ({ request }) => {
    const res = await request.get("/");
    const headers = res.headers();

    // Headers que DEBEN estar siempre
    expect(headers["x-frame-options"]).toBe("DENY");
    expect(headers["x-content-type-options"]).toBe("nosniff");
    expect(headers["referrer-policy"]).toBe("strict-origin-when-cross-origin");

    // Content-Security-Policy debe existir y ser restrictivo
    expect(headers["content-security-policy"]).toBeDefined();
    expect(headers["content-security-policy"]).toContain("default-src 'self'");
    expect(headers["content-security-policy"]).toContain("frame-src 'none'");
    expect(headers["content-security-policy"]).toContain("object-src 'none'");
  });

  test("un endpoint de API protegido no filtra datos sin auth", async ({ request }) => {
    const res = await request.get("/api/auth/me");
    expect(res.status()).toBe(401);

    // No debe haber info sensible en el body
    const body = await res.text();
    expect(body).not.toContain("service_role");
    expect(body).not.toContain("JWT_SECRET");
  });
});
