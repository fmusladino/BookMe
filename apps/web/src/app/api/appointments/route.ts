import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { AppointmentStatus } from "@/types";
import { z } from "zod";
import { validateAppointmentSlot } from "@/lib/schedule/validation";
import { sendBookingConfirmation, getNotificationContext } from "@/lib/notifications/send";
// Import dinámico para no romper si googleapis no está instalado
const syncAppointmentCreated = async (appointmentId: string) => {
  try {
    const mod = await import("@/lib/google-calendar/appointment-hooks");
    return mod.syncAppointmentCreated(appointmentId);
  } catch {
    // googleapis no instalado — GCal sync deshabilitado
  }
};

// Schema de validación para crear turno
// Validar que sea un string parseable como fecha ISO 8601 (con o sin offset)
const isoDateString = z.string().refine(
  (val) => !isNaN(new Date(val).getTime()),
  { message: "Fecha inválida" }
);

const createAppointmentSchema = z.object({
  patient_id: z.string().uuid("ID de paciente inválido"),
  service_id: z.string().uuid().optional(),
  starts_at: isoDateString,
  ends_at: isoDateString,
  notes: z.string().max(500).optional().nullable(),
  status: z.string().optional(), // ignorado, el API siempre usa "confirmed"
});

// GET /api/appointments — Turnos del profesional autenticado (rango opcional)
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const from = searchParams.get("from");
    const to = searchParams.get("to");

    let query = supabase
      .from("appointments")
      .select(
        `id, professional_id, patient_id, service_id, starts_at, ends_at, status, notes, reminder_sent, created_at, updated_at, cancelled_at, cancellation_reason, booked_by,
        patient:patients(id, full_name, phone, email),
        service:services(id, name, duration_minutes, price)`
      )
      .eq("professional_id", user.id)
      .order("starts_at", { ascending: true });

    if (from) query = query.gte("starts_at", from);
    if (to) query = query.lte("starts_at", to);

    const { data, error } = await query;

    if (error) {
      console.error("Supabase error appointments:", error.message, error.code, error.details);
      return NextResponse.json(
        { error: "Error al obtener turnos", details: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ appointments: data });
  } catch (error) {
    console.error("Error GET /api/appointments:", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

// POST /api/appointments — Crear turno con verificación de solapamiento
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const body = await request.json() as unknown;
    const parsed = createAppointmentSchema.safeParse(body);

    if (!parsed.success) {
      const fieldErrors = parsed.error.flatten().fieldErrors;
      const firstError = Object.values(fieldErrors).flat()[0];
      return NextResponse.json(
        { error: firstError || "Datos inválidos", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { patient_id, service_id, starts_at, ends_at, notes } = parsed.data;

    // Validar reglas de negocio de la agenda
    const validationResult = await validateAppointmentSlot(
      supabase,
      user.id,
      starts_at,
      ends_at
    );

    if (!validationResult.valid) {
      return NextResponse.json(
        { error: validationResult.error || "Horario no válido" },
        { status: 400 }
      );
    }

    // Verificar que no haya solapamiento con turnos confirmados/pendientes
    const { data: overlapping } = await supabase
      .from("appointments")
      .select("id")
      .eq("professional_id", user.id)
      .in("status", ["pending", "confirmed"] as AppointmentStatus[])
      .lt("starts_at", ends_at)
      .gt("ends_at", starts_at)
      .limit(1);

    if (overlapping && overlapping.length > 0) {
      return NextResponse.json(
        { error: "Ya existe un turno en ese horario" },
        { status: 409 }
      );
    }

    const { data, error } = await supabase
      .from("appointments")
      .insert({
        professional_id: user.id,
        patient_id,
        service_id,
        starts_at,
        ends_at,
        notes,
        booked_by: user.id,
        status: "confirmed" as AppointmentStatus,
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json(
        { error: "Error al crear el turno" },
        { status: 500 }
      );
    }

    // Enviar notificación de confirmación al paciente (fire and forget)
    getNotificationContext(data.id).then((ctx) => {
      if (ctx) sendBookingConfirmation(ctx);
    }).catch((err) => console.error("[Notifications] Error al obtener contexto:", err));

    // Sync con Google Calendar (fire and forget)
    syncAppointmentCreated(data.id).catch((err) =>
      console.error("[GCal Sync] Error al crear evento:", err),
    );

    return NextResponse.json({ appointment: data }, { status: 201 });
  } catch (error) {
    console.error("Error POST /api/appointments:", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
