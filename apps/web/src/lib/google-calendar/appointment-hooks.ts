/**
 * Hooks para sincronizar appointments con Google Calendar.
 * Se llaman fire-and-forget desde las API routes de appointments.
 *
 * Usa imports dinámicos de ./client para evitar romper el build
 * si el paquete googleapis no está instalado.
 */
import { createAdminClient } from "@/lib/supabase/server";

interface AppointmentData {
  id: string;
  professional_id: string;
  starts_at: string;
  ends_at: string;
  status: string;
  notes?: string | null;
  google_event_id?: string | null;
}

// Helper: importar client dinámicamente
async function getClient() {
  try {
    return await import("./client");
  } catch {
    // googleapis no instalado — GCal sync deshabilitado
    return null;
  }
}

/**
 * Llamar después de crear un appointment.
 * Crea el evento en Google Calendar y guarda el google_event_id.
 */
export async function syncAppointmentCreated(appointmentId: string): Promise<void> {
  const client = await getClient();
  if (!client) return;

  const admin = createAdminClient();

  const { data: apt } = await admin
    .from("appointments")
    .select(
      `id, professional_id, starts_at, ends_at, status, notes,
       patient:patients(full_name, phone),
       service:services(name, duration_minutes)`,
    )
    .eq("id", appointmentId)
    .single();

  if (!apt) return;

  const { data: conn } = await admin
    .from("google_calendar_connections")
    .select("id")
    .eq("professional_id", apt.professional_id)
    .eq("is_active", true)
    .single();

  if (!conn) return;

  const googleEventId = await client.createGoogleEvent(apt.professional_id, {
    id: apt.id,
    starts_at: apt.starts_at,
    ends_at: apt.ends_at,
    status: apt.status,
    notes: apt.notes,
    patient: Array.isArray(apt.patient) ? apt.patient[0] : apt.patient,
    service: Array.isArray(apt.service) ? apt.service[0] : apt.service,
  });

  if (googleEventId) {
    await admin
      .from("appointments")
      .update({ google_event_id: googleEventId })
      .eq("id", appointmentId);
  }
}

/**
 * Llamar después de actualizar un appointment (horario o status).
 * Actualiza el evento en Google Calendar.
 */
export async function syncAppointmentUpdated(appointment: AppointmentData): Promise<void> {
  if (!appointment.google_event_id) return;

  const client = await getClient();
  if (!client) return;

  const admin = createAdminClient();
  const { data: conn } = await admin
    .from("google_calendar_connections")
    .select("id")
    .eq("professional_id", appointment.professional_id)
    .eq("is_active", true)
    .single();

  if (!conn) return;

  const { data: apt } = await admin
    .from("appointments")
    .select(
      `patient:patients(full_name, phone),
       service:services(name, duration_minutes)`,
    )
    .eq("id", appointment.id)
    .single();

  await client.updateGoogleEvent(appointment.professional_id, appointment.google_event_id, {
    id: appointment.id,
    starts_at: appointment.starts_at,
    ends_at: appointment.ends_at,
    status: appointment.status,
    notes: appointment.notes,
    patient: apt ? (Array.isArray(apt.patient) ? apt.patient[0] : apt.patient) : null,
    service: apt ? (Array.isArray(apt.service) ? apt.service[0] : apt.service) : null,
  });
}

/**
 * Llamar después de cancelar/eliminar un appointment.
 * Elimina el evento de Google Calendar.
 */
export async function syncAppointmentCancelled(
  professionalId: string,
  googleEventId: string | null,
): Promise<void> {
  if (!googleEventId) return;

  const client = await getClient();
  if (!client) return;

  const admin = createAdminClient();
  const { data: conn } = await admin
    .from("google_calendar_connections")
    .select("id")
    .eq("professional_id", professionalId)
    .eq("is_active", true)
    .single();

  if (!conn) return;

  await client.deleteGoogleEvent(professionalId, googleEventId);
}
