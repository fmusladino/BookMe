import { NextRequest, NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";

/**
 * GET /api/clinic/admins
 * Lista los administradores de la clínica del usuario actual.
 * Incluye staff_role, label, is_active, added_at y log de auditoría.
 */
export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  const admin = createAdminClient();

  // Buscar clínica donde el usuario es owner
  const { data: clinic } = await admin
    .from("clinics")
    .select("id, name, owner_id")
    .eq("owner_id", user.id)
    .single();

  // Si no es owner, buscar si es admin y mostrar los admins de esa clínica
  let clinicId: string;
  let isOwner = false;

  if (clinic) {
    clinicId = clinic.id;
    isOwner = true;
  } else {
    const { data: adminEntry } = await admin
      .from("clinic_admins")
      .select("clinic_id")
      .eq("profile_id", user.id)
      .limit(1)
      .single();

    if (!adminEntry) {
      return NextResponse.json({ error: "No tenés una clínica asociada" }, { status: 404 });
    }
    clinicId = adminEntry.clinic_id;
  }

  // Obtener datos de la clínica incluyendo owner
  const { data: clinicData } = await admin
    .from("clinics")
    .select("id, name, owner_id")
    .eq("id", clinicId)
    .single();

  // Obtener todos los admins de la clínica con los nuevos campos
  const { data: clinicAdmins } = await admin
    .from("clinic_admins")
    .select("profile_id, staff_role, label, is_active, added_by, added_at")
    .eq("clinic_id", clinicId);

  const adminProfileIds = clinicAdmins?.map((a) => a.profile_id) ?? [];

  // Obtener perfiles de los admins
  let adminsWithProfiles: Array<{
    id: string;
    full_name: string;
    phone: string | null;
    role: string;
    email: string | null;
    is_owner: boolean;
    staff_role: string;
    staff_label: string | null;
    is_active: boolean;
    added_at: string | null;
  }> = [];

  if (adminProfileIds.length > 0) {
    const { data: profiles } = await admin
      .from("profiles")
      .select("id, full_name, phone, role")
      .in("id", adminProfileIds);

    // Obtener emails desde auth.users
    const { data: authData } = await admin.auth.admin.listUsers();
    const emailMap = new Map<string, string>();
    authData?.users?.forEach((u) => {
      if (u.email) emailMap.set(u.id, u.email);
    });

    // Crear mapa de clinic_admins para acceder a staff_role, etc.
    const adminDataMap = new Map(
      (clinicAdmins ?? []).map((a) => [a.profile_id, a])
    );

    adminsWithProfiles = (profiles ?? []).map((p) => {
      const ca = adminDataMap.get(p.id);
      return {
        id: p.id,
        full_name: p.full_name ?? "Sin nombre",
        phone: p.phone,
        role: p.role,
        email: emailMap.get(p.id) ?? null,
        is_owner: p.id === clinicData?.owner_id,
        staff_role: ca?.staff_role ?? "secretaria",
        staff_label: ca?.label ?? null,
        is_active: ca?.is_active ?? true,
        added_at: ca?.added_at ?? null,
      };
    });
  }

  // También incluir al owner si no está en clinic_admins
  if (clinicData?.owner_id && !adminProfileIds.includes(clinicData.owner_id)) {
    const { data: ownerProfile } = await admin
      .from("profiles")
      .select("id, full_name, phone, role")
      .eq("id", clinicData.owner_id)
      .single();

    if (ownerProfile) {
      const { data: authData } = await admin.auth.admin.listUsers();
      const ownerEmail = authData?.users?.find((u) => u.id === clinicData.owner_id)?.email ?? null;

      adminsWithProfiles.unshift({
        id: ownerProfile.id,
        full_name: ownerProfile.full_name ?? "Sin nombre",
        phone: ownerProfile.phone,
        role: ownerProfile.role,
        email: ownerEmail,
        is_owner: true,
        staff_role: "gerente",
        staff_label: null,
        is_active: true,
        added_at: null,
      });
    }
  }

  // Ordenar: owner primero, luego activos, luego inactivos
  adminsWithProfiles.sort((a, b) => {
    if (a.is_owner && !b.is_owner) return -1;
    if (!a.is_owner && b.is_owner) return 1;
    if (a.is_active && !b.is_active) return -1;
    if (!a.is_active && b.is_active) return 1;
    return 0;
  });

  // Obtener auditoría si se pide con ?audit=true
  const url = new URL(request.url);
  const includeAudit = url.searchParams.get("audit") === "true";
  let auditLog: Array<{
    id: string;
    target_id: string;
    target_name: string;
    performed_by: string;
    performer_name: string;
    action: string;
    details: Record<string, unknown> | null;
    created_at: string;
  }> = [];

  if (includeAudit) {
    const { data: auditEntries } = await admin
      .from("clinic_admin_audit")
      .select("id, target_id, performed_by, action, details, created_at")
      .eq("clinic_id", clinicId)
      .order("created_at", { ascending: false })
      .limit(50);

    if (auditEntries && auditEntries.length > 0) {
      // Obtener nombres de los involucrados
      const allIds = [
        ...new Set(auditEntries.flatMap((e) => [e.target_id, e.performed_by])),
      ];
      const { data: auditProfiles } = await admin
        .from("profiles")
        .select("id, full_name")
        .in("id", allIds);

      const nameMap = new Map(
        (auditProfiles ?? []).map((p) => [p.id, p.full_name ?? "Sin nombre"])
      );

      auditLog = auditEntries.map((e) => ({
        id: e.id,
        target_id: e.target_id,
        target_name: nameMap.get(e.target_id) ?? "Desconocido",
        performed_by: e.performed_by,
        performer_name: nameMap.get(e.performed_by) ?? "Desconocido",
        action: e.action,
        details: e.details as Record<string, unknown> | null,
        created_at: e.created_at,
      }));
    }
  }

  return NextResponse.json({
    admins: adminsWithProfiles,
    clinic_id: clinicId,
    is_owner: isOwner,
    ...(includeAudit ? { audit_log: auditLog } : {}),
  });
}

