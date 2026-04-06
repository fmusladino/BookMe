import { type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

// Mapeo de números de día de la semana (0 = domingo, 1 = lunes, ... 6 = sábado)
// a nombres en español
const DAY_NAMES_ES: Record<number, string> = {
  0: "Domingo",
  1: "Lunes",
  2: "Martes",
  3: "Miércoles",
  4: "Jueves",
  5: "Viernes",
  6: "Sábado",
};

// Zona horaria de Argentina (los horarios de atención se configuran en hora local)
const TIMEZONE = "America/Argentina/Buenos_Aires";

/**
 * Convierte una fecha ISO/UTC a componentes de hora local en la zona horaria del negocio.
 * Esto es necesario porque working_hours se guarda en formato local (ej: "09:00")
 * pero los timestamps de turnos se envían en ISO/UTC.
 */
function toLocalTime(isoString: string): { dayOfWeek: number; hours: number; minutes: number } {
  const date = new Date(isoString);
  // Usar Intl.DateTimeFormat para obtener los componentes en la zona horaria correcta
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: TIMEZONE,
    weekday: "short",
    hour: "numeric",
    minute: "numeric",
    hour12: false,
  });
  const parts = formatter.formatToParts(date);

  const weekdayStr = parts.find((p) => p.type === "weekday")?.value ?? "";
  const hours = parseInt(parts.find((p) => p.type === "hour")?.value ?? "0", 10);
  const minutes = parseInt(parts.find((p) => p.type === "minute")?.value ?? "0", 10);

  // Mapear weekday string a número (0=domingo, 1=lunes, etc.)
  const weekdayMap: Record<string, number> = {
    Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6,
  };
  const dayOfWeek = weekdayMap[weekdayStr] ?? 0;

  return { dayOfWeek, hours, minutes };
}

export interface ValidationResult {
  valid: boolean;
  error?: string;
}

/**
 * Valida si un horario de turno cumple con las reglas de negocio de la agenda.
 * Verificaciones:
 * 1. Modo vacaciones: si está activo y el turno es durante el período de vacaciones
 * 2. Días de trabajo: verifica que el día de la semana sea un día laboral
 * 3. Horario de atención: verifica que el turno esté dentro de los horarios de atención
 * 4. Almuerzo: verifica que no se superponga con la pausa de almuerzo
 * 5. Bloqueos de agenda: verifica que no haya bloqueos en el horario
 *
 * @param supabase Cliente de Supabase autenticado
 * @param professionalId ID del profesional
 * @param startsAt Fecha/hora de inicio del turno (ISO 8601)
 * @param endsAt Fecha/hora de fin del turno (ISO 8601)
 * @returns Resultado de validación: { valid: true } o { valid: false, error: "mensaje de error" }
 */
export async function validateAppointmentSlot(
  supabase: SupabaseClient<Database>,
  professionalId: string,
  startsAt: string,
  endsAt: string
): Promise<ValidationResult> {
  try {
    // Obtener configuración de agenda del profesional
    const { data: config, error: configError } = await supabase
      .from("schedule_configs")
      .select("*")
      .eq("professional_id", professionalId)
      .single();

    if (configError || !config) {
      // Si no hay configuración, permitir la reserva
      return { valid: true };
    }

    // ─── Regla 1: Modo vacaciones ───────────────────────────────────────────
    if (config.vacation_mode && config.vacation_until) {
      const appointmentStart = new Date(startsAt);
      const vacationUntil = new Date(config.vacation_until);

      if (appointmentStart < vacationUntil) {
        // Formatear fecha para el mensaje (YYYY-MM-DD)
        const formattedDate = config.vacation_until.split("T")[0];
        return {
          valid: false,
          error: `El profesional está en modo vacaciones hasta ${formattedDate}`,
        };
      }
    }

    // ─── Regla 2: Días de trabajo ───────────────────────────────────────────
    // Convertir a hora local de Argentina para comparar con working_hours
    const localStart = toLocalTime(startsAt);
    const localEnd = toLocalTime(endsAt);
    const dayOfWeek = localStart.dayOfWeek; // 0 = domingo, 6 = sábado

    if (!config.working_days.includes(dayOfWeek)) {
      const dayName = DAY_NAMES_ES[dayOfWeek] || "No especificado";
      return {
        valid: false,
        error: `No se atiende el día ${dayName}`,
      };
    }

    // ─── Regla 3: Horario de atención ───────────────────────────────────────
    // Obtener horarios de atención para ese día
    const { data: workingHours, error: hoursError } = await supabase
      .from("working_hours")
      .select("*")
      .eq("professional_id", professionalId)
      .eq("day_of_week", dayOfWeek);

    if (hoursError || !workingHours || workingHours.length === 0) {
      return {
        valid: false,
        error: "El horario está fuera del horario de atención",
      };
    }

    // Convertir horas locales a minutos desde medianoche para comparación
    const appointmentStartTime = localStart.hours * 60 + localStart.minutes;
    const appointmentEndTime = localEnd.hours * 60 + localEnd.minutes;

    // Verificar que el turno completo esté dentro de algún rango de horario de atención
    let withinWorkingHours = false;

    for (const hour of workingHours) {
      // Parsear start_time y end_time (formato HH:MM)
      const [startHour, startMin] = hour.start_time.split(":").map(Number);
      const [endHour, endMin] = hour.end_time.split(":").map(Number);

      const slotStart = startHour * 60 + startMin;
      const slotEnd = endHour * 60 + endMin;

      // Verificar que el turno completo esté dentro de este rango
      if (appointmentStartTime >= slotStart && appointmentEndTime <= slotEnd) {
        withinWorkingHours = true;
        break;
      }
    }

    if (!withinWorkingHours) {
      return {
        valid: false,
        error: "El horario está fuera del horario de atención",
      };
    }

    // ─── Regla 4: Pausa de almuerzo ─────────────────────────────────────────
    if (config.lunch_break_start && config.lunch_break_end) {
      const [lunchStartHour, lunchStartMin] = config.lunch_break_start.split(":").map(Number);
      const [lunchEndHour, lunchEndMin] = config.lunch_break_end.split(":").map(Number);

      const lunchStart = lunchStartHour * 60 + lunchStartMin;
      const lunchEnd = lunchEndHour * 60 + lunchEndMin;

      // Verificar solapamiento: el turno se superpone con el almuerzo si:
      // - comienza antes de que termine el almuerzo Y
      // - termina después de que comience el almuerzo
      if (appointmentStartTime < lunchEnd && appointmentEndTime > lunchStart) {
        return {
          valid: false,
          error: "El horario se superpone con el horario de almuerzo",
        };
      }
    }

    // ─── Regla 5: Bloqueos de agenda ────────────────────────────────────────
    const { data: blocks, error: blocksError } = await supabase
      .from("schedule_blocks")
      .select("*")
      .eq("professional_id", professionalId)
      .lt("starts_at", endsAt) // El bloqueo comienza antes de que termine el turno
      .gt("ends_at", startsAt); // El bloqueo termina después de que comience el turno

    if (blocksError) {
      console.error("Error verificando bloqueos de agenda:", blocksError);
      // En caso de error, permitir la reserva (fail-open)
      return { valid: true };
    }

    if (blocks && blocks.length > 0) {
      return {
        valid: false,
        error: "El horario está bloqueado",
      };
    }

    // ─── Todas las validaciones pasaron ────────────────────────────────────
    return { valid: true };
  } catch (error) {
    console.error("Error validando horario de turno:", error);
    // En caso de error inesperado, permitir la reserva (fail-open)
    return { valid: true };
  }
}
