"use client";

// Captura errores que bubblean hasta la raíz del App Router.
// Sentry los registra automáticamente; el usuario ve un fallback mínimo.

import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html lang="es">
      <body style={{ fontFamily: "system-ui, sans-serif", padding: "2rem", maxWidth: "560px", margin: "4rem auto", lineHeight: 1.6 }}>
        <h1 style={{ fontSize: "1.5rem", marginBottom: "0.5rem" }}>Algo salió mal</h1>
        <p style={{ color: "#666", marginBottom: "1.5rem" }}>
          Ocurrió un error inesperado. Ya lo registramos y lo vamos a revisar.
        </p>
        <button
          onClick={reset}
          style={{
            padding: "0.5rem 1rem",
            background: "#3b82f6",
            color: "white",
            border: "none",
            borderRadius: "6px",
            cursor: "pointer",
          }}
        >
          Reintentar
        </button>
      </body>
    </html>
  );
}
