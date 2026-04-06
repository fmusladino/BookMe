import { NextRequest, NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";

// Helper: verificar que el usuario es admin de la clínica del profesional
async function verifyClinicAccess(
  userId: string,
  professionalId: string
): Promise<{ authorized: boolean; clinicId: string | null }> {
  const admin = createAdminClient();

  // Obtener el profesional
  const { data: prof } = await admin
    .from("professionals")
    .select("id, clinic_id, branch_id")
    .eq("id", professionalId)
    .single();

  if (!prof) {
    return { authorized: false, clinicId: null };
  }

  // Obtener clínicas del usuario
  const { data: ownedClinics } = await admin
    .from("clinics")
    .select("id")
    .eq("owner_id", userId);

  const { data: adminOf } = await admin
    .from("clinic_admins")
    .select("clinic_id")
    .eq("profile_id", userId);

  const userClinicIds = new Set<string>();
  ownedClinics?.forEach((c) => userClinicIds.add(c.id));
  adminOf?.forEach((a) => userClinicIds.add(a.clinic_id));

  // Verificar si el profesional pertenece a alguna clínica del usuario
  if (prof.clinic_id && userClinicIds.has(prof.clinic_id)) {
    return { authorized: true, clinicId: prof.clinic_id };
  }

  // También verificar por branch_id
  if (prof.branch_id) {
    const { data: branch } = await admin
      .from("clinic_branches")
      .select("clinic_id")
      .eq("id", prof.branch_id)
      .single();

    if (branch && userClinicIds.has(branch.clinic_id)) {
      return { authorized: true, clinicId: branch.clinic_id };
    }
  }

  return { authorized: false, clinicId: null };
}

/**
 * PATCH /api/clinic/professionals/[id]
 * Actualiza datos de un profesional.
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  const { authorized } = await verifyClinicAccess(user.id, id);
  if (!authorized) {
    return NextResponse.json(
      { error: "No tenés acceso a este profesional" },
      { status: 403 }
    );
  }

  try {
    const body = (await request.json()) as Record<string, unknown>;
    const admin = createAdminClient();

    // Campos editables del profesional
    const profUpdates: Record<string, unknown> = {};
    if (body.specialty !== undefined) {
      profUpdates.specialty = body.specialty;
      profUpdates.specialty_slug = (body.specialty as string)
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "");
    }
    if (body.city !== undefined) profUpdates.city = body.city;
    if (body.province !== undefined) profUpdates.province = body.province;
    if (body.bio !== undefined) profUpdates.bio = body.bio || null;
    if (body.branch_id !== undefined) profUpdates.branch_id = body.branch_id || null;
    if (body.is_visible !== undefined) profUpdates.is_visible = body.is_visible;

    if (Object.keys(profUpdates).length > 0) {
      const { error: profErr } = await admin
        .from("professionals")
        .update(profUpdates)
        .eq("id", id);

      if (profErr) {
        console.error("[Clinic Prof PATCH] prof update error:", profErr);
        return NextResponse.json(
          { error: "Error al actualizar profesional" },
          { status: 500 }
        );
      }
    }

    // Campos editables del perfil
    const profileUpdates: Record<string, unknown> = {};
    if (body.full_name !== undefined) profileUpdates.full_name = body.full_name;
    if (body.phone !== undefined) profileUpdates.phone = body.phone;
    if (body.dni !== undefined) profileUpdates.dni = body.dni;

    if (Object.keys(profileUpdates).length > 0) {
      const { error: profileErr } = await admin
        .from("profiles")
        .update(profileUpdates)
        .eq("id", id);

      if (profileErr) {
        console.error("[Clinic Prof PATCH] profile update error:", profileErr);
        return NextResponse.json(
          { error: "Error al actualizar perfil" },
          { status: 500 }
        );
      }
    }

    return NextResponse.json({ message: "Profesional actualizado" });
  } catch (error) {
    console.error("[Clinic Prof PATCH]", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

/**
 * DELETE /api/clinic/professionals/[id]
 * Elimina un profesional de la clínica.
 */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  const { authorized } = await verifyClinicAccess(user.id, id);
  if (!authorized) {
    return NextResponse.json(
      { error: "No tenés acceso a este profesional" },
      { status: 403 }
    );
  }

  try {
    const admin = createAdminClient();

    // Verificar que no tenga turnos futuros
    const today = new Date().toISOString().split("T")[0];
    const { data: futureAppts } = await admin
      .from("appointments")
      .select("id")
      .eq("professional_id", id)
      .gte("date", today!)
      .in("status", ["confirmed", "pending"])
      .limit(1);

    if (futureAppts && futureAppts.length > 0) {
      return NextResponse.json(
        { error: "No se puede eliminar un profesional con turnos futuros pendientes. Cancelá o reprogramá los turnos primero." },
        { status: 409 }
      );
    }

    // Eliminar en orden: working_hours → schedule_configs → professionals → profile → auth user
    await admin.from("working_hours").delete().eq("professional_id", id);
    await admin.from("schedule_configs").delete().eq("professional_id", id);
    await admin.from("professionals").delete().eq("id", id);
    await admin.from("profiles").delete().eq("id", id);
    await admin.auth.admin.deleteUser(id);

    return NextResponse.json({ message: "Profesional eliminado" });
  } catch (error) {
    console.error("[Clinic Prof DELETE]", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
