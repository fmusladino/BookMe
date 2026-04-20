// Next.js 15 instrumentation hook — carga Sentry en el runtime correcto (node vs edge).
// Se ejecuta una vez al boot del servidor.

export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("../sentry.server.config");
  }
  if (process.env.NEXT_RUNTIME === "edge") {
    await import("../sentry.edge.config");
  }
}

// Hook de Next.js para capturar errores que ocurren durante el render del request
export async function onRequestError(
  err: unknown,
  request: { path: string; method: string; headers: Record<string, string> },
  context: { routerKind: "App Router" | "Pages Router"; routePath: string; routeType: string },
) {
  const Sentry = await import("@sentry/nextjs");
  Sentry.captureRequestError(err, request, context);
}