/**
 * POST /api/clinic/admins
 * Agrega un admin a la clínica. Solo el owner puede hacerlo.
 * Ahora soporta staff_role y registra en audit log.
 */
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  const admin = createAdminClient();

  // Solo el owner puede agregar admins
  const { data: clinic } = await admin
    .from("clinics")
    .select("id")
    .eq("owner_id", user.id)
    .single();

  if (!clinic) {
    return NextResponse.json(
      { error: "Solo el dueño de la clínica puede agregar administradores" },
      { status: 403 }
    );
  }

  try {
    const body = (await request.json()) as Record<string, unknown>;
    const email = (body.email as string)?.trim()?.toLowerCase();
    const fullName = (body.full_name as string)?.trim();
    const phone = (body.phone as string)?.trim() || null;
    const staffRole = (body.staff_role as string) || "secretaria";
    const staffLabel = (body.label as string)?.trim() || null;

    if (!email) {
      return NextResponse.json({ error: "El email es obligatorio" }, { status: 400 });
    }
    if (!fullName) {
      return NextResponse.json({ error: "El nombre es obligatorio" }, { status: 400 });
    }

    // Validar staff_role
    const validRoles = ["secretaria", "recepcionista", "gerente", "contador", "otro"];
    if (!validRoles.includes(staffRole)) {
      return NextResponse.json({ error: "Rol de staff inválido" }, { status: 400 });
    }

    // Buscar si el usuario ya existe en auth
    const { data: authData } = await admin.auth.admin.listUsers();
    const existingUser = authData?.users?.find((u) => u.email === email);

    let profileId: string;
    let isNewAccount = false;

    if (existingUser) {
      profileId = existingUser.id;

      // Verificar que no sea ya admin de esta clínica
      const { data: existing } = await admin
        .from("clinic_admins")
        .select("profile_id")
        .eq("clinic_id", clinic.id)
        .eq("profile_id", profileId)
        .single();

      if (existing) {
        return NextResponse.json(
          { error: "Este usuario ya es administrador de la clínica" },
          { status: 409 }
        );
      }

      // Actualizar el perfil con rol admin si no lo tiene
      await admin
        .from("profiles")
        .update({ role: "admin", full_name: fullName, phone })
        .eq("id", profileId);
    } else {
      // Crear usuario nuevo con contraseña temporal
      isNewAccount = true;
      const tempPassword = `BookMe${Date.now().toString(36)}!`;
      const { data: newUser, error: createError } = await admin.auth.admin.createUser({
        email,
        password: tempPassword,
        email_confirm: true,
      });

      if (createError || !newUser?.user) {
        console.error("[Create Admin User]", createError);
        return NextResponse.json(
          { error: "Error al crear la cuenta del administrador" },
          { status: 500 }
        );
      }

      profileId = newUser.user.id;

      // Crear perfil
      const { error: profileError } = await admin.from("profiles").insert({
        id: profileId,
        full_name: fullName,
        phone,
        role: "admin",
      });

      if (profileError) {
        console.error("[Create Admin Profile]", profileError);
        await admin.auth.admin.deleteUser(profileId);
        return NextResponse.json(
          { error: "Error al crear el perfil del administrador" },
          { status: 500 }
        );
      }
    }

    // Agregar a clinic_admins con rol de staff
    const { error: linkError } = await admin.from("clinic_admins").insert({
      clinic_id: clinic.id,
      profile_id: profileId,
      staff_role: staffRole,
      label: staffLabel,
      added_by: user.id,
    });

    if (linkError) {
      console.error("[Link Admin]", linkError);
      return NextResponse.json(
        { error: "Error al vincular el administrador a la clínica" },
        { status: 500 }
      );
    }

    // Registrar en audit log
    await admin.from("clinic_admin_audit").insert({
      clinic_id: clinic.id,
      target_id: profileId,
      performed_by: user.id,
      action: "added",
      details: {
        staff_role: staffRole,
        label: staffLabel,
        email,
        full_name: fullName,
        is_new_account: isNewAccount,
      },
    });

    return NextResponse.json(
      {
        message: "Administrador agregado exitosamente",
        is_new_account: isNewAccount,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("[POST /api/clinic/admins]", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
