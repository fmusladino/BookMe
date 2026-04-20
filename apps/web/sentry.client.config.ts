// Sentry client-side config. Se carga en el browser del usuario.
// DSN viene de NEXT_PUBLIC_SENTRY_DSN — si no está, Sentry queda dormido (no rompe nada).

import * as Sentry from "@sentry/nextjs";

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;

if (dsn) {
  Sentry.init({
    dsn,
    environment: process.env.NEXT_PUBLIC_SENTRY_ENV || process.env.NODE_ENV,

    // Sampling: 10% en prod, 100% en dev. Ajustar cuando tengamos volumen.
    tracesSampleRate: process.env.NODE_ENV === "production" ? 0.1 : 1.0,

    // Session replay — útil para debuggear errores visuales, pero caro. Solo en errores.
    replaysOnErrorSampleRate: 1.0,
    replaysSessionSampleRate: 0,

    // No enviar PII del usuario por default (GDPR/Ley 25.326).
    // Si lo necesitamos para debugging puntual, activar con scope.
    sendDefaultPii: false,

    // Ignorar errores ruidosos típicos de extensiones del browser
    ignoreErrors: [
      "ResizeObserver loop limit exceeded",
      "Non-Error promise rejection captured",
      "Failed to fetch", // típico cuando el usuario pierde conexión
    ],
  });
}
