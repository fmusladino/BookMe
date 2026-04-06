import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { AppointmentStatus } from "@/types";
import { z } from "zod";
import { validateAppointmentSlot } from "@/lib/schedule/validation";
import {
  sendRescheduleNotification,
  sendCancellationNotification,
  getNotificationContext,
} from "@/lib/notifications/send";
// Imports dinámicos para no romper si googleapis no está instalado
const syncAppointmentUpdated = async (appointmentId: string) => {
  try {
    const mod = await import("@/lib/google-calendar/appointment-hooks");
    return mod.syncAppointmentUpdated(appointmentId);
  } catch {
    // googleapis no instalado — GCal sync deshabilitado
  }
};
const syncAppointmentCancelled = async (appointmentId: string) => {
  try {
    const mod = await import("@/lib/google-calendar/appointment-hooks");
    return mod.syncAppointmentCancelled(appointmentId);
  } catch {
    // googleapis no instalado — GCal sync deshabilitado
  }
};

const updateAppointmentSchema = z.object({
  status: z.enum(["pending", "confirmed", "cancelled", "completed", "no_show"]).optional(),
  starts_at: z.string().datetime().optional(),
  ends_at: z.string().datetime().optional(),
  notes: z.string().max(500).optional(),
  cancellation_reason: z.string().max(300).optional(),
});

// GET /api/appointments/[id]
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const { id } = await params;

    const { data, error } = await supabase
      .from("appointments")
      .select(
        `id, professional_id, patient_id, service_id, starts_at, ends_at, status, notes, reminder_sent, created_at, updated_at, cancelled_at, cancellation_reason, booked_by,
        patient:patients(id, full_name, phone, email, dni),
        service:services(id, name, duration_minutes, price)`
      )
      .eq("id", id)
      .eq("professional_id", user.id)
      .single();

    if (error || !data) {
      return NextResponse.json(
        { error: "Turno no encontrado" },
        { status: 404 }
      );
    }

    return NextResponse.json({ appointment: data });
  } catch (error) {
    console.error("Error GET /api/appointments/[id]:", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

// PATCH /api/appointments/[id]
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json() as unknown;
    const parsed = updateAppointmentSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Datos inválidos", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    // Obtener turno actual UNA SOLA VEZ (antes se hacía 2-3 veces)
    // Se necesita para: validar horario nuevo + guardar oldStartsAt para notificación
    const isRescheduling = parsed.data.starts_at !== undefined || parsed.data.ends_at !== undefined;
    let oldStartsAt: string | null = null;

    if (isRescheduling) {
      const { data: currentAppointment, error: fetchError } = await supabase
        .from("appointments")
        .select("starts_at, ends_at")
        .eq("id", id)
        .eq("professional_id", user.id)
        .single();

      if (fetchError || !currentAppointment) {
        return NextResponse.json(
          { error: "Turno no encontrado" },
          { status: 404 }
        );
      }

      // Guardar starts_at original para detectar reprogramación en la notificación
      oldStartsAt = currentAppointment.starts_at;

      const newStartsAt = parsed.data.starts_at || currentAppointment.starts_at;
      const newEndsAt = parsed.data.ends_at || currentAppointment.ends_at;

      // Validar el nuevo horario
      const validationResult = await validateAppointmentSlot(
        supabase,
        user.id,
        newStartsAt,
        newEndsAt
      );

      if (!validationResult.valid) {
        return NextResponse.json(
          { error: validationResult.error || "Horario no válido" },
          { status: 400 }
        );
      }
    }

    // Construir objeto de actualización tipado
    const updateData: {
      status?: AppointmentStatus;
      starts_at?: string;
      ends_at?: string;
      notes?: string;
      cancellation_reason?: string;
      cancelled_at?: string;
    } = {};

    if (parsed.data.status !== undefined) updateData.status = parsed.data.status;
    if (parsed.data.starts_at !== undefined) updateData.starts_at = parsed.data.starts_at;
    if (parsed.data.ends_at !== undefined) updateData.ends_at = parsed.data.ends_at;
    if (parsed.data.notes !== undefined) updateData.notes = parsed.data.notes;
    if (parsed.data.cancellation_reason !== undefined) updateData.cancellation_reason = parsed.data.cancellation_reason;

    // Si se está cancelando, registrar fecha de cancelación
    if (parsed.data.status === "cancelled") {
      updateData.cancelled_at = new Date().toISOString();
    }

    const { data, error } = await supabase
      .from("appointments")
      .update(updateData)
      .eq("id", id)
      .eq("professional_id", user.id)
      .select()
      .single();

    if (error || !data) {
      return NextResponse.json(
        { error: "Error al actualizar el turno" },
        { status: 500 }
      );
    }

    // Enviar notificaciones según el tipo de cambio (fire and forget)
    if (parsed.data.status === "cancelled") {
      // Cancelación
      getNotificationContext(id).then((ctx) => {
        if (ctx) sendCancellationNotification(ctx);
      }).catch((err) => console.error("[Notifications] Error cancelación:", err));

      // Cancelar en Google Calendar
      syncAppointmentCancelled(user.id, data.google_event_id).catch((err) =>
        console.error("[GCal Sync] Error al cancelar evento:", err),
      );
    } else {
      if (oldStartsAt && parsed.data.starts_at && oldStartsAt !== parsed.data.starts_at) {
        // Reprogramación (el horario cambió) — notificar
        getNotificationContext(id).then((ctx) => {
          if (ctx) sendRescheduleNotification({ ...ctx, oldStartsAt: new Date(oldStartsAt!) });
        }).catch((err) => console.error("[Notifications] Error reprogramación:", err));
      }

      // Actualizar en Google Calendar (horario o cualquier cambio)
      syncAppointmentUpdated(data).catch((err) =>
        console.error("[GCal Sync] Error al actualizar evento:", err),
      );
    }

    return NextResponse.json({ appointment: data });
  } catch (error) {
    console.error("Error PATCH /api/appointments/[id]:", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

// DELETE /api/appointments/[id] — soft delete via status = cancelled
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const { id } = await params;

    const { data, error } = await supabase
      .from("appointments")
      .update({
        status: "cancelled" as AppointmentStatus,
        cancelled_at: new Date().toISOString(),
      })
      .eq("id", id)
      .eq("professional_id", user.id)
      .select()
      .single();

    if (error || !data) {
      return NextResponse.json(
        { error: "Turno no encontrado o sin permisos" },
        { status: 404 }
      );
    }

    // Enviar notificación de cancelación al paciente (fire and forget)
    getNotificationContext(id).then((ctx) => {
      if (ctx) sendCancellationNotification(ctx);
    }).catch((err) => console.error("[Notifications] Error cancelación:", err));

    // Cancelar en Google Calendar (fire and forget)
    syncAppointmentCancelled(user.id, data.google_event_id).catch((err) =>
      console.error("[GCal Sync] Error al cancelar evento:", err),
    );

    return NextResponse.json({ appointment: data });
  } catch (error) {
    console.error("Error DELETE /api/appointments/[id]:", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
