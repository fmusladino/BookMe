import { NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";

/**
 * GET /api/clinical-records/patient-info
 * Devuelve info de historia clínica disponible para el paciente autenticado.
 * No expone contenido clínico — solo conteos por profesional.
 */
export async function GET() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    // Usar admin client para contar registros clínicos (RLS bloquea al paciente)
    const admin = createAdminClient();

    // Buscar registros de paciente vinculados a este usuario
    const { data: patientRecords } = await admin
      .from("patients")
      .select("id, professional_id")
      .eq("profile_id", user.id);

    if (!patientRecords || patientRecords.length === 0) {
      return NextResponse.json({ professionals: [] });
    }
    const results = [];

    for (const pr of patientRecords) {
      const { count } = await admin
        .from("clinical_records")
        .select("id", { count: "exact", head: true })
        .eq("patient_id", pr.id)
        .eq("professional_id", pr.professional_id);

      if (count && count > 0) {
        // Obtener datos del profesional
        const { data: prof } = await admin
          .from("professionals")
          .select("specialty, profile:profiles!id(full_name)")
          .eq("id", pr.professional_id)
          .single();

        const profProfile = prof?.profile;
        const profName = profProfile
          ? (Array.isArray(profProfile)
              ? profProfile[0]?.full_name
              : (profProfile as { full_name: string })?.full_name) || "Profesional"
          : "Profesional";

        results.push({
          patient_id: pr.id,
          professional_id: pr.professional_id,
          professional_name: profName,
          professional_specialty: prof?.specialty || "",
          record_count: count,
        });
      }
    }

    return NextResponse.json({ professionals: results });
  } catch (error) {
    console.error("Error GET /api/clinical-records/patient-info:", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
