import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { AppointmentStatus } from "@/types";
import { z } from "zod";
import { validateAppointmentSlot } from "@/lib/schedule/validation";
import { sendBookingConfirmation, sendPushToProNewBooking, getNotificationContext } from "@/lib/notifications/send";

// Validar que sea un string parseable como fecha ISO 8601 (con o sin offset)
const isoDateString = z.string().refine(
  (val) => !isNaN(new Date(val).getTime()),
  { message: "Fecha inválida" }
);

// Schema de validación para reserva de turno
const bookAppointmentSchema = z.object({
  professional_id: z.string().uuid("ID de profesional inválido"),
  service_id: z.string().uuid("ID de servicio inválido").optional(),
  starts_at: isoDateString,
  ends_at: isoDateString,
  notes: z.string().max(500, "Notas no pueden exceder 500 caracteres").optional(),
});

// POST /api/book — Reservar turno como paciente autenticado
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const body = (await request.json()) as unknown;
    const parsed = bookAppointmentSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Datos inválidos", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { professional_id, service_id, starts_at, ends_at, notes } = parsed.data;

    // Verificar que el usuario tiene rol de paciente
    const { data: userProfile, error: profileError } = await supabase
      .from("profiles")
      .select("id, role, full_name, phone, dni")
      .eq("id", user.id)
      .single();

    if (profileError || !userProfile) {
      console.error("Error getting user profile:", profileError);
      return NextResponse.json({ error: "Perfil de usuario no encontrado" }, { status: 404 });
    }

    if (userProfile.role !== "patient") {
      return NextResponse.json(
        { error: "Solo los pacientes pueden reservar turnos" },
        { status: 403 }
      );
    }

    // Verificar que el profesional existe y está activo
    const { data: professional, error: proError } = await supabase
      .from("professionals")
      .select("id, subscription_status")
      .eq("id", professional_id)
      .single();

    if (proError || !professional) {
      console.error("Error getting professional:", proError);
      return NextResponse.json({ error: "Profesional no encontrado" }, { status: 404 });
    }

    if (professional.subscription_status !== "active" && professional.subscription_status !== "trialing") {
      return NextResponse.json(
        { error: "El profesional no está disponible" },
        { status: 400 }
      );
    }

    // Buscar o crear registro de paciente para este profesional
    const { data: existingPatient, error: patientError } = await supabase
      .from("patients")
      .select("id")
      .eq("professional_id", professional_id)
      .eq("profile_id", user.id)
      .maybeSingle();

    let patientId: string;

    if (existingPatient) {
      patientId = existingPatient.id;
    } else {
      // Auto-crear paciente usando datos del perfil
      const { data: newPatient, error: createPatientError } = await supabase
        .from("patients")
        .insert({
          professional_id,
          profile_id: user.id,
          full_name: userProfile.full_name,
          dni: userProfile.dni,
          phone: userProfile.phone,
          is_particular: true,
        })
        .select("id")
        .single();

      if (createPatientError || !newPatient) {
        console.error("Error creating patient:", createPatientError);
        return NextResponse.json(
          { error: "Error al crear registro de paciente" },
          { status: 500 }
        );
      }

      patientId = newPatient.id;
    }

    // Validar que el slot de tiempo es válido según la configuración de la agenda
    const validationResult = await validateAppointmentSlot(
      supabase,
      professional_id,
      starts_at,
      ends_at
    );

    if (!validationResult.valid) {
      return NextResponse.json(
        { error: validationResult.error || "Horario no válido" },
        { status: 400 }
      );
    }

    // Verificar que no hay solapamiento con otros turnos
    const { data: overlapping, error: overlapError } = await supabase
      .from("appointments")
      .select("id")
      .eq("professional_id", professional_id)
      .in("status", ["pending", "confirmed"] as AppointmentStatus[])
      .lt("starts_at", ends_at)
      .gt("ends_at", starts_at)
      .limit(1);

    if (overlapError) {
      console.error("Error checking overlapping appointments:", overlapError);
      return NextResponse.json(
        { error: "Error al validar disponibilidad" },
        { status: 500 }
      );
    }

    if (overlapping && overlapping.length > 0) {
      return NextResponse.json(
        { error: "El horario ya no está disponible" },
        { status: 409 }
      );
    }

    // Crear el turno con estado "pending" (requiere confirmación del profesional)
    const { data: appointment, error: createError } = await supabase
      .from("appointments")
      .insert({
        professional_id,
        patient_id: patientId,
        service_id: service_id || null,
        starts_at,
        ends_at,
        notes: notes || null,
        booked_by: user.id,
        status: "pending" as AppointmentStatus,
      })
      .select()
      .single();

    if (createError) {
      console.error("Error creating appointment:", createError);
      return NextResponse.json(
        { error: "Error al crear el turno", details: createError.message },
        { status: 500 }
      );
    }

    // Enviar notificación de confirmación al paciente (fire and forget)
    getNotificationContext(appointment.id).then((ctx) => {
      if (ctx) sendBookingConfirmation(ctx);
    }).catch((err) => console.error("[Notifications] Error al obtener contexto:", err));

    // Enviar push notification al profesional (fire and forget)
    sendPushToProNewBooking(
      professional_id,
      userProfile.full_name,
      new Date(starts_at)
    );

    return NextResponse.json({ appointment }, { status: 201 });
  } catch (error) {
    console.error("Error POST /api/book:", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
