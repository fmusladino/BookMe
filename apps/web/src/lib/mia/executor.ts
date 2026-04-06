import { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import type { MiaResponse } from "./actions";

// Ejecuta acciones confirmadas por el usuario
export async function executeConfirmedAction(
  supabase: SupabaseClient<Database>,
  userId: string,
  action: string,
  data: Record<string, unknown>
): Promise<MiaResponse> {
  try {
    if (action === "confirm_create") {
      return await executeCreateAppointment(supabase, userId, data);
    } else if (action === "confirm_cancel") {
      return await executeCancelAppointment(supabase, userId, data);
    } else if (action === "confirm_block") {
      return await executeBlockSchedule(supabase, userId, data);
    } else {
      return {
        message: "No reconozco esa acción. ¿Podés repetirla?",
        action: "none",
      };
    }
  } catch (error) {
    console.error("[MIA] Error ejecutando acción:", error);
    return {
      message: "Ocurrió un error al procesar tu solicitud. Intenta de nuevo.",
      action: "none",
    };
  }
}

// Ejecuta la creación de un turno
async function executeCreateAppointment(
  supabase: SupabaseClient<Database>,
  userId: string,
  data: Record<string, unknown>
): Promise<MiaResponse> {
  const { patient_id, starts_at, ends_at, reason } = data;

  if (!patient_id || !starts_at || !ends_at) {
    return {
      message: "Faltan datos para crear el turno. Intenta de nuevo.",
      action: "none",
    };
  }

  // Verifica que no haya solapamiento con otros turnos
  const { data: overlapping } = await supabase
    .from("appointments")
    .select("id")
    .eq("professional_id", userId)
    .in("status", ["confirmed", "pending"])
    .lt("starts_at", ends_at as string)
    .gt("ends_at", starts_at as string)
    .limit(1);

  if (overlapping && overlapping.length > 0) {
    return {
      message: "Ya tenés un turno en ese horario. ¿Elegimos otro horario?",
      action: "none",
    };
  }

  // Crea el turno
  const { data: appointment, error } = await supabase
    .from("appointments")
    .insert({
      professional_id: userId,
      patient_id: patient_id as string,
      starts_at: starts_at as string,
      ends_at: ends_at as string,
      booked_by: userId,
      notes: reason ? (reason as string) : undefined,
      status: "confirmed",
    })
    .select()
    .single();

  if (error) {
    console.error("[MIA] Error al crear turno:", error);
    return {
      message: "No pude crear el turno. Intenta de nuevo.",
      action: "none",
    };
  }

  return {
    message: `✅ Turno creado exitosamente. ${appointment ? `ID: ${appointment.id}` : ""}`,
    action: "none",
    data: {
      appointment_id: appointment?.id,
    },
  };
}

// Ejecuta la cancelación de un turno
async function executeCancelAppointment(
  supabase: SupabaseClient<Database>,
  userId: string,
  data: Record<string, unknown>
): Promise<MiaResponse> {
  const { appointment_id, reason } = data;

  if (!appointment_id) {
    return {
      message: "No encontré el turno para cancelar.",
      action: "none",
    };
  }

  // Verifica que el turno pertenezca al profesional
  const { data: appointment } = await supabase
    .from("appointments")
    .select("id, patient_id")
    .eq("id", appointment_id as string)
    .eq("professional_id", userId)
    .single();

  if (!appointment) {
    return {
      message: "No encontré el turno para cancelar.",
      action: "none",
    };
  }

  // Cancela el turno
  const { error } = await supabase
    .from("appointments")
    .update({
      status: "cancelled",
      cancelled_at: new Date().toISOString(),
      cancellation_reason: reason ? (reason as string) : undefined,
    })
    .eq("id", appointment_id as string);

  if (error) {
    console.error("[MIA] Error al cancelar turno:", error);
    return {
      message: "No pude cancelar el turno. Intenta de nuevo.",
      action: "none",
    };
  }

  return {
    message: "✅ Turno cancelado exitosamente. 🚫",
    action: "none",
  };
}

// Ejecuta el bloqueo de horario
async function executeBlockSchedule(
  supabase: SupabaseClient<Database>,
  userId: string,
  data: Record<string, unknown>
): Promise<MiaResponse> {
  const { starts_at, ends_at, reason } = data;

  if (!starts_at || !ends_at) {
    return {
      message: "Faltan datos para bloquear el horario.",
      action: "none",
    };
  }

  // Crea el bloqueo
  const { error } = await supabase.from("schedule_blocks").insert({
    professional_id: userId,
    starts_at: starts_at as string,
    ends_at: ends_at as string,
    reason: reason ? (reason as string) : undefined,
  });

  if (error) {
    console.error("[MIA] Error al bloquear horario:", error);
    return {
      message: "No pude bloquear el horario. Intenta de nuevo.",
      action: "none",
    };
  }

  return {
    message: "✅ Horario bloqueado exitosamente. 🚫",
    action: "none",
  };
}
