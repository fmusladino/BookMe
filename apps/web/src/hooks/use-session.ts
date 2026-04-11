"use client";

import { useState, useEffect, useCallback, createContext, useContext, useRef } from "react";

export interface SubscriptionInfo {
  plan: string;
  status: string;
  trialEndsAt: string | null;
  daysUntilTrialEnd: number | null;
}

export interface SessionUser {
  id: string;
  email: string;
  role: "professional" | "patient" | "admin" | "superadmin" | "marketing" | "canchas";
  full_name: string;
  avatar_url: string | null;
  professional: {
    line: "healthcare" | "business";
    specialty: string;
    plan: string;
    status: string;
    slug: string;
  } | null;
  /** Datos del dueño de canchas (solo si role === 'canchas') */
  court_owner: {
    business_name: string;
    slug: string;
    city: string;
    plan: string;
    status: string;
  } | null;
  /** Datos de suscripción incluidos desde /api/auth/me (evita fetch separado) */
  subscription: SubscriptionInfo | null;
  /** Es dueño de una clínica */
  is_clinic_owner: boolean;
  /** Es admin de una clínica */
  is_clinic_admin: boolean;
  /** ID de la clínica que posee (si es owner) */
  clinic_id: string | null;
}

interface SessionState {
  user: SessionUser | null;
  loading: boolean;
  error: string | null;
  /** Fuerza un refetch de la sesión (usar después de login/logout) */
  refresh: () => void;
  /** Limpia la sesión localmente (usar en logout antes de redirigir) */
  clear: () => void;
}

const SessionContext = createContext<SessionState>({
  user: null,
  loading: true,
  error: null,
  refresh: () => {},
  clear: () => {},
});

export function useSession() {
  return useContext(SessionContext);
}

export { SessionContext };

// Cache en memoria a nivel de módulo — sobrevive entre re-renders y navegaciones
// client-side. Se invalida solo con refresh() o tras SESSION_CACHE_TTL.
const SESSION_CACHE_TTL = 5 * 60 * 1000; // 5 minutos
let cachedUser: SessionUser | null = null;
let cachedAt = 0;

/**
 * Hook interno para cargar la sesión desde /api/auth/me.
 * Se usa en el SessionProvider.
 *
 * Optimización: cachea el resultado en memoria para que las navegaciones
 * client-side no re-fetchen la sesión (el middleware ya valida en cada request).
 */
export function useSessionLoader(): SessionState {
  // Inicializar con cache si es válido → evita flash de loading
  const [user, setUser] = useState<SessionUser | null>(() => {
    if (cachedUser && Date.now() - cachedAt < SESSION_CACHE_TTL) {
      return cachedUser;
    }
    return null;
  });
  const [loading, setLoading] = useState(() => {
    // Si hay cache válido, no mostrar loading
    return !(cachedUser && Date.now() - cachedAt < SESSION_CACHE_TTL);
  });
  const [error, setError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const fetchInProgress = useRef(false);

  const refresh = useCallback(() => {
    // Invalidar cache al forzar refresh
    cachedUser = null;
    cachedAt = 0;
    setRefreshKey((k) => k + 1);
  }, []);

  const clear = useCallback(() => {
    cachedUser = null;
    cachedAt = 0;
    setUser(null);
    setLoading(false);
    setError(null);
  }, []);

  useEffect(() => {
    let cancelled = false;

    // Si hay cache válido y no es un refresh forzado, usar cache
    if (cachedUser && Date.now() - cachedAt < SESSION_CACHE_TTL && refreshKey === 0) {
      setUser(cachedUser);
      setLoading(false);
      return;
    }

    // Evitar fetches duplicados concurrentes
    if (fetchInProgress.current) return;

    async function fetchSession() {
      fetchInProgress.current = true;
      setLoading(true);
      try {
        const res = await fetch("/api/auth/me");

        if (!res.ok) {
          if (res.status === 401) {
            if (!cancelled) {
              cachedUser = null;
              cachedAt = 0;
              setUser(null);
              setLoading(false);
              setError(null);
            }
            return;
          }
          throw new Error("Error al obtener sesión");
        }

        const data = await res.json();
        if (!cancelled) {
          // Actualizar cache
          cachedUser = data.user;
          cachedAt = Date.now();
          setUser(data.user);
          setLoading(false);
          setError(null);
        }
      } catch (err) {
        if (!cancelled) {
          setUser(null);
          setLoading(false);
          setError(err instanceof Error ? err.message : "Error desconocido");
        }
      } finally {
        fetchInProgress.current = false;
      }
    }

    fetchSession();
    return () => { cancelled = true; };
  }, [refreshKey]);

  return { user, loading, error, refresh, clear };
}
