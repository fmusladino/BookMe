import { NextRequest, NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";

// Helper: obtener clinic_ids del usuario
async function getUserClinicIds(supabase: Awaited<ReturnType<typeof createClient>>, userId: string): Promise<string[]> {
  const { data: adminOf } = await supabase
    .from("clinic_admins")
    .select("clinic_id")
    .eq("profile_id", userId);

  const { data: ownedClinics } = await supabase
    .from("clinics")
    .select("id")
    .eq("owner_id", userId);

  const ids = new Set<string>();
  adminOf?.forEach((a) => ids.add(a.clinic_id));
  ownedClinics?.forEach((c) => ids.add(c.id));
  return [...ids];
}

/**
 * GET /api/clinic/branches
 * Retorna todas las sedes de los consultorios del admin.
 */
export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const clinicIds = await getUserClinicIds(supabase, user.id);
  if (clinicIds.length === 0) {
    return NextResponse.json({ branches: [], clinics: [] });
  }

  const admin = createAdminClient();

  // Obtener clínicas
  const { data: clinics } = await admin
    .from("clinics")
    .select("id, name, slug")
    .in("id", clinicIds);

  // Obtener sedes
  const { data: branches, error } = await admin
    .from("clinic_branches")
    .select(`id, clinic_id, name, address, city, province, country, phone, email, is_active, created_at`)
    .in("clinic_id", clinicIds)
    .order("created_at", { ascending: true });

  if (error) {
    console.error("[Clinic Branches GET]", error);
    return NextResponse.json({ error: "Error al cargar sedes" }, { status: 500 });
  }

  // Contar profesionales por sede
  const branchIds = (branches ?? []).map((b) => b.id);
  let profCountMap: Record<string, number> = {};

  if (branchIds.length > 0) {
    const { data: profCounts } = await admin
      .from("professionals")
      .select("branch_id")
      .in("branch_id", branchIds);

    profCounts?.forEach((p) => {
      if (p.branch_id) {
        profCountMap[p.branch_id] = (profCountMap[p.branch_id] ?? 0) + 1;
      }
    });
  }

  const enriched = (branches ?? []).map((b) => ({
    ...b,
    professionals_count: profCountMap[b.id] ?? 0,
    clinic_name: clinics?.find((c) => c.id === b.clinic_id)?.name ?? "",
  }));

  return NextResponse.json({ branches: enriched, clinics: clinics ?? [] });
}

/**
 * POST /api/clinic/branches
 * Crea una nueva sede para un consultorio.
 */
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const clinicIds = await getUserClinicIds(supabase, user.id);
  if (clinicIds.length === 0) {
    return NextResponse.json({ error: "No tenés consultorios asociados" }, { status: 403 });
  }

  try {
    const body = (await request.json()) as Record<string, unknown>;
    const clinic_id = (body.clinic_id as string) || clinicIds[0]!;
    const name = (body.name as string) || null;
    const address = body.address as string;
    const city = body.city as string;
    const province = body.province as string;
    const phone = (body.phone as string) || null;
    const email = (body.email as string) || null;

    if (!address || !city || !province) {
      return NextResponse.json(
        { error: "Dirección, ciudad y provincia son obligatorios" },
        { status: 400 }
      );
    }

    if (!clinicIds.includes(clinic_id)) {
      return NextResponse.json({ error: "No tenés acceso a ese consultorio" }, { status: 403 });
    }

    const admin = createAdminClient();
    const { data: branch, error } = await admin
      .from("clinic_branches")
      .insert({
        clinic_id,
        name,
        address,
        city,
        province,
        country: "AR",
        phone,
        email,
      })
      .select("id, clinic_id, name, address, city, province")
      .single();

    if (error) {
      console.error("[Create Branch]", error);
      return NextResponse.json({ error: "Error al crear la sede" }, { status: 500 });
    }

    return NextResponse.json({ message: "Sede creada", branch }, { status: 201 });
  } catch (error) {
    console.error("[Create Branch]", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
