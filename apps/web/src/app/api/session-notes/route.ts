import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { z } from "zod";

// Validación para crear una nota de sesión
const createSessionNoteSchema = z.object({
  patient_id: z.string().uuid("ID de paciente inválido"),
  appointment_id: z.string().uuid("ID de turno inválido"),
  content: z.string().min(1, "Contenido requerido").max(5000, "Máximo 5000 caracteres"),
});

// GET /api/session-notes — Listar notas de sesión de un paciente
// Query params: patient_id (requerido)
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    // Obtener patient_id del query string
    const { searchParams } = new URL(request.url);
    const patientId = searchParams.get("patient_id");

    if (!patientId) {
      return NextResponse.json(
        { error: "El parámetro patient_id es requerido" },
        { status: 400 }
      );
    }

    // Validar que el paciente pertenece al profesional
    const { data: patient, error: patientError } = await supabase
      .from("patients")
      .select("id")
      .eq("id", patientId)
      .eq("professional_id", user.id)
      .single();

    if (patientError || !patient) {
      return NextResponse.json(
        { error: "Paciente no encontrado o sin permisos" },
        { status: 404 }
      );
    }

    // Obtener las notas de sesión del paciente ordenadas por appointment starts_at DESC
    const { data, error } = await supabase
      .from("session_notes")
      .select(
        `id,
        professional_id,
        patient_id,
        appointment_id,
        content,
        created_at,
        updated_at,
        appointment:appointments(id, starts_at, ends_at, status),
        patient:patients(id, full_name)`
      )
      .eq("professional_id", user.id)
      .eq("patient_id", patientId)
      .order("appointment(starts_at)", { ascending: false });

    if (error) {
      console.error("Error al obtener notas de sesión:", error);
      return NextResponse.json(
        { error: "Error al obtener notas de sesión" },
        { status: 500 }
      );
    }

    return NextResponse.json({ notes: data || [] });
  } catch (error) {
    console.error("Error GET /api/session-notes:", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

// POST /api/session-notes — Crear una nota de sesión
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
    const parsed = createSessionNoteSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Datos inválidos", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    // Validar que el paciente pertenece al profesional
    const { data: patient, error: patientError } = await supabase
      .from("patients")
      .select("id")
      .eq("id", parsed.data.patient_id)
      .eq("professional_id", user.id)
      .single();

    if (patientError || !patient) {
      return NextResponse.json(
        { error: "Paciente no encontrado o sin permisos" },
        { status: 404 }
      );
    }

    // Validar que el turno existe y pertenece al profesional
    const { data: appointment, error: appointmentError } = await supabase
      .from("appointments")
      .select("id")
      .eq("id", parsed.data.appointment_id)
      .eq("professional_id", user.id)
      .single();

    if (appointmentError || !appointment) {
      return NextResponse.json(
        { error: "Turno no encontrado o sin permisos" },
        { status: 404 }
      );
    }

    // Crear la nota de sesión
    const { data, error } = await supabase
      .from("session_notes")
      .insert({
        professional_id: user.id,
        patient_id: parsed.data.patient_id,
        appointment_id: parsed.data.appointment_id,
        content: parsed.data.content,
      })
      .select(
        `id,
        professional_id,
        patient_id,
        appointment_id,
        content,
        created_at,
        updated_at,
        appointment:appointments(id, starts_at, ends_at, status),
        patient:patients(id, full_name)`
      )
      .single();

    if (error) {
      // Verificar si es por appointment_id duplicado
      if (error.code === "23505") {
        return NextResponse.json(
          { error: "Ya existe una nota para este turno" },
          { status: 409 }
        );
      }
      console.error("Error al crear nota de sesión:", error);
      return NextResponse.json(
        { error: "Error al crear nota de sesión" },
        { status: 500 }
      );
    }

    return NextResponse.json({ note: data }, { status: 201 });
  } catch (error) {
    console.error("Error POST /api/session-notes:", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
