"use client";

import { useState, useCallback, useRef } from "react";

export interface WorkingHour {
  id: string;
  professional_id: string;
  day_of_week: number; // 0=Dom, 1=Lun, ..., 6=Sáb
  start_time: string;  // "HH:MM"
  end_time: string;    // "HH:MM"
}

export interface ScheduleConfig {
  id: string;
  professional_id: string;
  working_days: number[];
  slot_duration: number;
  lunch_break_start: string | null;
  lunch_break_end: string | null;
  vacation_mode: boolean;
  vacation_until: string | null;
  updated_at: string;
}

interface ScheduleConfigState {
  config: ScheduleConfig | null;
  workingHours: WorkingHour[];
  loading: boolean;
}

export function useScheduleConfig() {
  const [state, setState] = useState<ScheduleConfigState>({
    config: null,
    workingHours: [],
    loading: false,
  });

  const fetchedRef = useRef(false);

  const fetchScheduleConfig = useCallback(async () => {
    // Solo fetchear una vez
    if (fetchedRef.current) return;

    setState((s) => ({ ...s, loading: true }));
    try {
      const res = await fetch("/api/schedule/config");
      if (!res.ok) throw new Error("Error al obtener configuración");
      const data = await res.json();
      setState({
        config: data.config,
        workingHours: data.workingHours ?? [],
        loading: false,
      });
      fetchedRef.current = true;
    } catch (error) {
      console.error("Error al cargar configuración de agenda:", error);
      setState((s) => ({ ...s, loading: false }));
    }
  }, []);

  return {
    config: state.config,
    workingHours: state.workingHours,
    configLoading: state.loading,
    fetchScheduleConfig,
  };
}
