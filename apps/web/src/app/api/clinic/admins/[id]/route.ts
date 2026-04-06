import { NextRequest, NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";

/**
 * PATCH /api/clinic/admins/:id
 * Actualiza el rol de staff o estado de un admin. Solo el owner puede hacerlo.
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: adminId } = await params;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  const admin = createAdminClient();

  // Solo el owner puede modificar admins
  const { data: clinic } = await admin
    .from("clinics")
    .select("id, owner_id")
    .eq("owner_id", user.id)
    .single();

  if (!clinic) {
    return NextResponse.json(
      { error: "Solo el dueño de la clínica puede modificar administradores" },
      { status: 403 }
    );
  }

  // No se puede modificar al owner
  if (adminId === clinic.owner_id) {
    return NextResponse.json(
      { error: "No se puede modificar al dueño de la clínica" },
      { status: 400 }
    );
  }

  try {
    const body = (await request.json()) as Record<string, unknown>;

    // Obtener estado actual antes de cambiar
    const { data: currentAdmin } = await admin
      .from("clinic_admins")
      .select("staff_role, label, is_active")
      .eq("clinic_id", clinic.id)
      .eq("profile_id", adminId)
      .single();

    if (!currentAdmin) {
      return NextResponse.json({ error: "Admin no encontrado" }, { status: 404 });
    }

    const updates: Record<string, unknown> = {};
    const auditDetails: Record<string, unknown> = {};

    // Actualizar staff_role
    if (body.staff_role !== undefined) {
      const validRoles = ["secretaria", "recepcionista", "gerente", "contador", "otro"];
      if (!validRoles.includes(body.staff_role as string)) {
        return NextResponse.json({ error: "Rol de staff inválido" }, { status: 400 });
      }
      updates.staff_role = body.staff_role;
      auditDetails.old_role = currentAdmin.staff_role;
      auditDetails.new_role = body.staff_role;
    }

    // Actualizar label
    if (body.label !== undefined) {
      updates.label = (body.label as string)?.trim() || null;
    }

    // Activar/desactivar
    if (body.is_active !== undefined) {
      updates.is_active = body.is_active;
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: "No hay campos para actualizar" }, { status: 400 });
    }

    const { error } = await admin
      .from("clinic_admins")
      .update(updates)
      .eq("clinic_id", clinic.id)
      .eq("profile_id", adminId);

    if (error) {
      console.error("[Patch Admin]", error);
      return NextResponse.json({ error: "Error al actualizar" }, { status: 500 });
    }

    // Determinar la acción del audit
    let auditAction = "role_changed";
    if (body.is_active === false) auditAction = "deactivated";
    if (body.is_active === true && !currentAdmin.is_active) auditAction = "reactivated";

    await admin.from("clinic_admin_audit").insert({
      clinic_id: clinic.id,
      target_id: adminId,
      performed_by: user.id,
      action: auditAction,
      details: { ...auditDetails, updates },
    });

    return NextResponse.json({ message: "Administrador actualizado" });
  } catch (error) {
    console.error("[PATCH /api/clinic/admins/:id]", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

/**
 * DELETE /api/clinic/admins/:id
 * Elimina un admin de la clínica. Solo el owner puede hacerlo.
 * Registra la acción en el audit log.
 */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: adminId } = await params;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  const admin = createAdminClient();

  // Solo el owner puede eliminar admins
  const { data: clinic } = await admin
    .from("clinics")
    .select("id, owner_id")
    .eq("owner_id", user.id)
    .single();

  if (!clinic) {
    return NextResponse.json(
      { error: "Solo el dueño de la clínica puede eliminar administradores" },
      { status: 403 }
    );
  }

  // No se puede eliminar al owner
  if (adminId === clinic.owner_id) {
    return NextResponse.json(
      { error: "No se puede eliminar al dueño de la clínica" },
      { status: 400 }
    );
  }

  // No se puede eliminar a uno mismo
  if (adminId === user.id) {
    return NextResponse.json(
      { error: "No podés eliminarte a vos mismo" },
      { status: 400 }
    );
  }

  // Obtener info del admin antes de eliminar para el audit
  const { data: adminInfo } = await admin
    .from("clinic_admins")
    .select("staff_role, label")
    .eq("clinic_id", clinic.id)
    .eq("profile_id", adminId)
    .single();

  const { data: adminProfile } = await admin
    .from("profiles")
    .select("full_name")
    .eq("id", adminId)
    .single();

  // Eliminar de clinic_admins
  const { error } = await admin
    .from("clinic_admins")
    .delete()
    .eq("clinic_id", clinic.id)
    .eq("profile_id", adminId);

  if (error) {
    console.error("[Delete Admin]", error);
    return NextResponse.json(
      { error: "Error al eliminar el administrador" },
      { status: 500 }
    );
  }

  // Registrar en audit log
  await admin.from("clinic_admin_audit").insert({
    clinic_id: clinic.id,
    target_id: adminId,
    performed_by: user.id,
    action: "removed",
    details: {
      full_name: adminProfile?.full_name ?? "Desconocido",
      staff_role: adminInfo?.staff_role ?? null,
      label: adminInfo?.label ?? null,
    },
  });

  return NextResponse.json({ message: "Administrador eliminado" });
}
