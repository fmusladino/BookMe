import { NextRequest, NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";

/**
 * GET /api/clinic
 * Retorna los consultorios asociados al admin autenticado.
 */
export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  // Consultorios donde es dueño
  const { data: ownedClinics } = await supabase
    .from("clinics")
    .select("id, name, slug, address, city, province, country, phone, email, logo_url, created_at, owner_id")
    .eq("owner_id", user.id);

  // Consultorios donde es admin
  const { data: adminOf } = await supabase
    .from("clinic_admins")
    .select("clinic_id")
    .eq("profile_id", user.id);

  const adminClinicIds = adminOf?.map((a) => a.clinic_id) ?? [];

  // Obtener datos completos de las clínicas admin (excluyendo las que ya son owned)
  const ownedIds = new Set(ownedClinics?.map((c) => c.id) ?? []);
  const extraIds = adminClinicIds.filter((id) => !ownedIds.has(id));

  let adminClinics: typeof ownedClinics = [];
  if (extraIds.length > 0) {
    const { data } = await supabase
      .from("clinics")
      .select("id, name, slug, address, city, province, country, phone, email, logo_url, created_at, owner_id")
      .in("id", extraIds);
    adminClinics = data ?? [];
  }

  // Combinar: owned first, then admin-only
  const allClinics = [
    ...(ownedClinics ?? []).map((c) => ({ ...c, role: "owner" as const })),
    ...(adminClinics ?? []).map((c) => ({ ...c, role: "admin" as const })),
  ];

  return NextResponse.json({ clinics: allClinics });
}

/**
 * POST /api/clinic
 * Crea un nuevo consultorio y asocia al usuario actual como dueño.
 */
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  // Verificar que el usuario tenga rol clinic_admin
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  // Roles permitidos: admin (clinic admin), superadmin
  const allowedRoles = ["admin", "superadmin"];
  if (!profile || !allowedRoles.includes(profile.role)) {
    return NextResponse.json(
      { error: "Solo administradores de consultorio pueden crear uno" },
      { status: 403 }
    );
  }

  try {
    const body = (await request.json()) as Record<string, unknown>;
    const name = body.name as string;
    const address = (body.address as string) || null;
    const city = (body.city as string) || null;
    const province = (body.province as string) || null;
    const phone = (body.phone as string) || null;
    const email = (body.email as string) || null;

    if (!name || !name.trim()) {
      return NextResponse.json(
        { error: "El nombre del consultorio es obligatorio" },
        { status: 400 }
      );
    }

    // Generar slug
    const slug = name
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");

    const admin = createAdminClient();

    // Crear el consultorio
    const { data: clinic, error: clinicError } = await admin
      .from("clinics")
      .insert({
        name: name.trim(),
        slug: `${slug}-${Date.now().toString(36)}`,
        owner_id: user.id,
        address,
        city,
        province,
        country: "AR",
        phone,
        email,
      })
      .select("id, name, slug")
      .single();

    if (clinicError) {
      console.error("[Create Clinic] Error:", clinicError);
      return NextResponse.json(
        { error: "Error al crear el consultorio" },
        { status: 500 }
      );
    }

    // También agregar al usuario como admin del consultorio
    await admin.from("clinic_admins").insert({
      clinic_id: clinic.id,
      profile_id: user.id,
    });

    return NextResponse.json(
      { message: "Consultorio creado", clinic },
      { status: 201 }
    );
  } catch (error) {
    console.error("[Create Clinic]", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

/**
 * PATCH /api/clinic
 * Actualiza los datos del consultorio del admin actual.
 */
export async function PATCH(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  // Buscar el consultorio del usuario
  const { data: ownedClinics } = await supabase
    .from("clinics")
    .select("id")
    .eq("owner_id", user.id);

  const { data: adminOf } = await supabase
    .from("clinic_admins")
    .select("clinic_id")
    .eq("profile_id", user.id);

  const clinicIds = new Set<string>();
  ownedClinics?.forEach((c) => clinicIds.add(c.id));
  adminOf?.forEach((a) => clinicIds.add(a.clinic_id));

  if (clinicIds.size === 0) {
    return NextResponse.json(
      { error: "No tenés un consultorio asociado" },
      { status: 404 }
    );
  }

  const clinicId = [...clinicIds][0]!;

  try {
    const body = (await request.json()) as Record<string, unknown>;

    const updates: Record<string, unknown> = {};
    if (body.name !== undefined) updates.name = body.name;
    if (body.address !== undefined) updates.address = body.address || null;
    if (body.city !== undefined) updates.city = body.city || null;
    if (body.province !== undefined) updates.province = body.province || null;
    if (body.phone !== undefined) updates.phone = body.phone || null;
    if (body.email !== undefined) updates.email = body.email || null;

    const { error } = await supabase
      .from("clinics")
      .update(updates)
      .eq("id", clinicId);

    if (error) {
      console.error("[Update Clinic] Error:", error);
      return NextResponse.json(
        { error: "Error al actualizar" },
        { status: 500 }
      );
    }

    return NextResponse.json({ message: "Consultorio actualizado" });
  } catch (error) {
    console.error("[Update Clinic]", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
