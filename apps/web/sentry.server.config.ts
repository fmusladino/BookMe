// Sentry server-side config. Captura errores en API routes y server components.

import * as Sentry from "@sentry/nextjs";

const dsn = process.env.SENTRY_DSN;

if (dsn) {
  Sentry.init({
    dsn,
    environment: process.env.SENTRY_ENV || process.env.NODE_ENV,

    tracesSampleRate: process.env.NODE_ENV === "production" ? 0.1 : 1.0,

    // No capturar info del usuario logueado por default
    sendDefaultPii: false,
  });
}
