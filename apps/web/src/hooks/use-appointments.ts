"use client";

import { useState, useCallback, useRef } from "react";
import type { AppointmentWithRelations } from "@/types";

interface UseAppointmentsOptions {
  professionalId?: string;
}

// Cache de turnos por rango de fechas para evitar refetches al navegar
// entre semanas/meses ya visitados.
const appointmentCache = new Map<string, { data: AppointmentWithRelations[]; timestamp: number }>();
const CACHE_TTL_MS = 2 * 60_000; // 2 minutos de validez (antes era 1 min, demasiado corto)

function getCacheKey(from: string, to: string): string {
  return `${from}|${to}`;
}

export function useAppointments(_options?: UseAppointmentsOptions) {
  const [appointments, setAppointments] = useState<AppointmentWithRelations[]>([]);
  const [loading, setLoading] = useState(false);
  // Evitar race conditions entre fetches concurrentes
  const fetchIdRef = useRef(0);

  const fetchAppointments = useCallback(async (from: string, to: string) => {
    const cacheKey = getCacheKey(from, to);
    const cached = appointmentCache.get(cacheKey);

    // Si hay cache válido, usarlo inmediatamente sin fetch
    if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
      setAppointments(cached.data);
      return;
    }

    const currentFetchId = ++fetchIdRef.current;
    setLoading(true);

    try {
      const params = new URLSearchParams({ from, to });
      const res = await fetch(`/api/appointments?${params}`);
      if (!res.ok) throw new Error("Error al cargar turnos");
      const data = await res.json() as { appointments: AppointmentWithRelations[] };
      const result = data.appointments ?? [];

      // Solo actualizar si este fetch es el más reciente
      if (currentFetchId === fetchIdRef.current) {
        setAppointments(result);
        // Guardar en cache
        appointmentCache.set(cacheKey, { data: result, timestamp: Date.now() });
      }
    } catch (error) {
      if (currentFetchId === fetchIdRef.current) {
        console.error("Error al cargar turnos:", error);
        setAppointments([]);
      }
    } finally {
      if (currentFetchId === fetchIdRef.current) {
        setLoading(false);
      }
    }
  }, []);

  const updateAppointment = useCallback(
    async (id: string, updates: { starts_at?: string; ends_at?: string; status?: string }) => {
      try {
        const res = await fetch(`/api/appointments/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(updates),
        });
        if (!res.ok) throw new Error("Error al actualizar turno");
        const data = await res.json() as { appointment: AppointmentWithRelations };

        setAppointments((prev) =>
          prev.map((a) => (a.id === id ? { ...a, ...data.appointment } : a))
        );

        // Invalidar todo el cache porque el turno pudo cambiar de fecha/rango
        appointmentCache.clear();

        return data.appointment;
      } catch (error) {
        console.error("Error al actualizar turno:", error);
        throw error;
      }
    },
    []
  );

  /** Invalida el cache manualmente (útil después de crear/eliminar turnos) */
  const invalidateCache = useCallback(() => {
    appointmentCache.clear();
  }, []);

  return { appointments, loading, fetchAppointments, updateAppointment, invalidateCache };
}
