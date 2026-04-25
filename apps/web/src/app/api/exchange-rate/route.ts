import { NextResponse } from "next/server";

// Cache server-side de 30 minutos (1800s). Evita pegarle a dolarapi en cada request.
export const revalidate = 1800;

interface DolarApiResponse {
  moneda: string;
  casa: string;
  nombre: string;
  compra: number;
  venta: number;
  fechaActualizacion: string;
}

export interface ExchangeRatePayload {
  buy: number;
  sell: number;
  name: string;
  source: string;
  updatedAt: string;
  fetchedAt: string;
}

// GET /api/exchange-rate
// Devuelve la cotización oficial USD→ARS desde dolarapi.com.
// El cache del upstream también es 30 min (next.revalidate), así que en el peor
// caso el usuario ve una cotización de hasta 30 min vieja.
export async function GET() {
  try {
    const res = await fetch("https://dolarapi.com/v1/dolares/oficial", {
      next: { revalidate: 1800 },
    });
    if (!res.ok) {
      throw new Error(`dolarapi HTTP ${res.status}`);
    }
    const data = (await res.json()) as DolarApiResponse;
    const payload: ExchangeRatePayload = {
      buy: data.compra,
      sell: data.venta,
      name: data.nombre,
      source: data.casa,
      updatedAt: data.fechaActualizacion,
      fetchedAt: new Date().toISOString(),
    };
    return NextResponse.json(payload, {
      headers: {
        // Permite al CDN/browser reutilizar la respuesta hasta 30 min
        "Cache-Control": "public, max-age=1800, s-maxage=1800, stale-while-revalidate=300",
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "unknown error";
    console.error("[exchange-rate] fetch failed:", message);
    return NextResponse.json(
      { error: message },
      { status: 503 }
    );
  }
}
