"use client";

import { useState, useEffect, createContext, useContext, useCallback } from "react";

// ─── Types ──────────────────────────────────────────────────────
export interface FeatureDefinition {
  id: string;
  key: string;
  label: string;
  description: string | null;
  category: string;
  sort_order: number;
}

export interface FeaturesData {
  features: FeatureDefinition[];
  matrix: Record<string, Record<string, Record<string, boolean>>>;
  prices: Record<string, Record<string, Record<string, number>>>;
  clinicPrices: Record<string, Record<string, number>>;
}

interface FeaturesState {
  data: FeaturesData | null;
  loading: boolean;
  error: string | null;
  /** Verifica si una feature está habilitada para un plan y línea */
  hasFeature: (key: string, plan: string, line: string) => boolean;
  /** Obtiene todas las features habilitadas para un plan y línea */
  getEnabledFeatures: (plan: string, line: string) => Record<string, boolean>;
  /** Obtiene el precio mensual de un plan para una línea */
  getPrice: (plan: string, line: string, cycle?: string) => number | null;
  /** Obtiene el precio de consultorio */
  getClinicPrice: (plan: string, cycle?: string) => number | null;
  /** Fuerza refetch */
  refresh: () => void;
}

// ─── Cache en memoria (evita refetch en navegaciones client-side) ────
const CACHE_TTL = 60 * 1000; // 1 minuto (sync con revalidate del API)
let cachedData: FeaturesData | null = null;
let cachedAt = 0;

// ─── Context ────────────────────────────────────────────────────
const FeaturesContext = createContext<FeaturesState>({
  data: null,
  loading: true,
  error: null,
  hasFeature: () => false,
  getEnabledFeatures: () => ({}),
  getPrice: () => null,
  getClinicPrice: () => null,
  refresh: () => {},
});

export function useFeatures() {
  return useContext(FeaturesContext);
}

export { FeaturesContext };

/**
 * Hook interno que carga features desde /api/features.
 * Se usa en el FeaturesProvider.
 */
export function useFeaturesLoader(): FeaturesState {
  const [data, setData] = useState<FeaturesData | null>(() => {
    if (cachedData && Date.now() - cachedAt < CACHE_TTL) return cachedData;
    return null;
  });
  const [loading, setLoading] = useState(() => {
    return !(cachedData && Date.now() - cachedAt < CACHE_TTL);
  });
  const [error, setError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const refresh = useCallback(() => {
    cachedData = null;
    cachedAt = 0;
    setRefreshKey((k) => k + 1);
  }, []);

  useEffect(() => {
    let cancelled = false;

    if (cachedData && Date.now() - cachedAt < CACHE_TTL && refreshKey === 0) {
      setData(cachedData);
      setLoading(false);
      return;
    }

    async function fetchFeatures() {
      setLoading(true);
      try {
        const res = await fetch("/api/features");
        if (!res.ok) throw new Error("Error al cargar features");
        const json = await res.json();
        if (!cancelled) {
          cachedData = json;
          cachedAt = Date.now();
          setData(json);
          setLoading(false);
          setError(null);
        }
      } catch (err) {
        if (!cancelled) {
          setLoading(false);
          setError(err instanceof Error ? err.message : "Error desconocido");
        }
      }
    }

    fetchFeatures();
    return () => { cancelled = true; };
  }, [refreshKey]);

  const hasFeature = useCallback(
    (key: string, plan: string, line: string): boolean => {
      if (!data?.matrix) return false;
      return data.matrix[line]?.[plan]?.[key] ?? false;
    },
    [data]
  );

  const getEnabledFeatures = useCallback(
    (plan: string, line: string): Record<string, boolean> => {
      if (!data?.matrix) return {};
      return { ...(data.matrix[line]?.[plan] ?? {}) };
    },
    [data]
  );

  const getPrice = useCallback(
    (plan: string, line: string, cycle = "monthly"): number | null => {
      if (!data?.prices) return null;
      return data.prices[line]?.[plan]?.[cycle] ?? null;
    },
    [data]
  );

  const getClinicPrice = useCallback(
    (plan: string, cycle = "monthly"): number | null => {
      if (!data?.clinicPrices) return null;
      return data.clinicPrices[plan]?.[cycle] ?? null;
    },
    [data]
  );

  return { data, loading, error, hasFeature, getEnabledFeatures, getPrice, getClinicPrice, refresh };
}
