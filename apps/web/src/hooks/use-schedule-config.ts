"use client";

import { useState, useCallback, useRef, useEffect } from "react";

export interface WorkingHour {
  id: string;
  professional_id: string;
  day_of_week: number; // 0=Dom, 1=Lun, ..., 6=Sáb
  start_time: string;  // "HH:MM"
  end_time: string;    // "HH:MM"
  modality?: "presencial" | "virtual" | "both";
}

export interface ScheduleConfig {
  id: string;
  professional_id: string;
  working_days: number[];
  slot_duration: number;
  lunch_break_start: string | null;
  lunch_break_end: string | null;
  vacation_mode: boolean;
  vacation_from: string | null;
  vacation_until: string | null;
  updated_at: string;
}

interface ScheduleConfigState {
  config: ScheduleConfig | null;
  workingHours: WorkingHour[];
  loading: boolean;
}

// ─── Cache global compartido entre todas las instancias del hook ───
let globalCache: { config: ScheduleConfig | null; workingHours: WorkingHour[] } | null = null;

// Nombre del evento custom para notificar a todas las instancias del hook
const SCHEDULE_CONFIG_INVALIDATED_EVENT = "bookme:schedule-config-invalidated";

/** Llamar después de guardar configuración para que todos los consumers refresquen.
 *  Usa un CustomEvent del DOM para forzar re-fetch en TODOS los componentes montados
 *  que usen useScheduleConfig(), sin importar si están re-renderizando o no. */
export function invalidateScheduleConfigGlobal() {
  globalCache = null;
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(SCHEDULE_CONFIG_INVALIDATED_EVENT));
  }
}

export function useScheduleConfig() {
  const [state, setState] = useState<ScheduleConfigState>({
    config: globalCache?.config ?? null,
    workingHours: globalCache?.workingHours ?? [],
    loading: false,
  });

  const fetchingRef = useRef(false);

  const doFetch = useCallback(async () => {
    if (fetchingRef.current) return;
    fetchingRef.current = true;
    setState((s) => ({ ...s, loading: true }));
    try {
      const res = await fetch("/api/schedule/config");
      if (!res.ok) throw new Error("Error al obtener configuración");
      const data = await res.json();
      const newState = {
        config: data.config as ScheduleConfig | null,
        workingHours: (data.workingHours ?? []) as WorkingHour[],
      };
      // Actualizar cache global
      globalCache = newState;
      setState({ ...newState, loading: false });
    } catch (error) {
      console.error("Error al cargar configuración de agenda:", error);
      setState((s) => ({ ...s, loading: false }));
    } finally {
      fetchingRef.current = false;
    }
  }, []);

  const fetchScheduleConfig = useCallback(async () => {
    // Si ya tenemos cache, usar eso
    if (globalCache) {
      setState((s) => ({
        ...s,
        config: globalCache!.config,
        workingHours: globalCache!.workingHours,
      }));
      return;
    }
    await doFetch();
  }, [doFetch]);

  // Escuchar el evento de invalidación para refrescar automáticamente
  // cuando la configuración se guarda desde otra página (ej: /configuracion)
  useEffect(() => {
    const handleInvalidation = () => {
      // Forzar re-fetch desde la API
      void doFetch();
    };

    window.addEventListener(SCHEDULE_CONFIG_INVALIDATED_EVENT, handleInvalidation);
    return () => {
      window.removeEventListener(SCHEDULE_CONFIG_INVALIDATED_EVENT, handleInvalidation);
    };
  }, [doFetch]);

  return {
    config: state.config,
    workingHours: state.workingHours,
    configLoading: state.loading,
    fetchScheduleConfig,
    refetchScheduleConfig: doFetch,
  };
}
