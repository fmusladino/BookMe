/**
 * Google Calendar ↔ BookMe sync logic
 * Procesa eventos de GCal y los convierte en appointments/blocks en BookMe.
 */
import { createAdminClient } from "@/lib/supabase/server";

// Import dinámico para evitar error si googleapis no está instalado
async function getClient() {
  try {
    return await import("./client");
  } catch {
    return null;
  }
}

// Tipo simplificado para evitar dependencia directa de googleapis
interface CalendarEvent {
  id?: string | null;
  summary?: string | null;
  start?: { dateTime?: string | null; date?: string | null } | null;
  end?: { dateTime?: string | null; date?: string | null } | null;
  status?: string | null;
  extendedProperties?: { private?: Record<string, string> | null } | null;
  source?: { title?: string | null } | null;
}

/**
 * Procesa los cambios recibidos desde Google Calendar.
 * - Evento nuevo sin bookme_appointment_id → crear bloqueo en schedule_blocks
 * - Evento modificado con bookme_appointment_id → ignorar (fue creado por BookMe)
 * - Evento eliminado con bookme_appointment_id → cancelar turno en BookMe
 * - Evento eliminado sin bookme_appointment_id → eliminar bloqueo
 */
export async function processGoogleCalendarChanges(
  professionalId: string,
): Promise<{ processed: number; errors: number }> {
  const client = await getClient();
  if (!client) return { processed: 0, errors: 0 };

  const result = await client.getIncrementalChanges(professionalId);
  if (!result) return { processed: 0, errors: 0 };

  const admin = createAdminClient();
  let processed = 0;
  let errors = 0;

  for (const event of result.events) {
    try {
      const bookmeId =
        event.extendedProperties?.private?.["bookme_appointment_id"] ?? null;
      const isFromBookMe = event.extendedProperties?.private?.["source"] === "bookme";
      const isDeleted = event.status === "cancelled";

      if (isDeleted) {
        await handleDeletedEvent(admin, professionalId, event, bookmeId);
      } else if (isFromBookMe && bookmeId) {
        // Evento creado por BookMe — ignorar cambios de GCal para evitar loops
        // (excepto si el profesional lo movió de horario en GCal)
        await handleBookMeEventModified(admin, bookmeId, event);
      } else {
        // Evento externo (no creado por BookMe) → bloquear horario
        await handleExternalEvent(admin, professionalId, event);
      }
      processed++;
    } catch (err) {
      console.error(`[GCal Sync] Error processing event ${event.id}:`, err);
      errors++;
    }
  }

  return { processed, errors };
}

// ─── Handlers internos ──────────────────────────────────────────────────────

async function handleDeletedEvent(
  admin: ReturnType<typeof createAdminClient>,
  professionalId: string,
  event: CalendarEvent,
  bookmeAppointmentId: string | null,
) {
  if (bookmeAppointmentId) {
    // El profesional eliminó en GCal un evento que era un turno de BookMe → cancelar
    await admin
      .from("appointments")
      .update({
        status: "cancelled",
        cancelled_at: new Date().toISOString(),
        cancellation_reason: "Cancelado desde Google Calendar",
      })
      .eq("id", bookmeAppointmentId)
      .eq("professional_id", professionalId)
      .in("status", ["pending", "confirmed"]);
  } else if (event.id) {
    // Evento externo eliminado → quitar bloqueo
    await admin
      .from("schedule_blocks")
      .delete()
      .eq("google_event_id", event.id)
      .eq("professional_id", professionalId);
  }
}

async function handleBookMeEventModified(
  admin: ReturnType<typeof createAdminClient>,
  bookmeAppointmentId: string,
  event: CalendarEvent,
) {
  // Si el profesional movió el evento en GCal, actualizar horario en BookMe
  const newStart = event.start?.dateTime;
  const newEnd = event.end?.dateTime;

  if (!newStart || !newEnd) return;

  const { data: existing } = await admin
    .from("appointments")
    .select("starts_at, ends_at")
    .eq("id", bookmeAppointmentId)
    .single();

  if (!existing) return;

  // Solo actualizar si realmente cambió el horario
  const startChanged = new Date(newStart).getTime() !== new Date(existing.starts_at).getTime();
  const endChanged = new Date(newEnd).getTime() !== new Date(existing.ends_at).getTime();

  if (startChanged || endChanged) {
    await admin
      .from("appointments")
      .update({
        starts_at: newStart,
        ends_at: newEnd,
      })
      .eq("id", bookmeAppointmentId);
  }
}

async function handleExternalEvent(
  admin: ReturnType<typeof createAdminClient>,
  professionalId: string,
  event: CalendarEvent,
) {
  const startDateTime = event.start?.dateTime;
  const endDateTime = event.end?.dateTime;

  // Ignorar eventos de todo el día (no bloquean slots específicos)
  if (!startDateTime || !endDateTime) return;
  if (!event.id) return;

  // Verificar si ya existe un bloqueo para este evento
  const { data: existingBlock } = await admin
    .from("schedule_blocks")
    .select("id, starts_at, ends_at")
    .eq("google_event_id", event.id)
    .eq("professional_id", professionalId)
    .single();

  if (existingBlock) {
    // Actualizar bloqueo existente si el horario cambió
    const startChanged =
      new Date(startDateTime).getTime() !== new Date(existingBlock.starts_at).getTime();
    const endChanged =
      new Date(endDateTime).getTime() !== new Date(existingBlock.ends_at).getTime();

    if (startChanged || endChanged) {
      await admin
        .from("schedule_blocks")
        .update({
          starts_at: startDateTime,
          ends_at: endDateTime,
          reason: event.summary ? `GCal: ${event.summary}` : "Google Calendar",
        })
        .eq("id", existingBlock.id);
    }
  } else {
    // Crear nuevo bloqueo
    await admin.from("schedule_blocks").insert({
      professional_id: professionalId,
      starts_at: startDateTime,
      ends_at: endDateTime,
      reason: event.summary ? `GCal: ${event.summary}` : "Google Calendar",
      google_event_id: event.id,
    });
  }
}
