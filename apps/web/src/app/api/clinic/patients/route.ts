import { NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";

/**
 * GET /api/clinic/patients
 * Retorna todos los pacientes de los profesionales de la clínica.
 */
export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  // Buscar la clínica del admin
  const { data: adminOf } = await supabase
    .from("clinic_admins")
    .select("clinic_id")
    .eq("profile_id", user.id);

  const { data: ownedClinics } = await supabase
    .from("clinics")
    .select("id")
    .eq("owner_id", user.id);

  const clinicIds = new Set<string>();
  adminOf?.forEach((a) => clinicIds.add(a.clinic_id));
  ownedClinics?.forEach((c) => clinicIds.add(c.id));

  if (clinicIds.size === 0) {
    return NextResponse.json({ patients: [] });
  }

  const clinicId = [...clinicIds][0]!;

  // Usar admin client para bypasear RLS en joins con profiles
  const admin = createAdminClient();

  // IDs de profesionales
  const { data: profs } = await admin
    .from("professionals")
    .select("id, profile:profiles(full_name)")
    .eq("clinic_id", clinicId);

  const profIds = profs?.map((p) => p.id) ?? [];

  if (profIds.length === 0) {
    return NextResponse.json({ patients: [] });
  }

  // Mapa de nombres de profesionales
  const profNameMap = new Map<string, string>();
  profs?.forEach((p) => {
    const profile = Array.isArray(p.profile) ? p.profile[0] : p.profile;
    profNameMap.set(p.id, profile?.full_name ?? "Profesional");
  });

  const { data: patients, error } = await admin
    .from("patients")
    .select("id, full_name, dni, email, phone, is_particular, professional_id")
    .in("professional_id", profIds)
    .order("full_name", { ascending: true });

  if (error) {
    console.error("[Clinic Patients] Error:", error);
    return NextResponse.json(
      { error: "Error al cargar pacientes" },
      { status: 500 }
    );
  }

  const enriched = (patients ?? []).map((p) => ({
    ...p,
    professional_name: profNameMap.get(p.professional_id) ?? null,
  }));

  return NextResponse.json({ patients: enriched });
}
