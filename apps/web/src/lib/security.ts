/**
 * Utilidades de seguridad compartidas para BookMe
 */
import { type NextRequest, NextResponse } from "next/server";
import { createHmac, timingSafeEqual } from "crypto";

// ─── Autenticación de Cron Jobs ─────────────────────────────────────────
/**
 * Valida autenticación de endpoints cron con timing-safe comparison.
 * Uso: const authError = verifyCronAuth(request); if (authError) return authError;
 */
export function verifyCronAuth(request: NextRequest): NextResponse | null {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env["CRON_SECRET"];

  if (!cronSecret || cronSecret.length < 32) {
    console.error("[CRON AUTH] CRON_SECRET no configurado o demasiado corto");
    return NextResponse.json({ error: "Server misconfigured" }, { status: 500 });
  }

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const token = authHeader.slice(7); // quitar "Bearer "

  // Timing-safe comparison para prevenir timing attacks
  try {
    const expected = Buffer.from(cronSecret, "utf-8");
    const received = Buffer.from(token, "utf-8");

    if (expected.length !== received.length || !timingSafeEqual(expected, received)) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }
  } catch {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  return null; // Auth OK
}

// ─── Logger seguro (no expone PII en producción) ────────────────────────
const IS_PRODUCTION = process.env.NODE_ENV === "production";

/**
 * Logger seguro que redacta información sensible en producción.
 * En desarrollo muestra todo, en producción oculta UUIDs y datos de pacientes.
 */
export const safeLog = {
  info(message: string, data?: Record<string, unknown>) {
    if (IS_PRODUCTION) {
      console.log(message, data ? redactSensitive(data) : "");
    } else {
      console.log(message, data ?? "");
    }
  },
  error(message: string, error?: unknown) {
    if (IS_PRODUCTION) {
      // En producción solo mostrar el mensaje de error, no el stack completo
      const errorMsg = error instanceof Error ? error.message : String(error ?? "");
      console.error(message, errorMsg);
    } else {
      console.error(message, error);
    }
  },
  warn(message: string, data?: Record<string, unknown>) {
    if (IS_PRODUCTION) {
      console.warn(message, data ? redactSensitive(data) : "");
    } else {
      console.warn(message, data ?? "");
    }
  },
};

/** Redacta UUIDs y datos sensibles en un objeto */
function redactSensitive(data: Record<string, unknown>): Record<string, unknown> {
  const sensitiveKeys = ["patient_id", "patientId", "user_id", "userId", "accessed_by", "professional_id", "ip_address", "email", "phone", "dni", "insurance_number"];
  const redacted: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(data)) {
    if (sensitiveKeys.includes(key) && typeof value === "string") {
      // Mostrar solo primeros 4 chars del UUID o dato
      redacted[key] = value.slice(0, 4) + "…[REDACTED]";
    } else {
      redacted[key] = value;
    }
  }
  return redacted;
}

// ─── Rate limiting simple en memoria ────────────────────────────────────
const rateLimitStore = new Map<string, { count: number; resetAt: number }>();

/**
 * Rate limiter simple basado en IP.
 * @param identifier - Clave única (generalmente IP del cliente)
 * @param maxRequests - Máximo de requests en la ventana
 * @param windowMs - Ventana en milisegundos (default: 60 segundos)
 * @returns null si OK, NextResponse 429 si se excedió el límite
 */
export function checkRateLimit(
  identifier: string,
  maxRequests: number = 30,
  windowMs: number = 60_000
): NextResponse | null {
  const now = Date.now();
  const entry = rateLimitStore.get(identifier);

  // Limpiar entradas viejas periódicamente (cada 1000 checks)
  if (Math.random() < 0.001) {
    for (const [key, val] of rateLimitStore) {
      if (val.resetAt < now) rateLimitStore.delete(key);
    }
  }

  if (!entry || entry.resetAt < now) {
    rateLimitStore.set(identifier, { count: 1, resetAt: now + windowMs });
    return null;
  }

  entry.count++;

  if (entry.count > maxRequests) {
    return NextResponse.json(
      { error: "Demasiadas solicitudes. Intentá de nuevo en un momento." },
      {
        status: 429,
        headers: {
          "Retry-After": String(Math.ceil((entry.resetAt - now) / 1000)),
        },
      }
    );
  }

  return null;
}

/** Extrae la IP del cliente del request */
export function getClientIp(request: NextRequest): string {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "unknown"
  );
}
