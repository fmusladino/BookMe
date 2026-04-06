import { NextRequest, NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";

/**
 * PATCH /api/clinic/branches/[id]
 * Actualiza una sede.
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const admin = createAdminClient();

  // Verificar que la sede pertenece a una clínica del usuario
  const { data: branch } = await admin
    .from("clinic_branches")
    .select("id, clinic_id")
    .eq("id", id)
    .single();

  if (!branch) {
    return NextResponse.json({ error: "Sede no encontrada" }, { status: 404 });
  }

  // Verificar acceso
  const { data: isOwner } = await supabase
    .from("clinics")
    .select("id")
    .eq("id", branch.clinic_id)
    .eq("owner_id", user.id)
    .single();

  const { data: isAdmin } = await supabase
    .from("clinic_admins")
    .select("clinic_id")
    .eq("clinic_id", branch.clinic_id)
    .eq("profile_id", user.id)
    .single();

  if (!isOwner && !isAdmin) {
    return NextResponse.json({ error: "Sin acceso" }, { status: 403 });
  }

  try {
    const body = (await request.json()) as Record<string, unknown>;
    const updates: Record<string, unknown> = {};

    if (body.name !== undefined) updates.name = body.name || null;
    if (body.address !== undefined) updates.address = body.address;
    if (body.city !== undefined) updates.city = body.city;
    if (body.province !== undefined) updates.province = body.province;
    if (body.phone !== undefined) updates.phone = body.phone || null;
    if (body.email !== undefined) updates.email = body.email || null;
    if (body.is_active !== undefined) updates.is_active = body.is_active;

    const { error } = await admin
      .from("clinic_branches")
      .update(updates)
      .eq("id", id);

    if (error) {
      console.error("[Update Branch]", error);
      return NextResponse.json({ error: "Error al actualizar" }, { status: 500 });
    }

    return NextResponse.json({ message: "Sede actualizada" });
  } catch (error) {
    console.error("[Update Branch]", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

/**
 * DELETE /api/clinic/branches/[id]
 * Elimina una sede (solo si no tiene profesionales asignados).
 */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const admin = createAdminClient();

  const { data: branch } = await admin
    .from("clinic_branches")
    .select("id, clinic_id")
    .eq("id", id)
    .single();

  if (!branch) {
    return NextResponse.json({ error: "Sede no encontrada" }, { status: 404 });
  }

  // Verificar que es dueño
  const { data: isOwner } = await supabase
    .from("clinics")
    .select("id")
    .eq("id", branch.clinic_id)
    .eq("owner_id", user.id)
    .single();

  if (!isOwner) {
    return NextResponse.json({ error: "Solo el dueño puede eliminar sedes" }, { status: 403 });
  }

  // Verificar que no tiene profesionales
  const { count } = await admin
    .from("professionals")
    .select("id", { count: "exact", head: true })
    .eq("branch_id", id);

  if (count && count > 0) {
    return NextResponse.json(
      { error: `No se puede eliminar: hay ${count} profesional(es) asignado(s) a esta sede` },
      { status: 409 }
    );
  }

  const { error } = await admin
    .from("clinic_branches")
    .delete()
    .eq("id", id);

  if (error) {
    console.error("[Delete Branch]", error);
    return NextResponse.json({ error: "Error al eliminar" }, { status: 500 });
  }

  return NextResponse.json({ message: "Sede eliminada" });
}
