import { NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";

/**
 * GET /api/patient/professionals
 *
 * Lista los profesionales que tienen al usuario como paciente.
 * Usado en el portal del paciente para elegir a quién enviarle archivos.
 */
export async function GET() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    const adminClient = createAdminClient();

    // Verificar rol
    const { data: profile } = await adminClient
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    if (!profile || profile.role !== "patient") {
      return NextResponse.json({ error: "Solo pacientes" }, { status: 403 });
    }

    // Buscar registros de paciente
    const { data: patientRecords, error: patientErr } = await adminClient
      .from("patients")
      .select("id, professional_id")
      .eq("profile_id", user.id);

    if (patientErr) {
      console.error("[PATIENT-PROS] Error patients:", patientErr);
      return NextResponse.json({ error: "Error interno" }, { status: 500 });
    }

    if (!patientRecords || patientRecords.length === 0) {
      return NextResponse.json({ professionals: [] });
    }

    const patientIds = patientRecords.map((p) => p.id);
    const proIds = [...new Set(patientRecords.map((p) => p.professional_id))];

    // Datos de los profesionales
    const { data: pros } = await adminClient
      .from("professionals")
      .select("id, specialty, city, public_slug")
      .in("id", proIds);

    const { data: profiles } = await adminClient
      .from("profiles")
      .select("id, full_name, avatar_url")
      .in("id", proIds);

    // Turnos para calcular última visita + totales por (patient_id)
    const { data: appts } = await adminClient
      .from("appointments")
      .select("patient_id, starts_at, status")
      .in("patient_id", patientIds);

    const profileMap = Object.fromEntries(
      (profiles ?? []).map((p) => [p.id, p])
    );
    const proMap = Object.fromEntries((pros ?? []).map((p) => [p.id, p]));

    const apptStatsByPatient = new Map<
      string,
      { last_at: string | null; total: number; attended: number }
    >();
    for (const a of appts ?? []) {
      const cur = apptStatsByPatient.get(a.patient_id) ?? {
        last_at: null,
        total: 0,
        attended: 0,
      };
      cur.total += 1;
      if (a.status === "completed" || a.status === "confirmed") cur.attended += 1;
      if (!cur.last_at || a.starts_at > cur.last_at) cur.last_at = a.starts_at;
      apptStatsByPatient.set(a.patient_id, cur);
    }

    // Una entrada por cada (patient_id, professional_id) — el paciente
    // necesita el patient_id para enviar archivos al profesional correcto.
    const professionals = patientRecords.map((pr) => {
      const stats = apptStatsByPatient.get(pr.id);
      return {
        patient_id: pr.id,
        professional_id: pr.professional_id,
        full_name: profileMap[pr.professional_id]?.full_name ?? "Profesional",
        avatar_url: profileMap[pr.professional_id]?.avatar_url ?? null,
        specialty: proMap[pr.professional_id]?.specialty ?? null,
        city: proMap[pr.professional_id]?.city ?? null,
        public_slug: proMap[pr.professional_id]?.public_slug ?? null,
        last_appointment_at: stats?.last_at ?? null,
        total_appointments: stats?.total ?? 0,
        attended_appointments: stats?.attended ?? 0,
      };
    });

    return NextResponse.json({ professionals });
  } catch (error) {
    console.error("[PATIENT-PROS] Error:", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
