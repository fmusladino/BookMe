import { NextResponse, type NextRequest } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import type { AppointmentStatus } from "@/types";
import { z } from "zod";
import { validateAppointmentSlot } from "@/lib/schedule/validation";
import { sendBookingConfirmation, sendPushToProNewBooking, getNotificationContext } from "@/lib/notifications/send";
import { checkRateLimit, getClientIp } from "@/lib/security";

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
  modality: z.enum(["presencial", "virtual"]).optional().default("presencial"),
});

const isDev = process.env.NODE_ENV !== "production";

// POST /api/book — Reservar turno como paciente autenticado
export async function POST(request: NextRequest) {
  try {
    // Rate limiting: máx 10 reservas por minuto por IP
    const ip = getClientIp(request);
    const rateLimitError = checkRateLimit(`book:${ip}`, 10, 60_000);
    if (rateLimitError) return rateLimitError;

    if (isDev) console.log("[BOOK] ─── Inicio de reserva ───");
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (isDev) console.log("[BOOK] Auth:", user ? "OK" : "FAIL", authError?.message || "");

    if (authError || !user) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const body = (await request.json()) as unknown;
    if (isDev) console.log("[BOOK] Body recibido");
    const parsed = bookAppointmentSchema.safeParse(body);

    if (!parsed.success) {
      if (isDev) console.log("[BOOK] Validación fallida:", JSON.stringify(parsed.error.flatten()));
      return NextResponse.json(
        { error: "Datos inválidos", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { professional_id, service_id, starts_at, ends_at, notes, modality } = parsed.data;
    if (isDev) console.log("[BOOK] Datos válidos:", { starts_at, ends_at });

    // Admin client para operaciones que necesitan bypassear RLS
    // (el paciente autenticado no tiene permisos de INSERT en patients ni appointments)
    const adminClient = createAdminClient();
    if (isDev) console.log("[BOOK] Admin client creado OK");

    // Verificar que el usuario tiene rol de paciente
    const { data: userProfile, error: profileError } = await adminClient
      .from("profiles")
      .select("id, role, full_name, phone, dni")
      .eq("id", user.id)
      .single();

    if (isDev) console.log("[BOOK] Profile result:", userProfile ? "OK" : "NULL");

    if (profileError || !userProfile) {
      console.error("[BOOK] ERROR profile:", profileError);
      return NextResponse.json({ error: "Perfil de usuario no encontrado" }, { status: 404 });
    }

    if (userProfile.role !== "patient") {
      return NextResponse.json(
        { error: "Solo los pacientes pueden reservar turnos" },
        { status: 403 }
      );
    }

    // Verificar que el profesional existe y está activo
    const { data: professional, error: proError } = await adminClient
      .from("professionals")
      .select("id, subscription_status")
      .eq("id", professional_id)
      .single();

    if (isDev) console.log("[BOOK] Professional result:", professional ? "OK" : "NULL", proError?.message || "");

    if (proError || !professional) {
      console.error("[BOOK] ERROR professional:", proError);
      return NextResponse.json({ error: "Profesional no encontrado" }, { status: 404 });
    }

    if (professional.subscription_status !== "active" && professional.subscription_status !== "trialing") {
      return NextResponse.json(
        { error: "El profesional no está disponible" },
        { status: 400 }
      );
    }

    // Buscar registro de paciente para este profesional
    // Primero buscar por profile_id, luego por DNI (el profesional pudo haberlo creado manualmente)
    let existingPatient: { id: string } | null = null;

    const { data: byProfile } = await adminClient
      .from("patients")
      .select("id")
      .eq("professional_id", professional_id)
      .eq("profile_id", user.id)
      .maybeSingle();

    if (isDev) console.log("[BOOK] Patient by profile_id:", byProfile ? "FOUND" : "NOT FOUND");

    if (byProfile) {
      existingPatient = byProfile;
    } else if (userProfile.dni) {
      // Buscar por DNI (caso: el profesional creó el paciente manualmente)
      const { data: byDni } = await adminClient
        .from("patients")
        .select("id")
        .eq("professional_id", professional_id)
        .eq("dni", userProfile.dni)
        .maybeSingle();

      if (byDni) {
        // Vincular el profile_id al paciente existente
        await adminClient
          .from("patients")
          .update({ profile_id: user.id })
          .eq("id", byDni.id);
        existingPatient = byDni;
      }
    }

    let patientId: string;

    if (existingPatient) {
      patientId = existingPatient.id;
    } else {
      // Auto-crear paciente usando datos del perfil
      // DNI puede estar vacío si el paciente no lo completó en su perfil
      const patientDni = userProfile.dni || `WEB-${user.id.slice(0, 8)}`;
      const { data: newPatient, error: createPatientError } = await adminClient
        .from("patients")
        .insert({
          professional_id,
          profile_id: user.id,
          full_name: userProfile.full_name,
          dni: patientDni,
          phone: userProfile.phone,
          email: user.email,
          is_particular: true,
        })
        .select("id")
        .single();

      if (isDev) console.log("[BOOK] Create patient result:", newPatient ? "OK" : "NULL", createPatientError?.message || "");

      if (createPatientError || !newPatient) {
        console.error("[BOOK] ERROR creating patient:", createPatientError);
        return NextResponse.json(
          { error: "Error al crear registro de paciente", details: createPatientError?.message },
          { status: 500 }
        );
      }

      patientId = newPatient.id;
    }

    // Validar que el slot de tiempo es válido según la configuración de la agenda
    const validationResult = await validateAppointmentSlot(
      adminClient,
      professional_id,
      starts_at,
      ends_at,
      modality
    );

    if (isDev) console.log("[BOOK] Slot validation:", validationResult.valid ? "VALID" : "INVALID");

    if (!validationResult.valid) {
      return NextResponse.json(
        { error: validationResult.error || "Horario no válido" },
        { status: 400 }
      );
    }

    // Verificar que no hay solapamiento con otros turnos
    const { data: overlapping, error: overlapError } = await adminClient
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

    // Si el paciente eligió modalidad virtual, generamos un link de Jitsi único
    // y lo guardamos en el turno. El link sirve tanto si el turno es hoy como en dos semanas:
    // la sala de Jitsi existe recién cuando alguien entra.
    const meetUrl =
      modality === "virtual"
        ? `https://meet.jit.si/bookme-${(typeof crypto !== "undefined" && "randomUUID" in crypto
            ? crypto.randomUUID()
            : Math.random().toString(36).slice(2) + Date.now().toString(36)
          )
            .replace(/-/g, "")
            .slice(0, 16)}`
        : null;

    // Crear el turno con estado "confirmed" — las reservas online quedan confirmadas
    // automáticamente y llegan listas tanto al paciente como al profesional.
    const { data: appointment, error: createError } = await adminClient
      .from("appointments")
      .insert({
        professional_id,
        patient_id: patientId,
        service_id: service_id || null,
        starts_at,
        ends_at,
        notes: notes || null,
        booked_by: user.id,
        status: "confirmed" as AppointmentStatus,
        modality,
        meet_url: meetUrl,
      })
      .select()
      .single();

    if (isDev) console.log("[BOOK] Create appointment result:", appointment ? "OK" : "NULL", createError?.message || "");

    if (createError) {
      console.error("[BOOK] ERROR creating appointment:", createError);
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

    if (isDev) console.log("[BOOK] ─── Reserva exitosa ───");
    return NextResponse.json({ appointment }, { status: 201 });
  } catch (error) {
    console.error("[BOOK] ERROR CATCH:", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
