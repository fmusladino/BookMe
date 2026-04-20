// Hook de instrumentación del lado del cliente (Next.js 15).
// Se ejecuta una vez al hidratar el browser.

import "../sentry.client.config";

export const onRouterTransitionStart = (await import("@sentry/nextjs")).captureRouterTransitionStart;
