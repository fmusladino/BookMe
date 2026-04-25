"use client";

import { useEffect, useState } from "react";
import type { ExchangeRatePayload } from "@/app/api/exchange-rate/route";

// Refresh cada 30 min para matchear el cache server-side.
const REFRESH_MS = 30 * 60 * 1000;

interface UseExchangeRateResult {
  data: ExchangeRatePayload | null;
  loading: boolean;
  error: string | null;
}

// Hook singleton-ish: misma data compartida entre componentes vía estado local.
// No hace falta context porque la API está cacheada; cada montaje dispara
// una sola request que el Next cache devuelve instantáneo.
export function useExchangeRate(): UseExchangeRateResult {
  const [data, setData] = useState<ExchangeRatePayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let aborted = false;

    const fetchRate = async () => {
      try {
        const res = await fetch("/api/exchange-rate");
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = (await res.json()) as ExchangeRatePayload;
        if (!aborted) {
          setData(json);
          setError(null);
        }
      } catch (err) {
        if (!aborted) {
          const msg = err instanceof Error ? err.message : "Error de red";
          setError(msg);
        }
      } finally {
        if (!aborted) setLoading(false);
      }
    };

    fetchRate();
    const id = setInterval(fetchRate, REFRESH_MS);
    return () => {
      aborted = true;
      clearInterval(id);
    };
  }, []);

  return { data, loading, error };
}
