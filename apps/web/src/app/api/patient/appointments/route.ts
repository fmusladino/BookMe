import { NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";

/**
 * GET /api/patient/appointments
 *
 * Obtiene los turnos del paciente autenticado con datos completos del profesional.
 * Usa admin client para bypassear RLS (el paciente no puede leer profiles de otros usuarios).
 */
export async function GET() {
  try {
    // Verificar autenticación del paciente
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    const adminClient = createAdminClient();

    // Verificar que es un paciente
    const { data: profile } = await adminClient
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    if (!profile || profile.role !== "patient") {
      return NextResponse.json({ error: "Solo pacientes" }, { status: 403 });
    }

    // Buscar registros de paciente para este usuario
    const { data: patientRecords } = await adminClient
      .from("patients")
      .select("id, professional_id")
      .eq("profile_id", user.id);

    if (!patientRecords || patientRecords.length === 0) {
      return NextResponse.json({ appointments: [] });
    }

    const patientIds = patientRecords.map((p) => p.id);

    // Obtener turnos
    const { data: appts, error: apptsError } = await adminClient
      .from("appointments")
      .select(
        `id, starts_at, ends_at, status, notes, modality, meet_url, professional_id,
         service:services(name, duration_minutes),
         professional:professionals(specialty, city, public_slug)`
      )
      .in("patient_id", patientIds)
      .order("starts_at", { ascending: false })
      .limit(50);

    if (apptsError) {
      console.error("[PATIENT-APPTS] Error:", apptsError);
      return NextResponse.json({ error: "Error al obtener turnos" }, { status: 500 });
    }

    // Obtener nombres de profesionales desde profiles
    const proIds = [...new Set((appts ?? []).map((a) => a.professional_id))];
    let profileMap: Record<string, { full_name: string; avatar_url: string | null }> = {};

    if (proIds.length > 0) {
      const { data: profiles } = await adminClient
        .from("profiles")
        .select("id, full_name, avatar_url")
        .in("id", proIds);

      if (profiles) {
        profileMap = Object.fromEntries(
          profiles.map((p) => [p.id, { full_name: p.full_name, avatar_url: p.avatar_url }])
        );
      }
    }

    // Combinar datos
    const enrichedAppts = (appts ?? []).map((a) => ({
      id: a.id,
      starts_at: a.starts_at,
      ends_at: a.ends_at,
      status: a.status,
      notes: a.notes,
      modality: (a as { modality?: string }).modality ?? "presencial",
      meet_url: (a as { meet_url?: string | null }).meet_url ?? null,
      service: a.service,
      professional: {
        ...(a.professional as any),
        profile: profileMap[a.professional_id] ?? { full_name: "Profesional", avatar_url: null },
      },
    }));

    return NextResponse.json({ appointments: enrichedAppts });
  } catch (error) {
    console.error("[PATIENT-APPTS] Error:", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
