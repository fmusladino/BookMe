import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { z } from "zod";
import { verifyAdminAuth } from "../../_lib/auth";

// ─── Schemas ────────────────────────────────────────────────

const updateUserSchema = z.object({
  full_name: z.string().min(1).optional(),
  dni: z.string().min(1).optional(),
  phone: z.string().optional(),
  role: z.enum(["professional", "patient", "admin", "superadmin", "marketing"]).optional(),
  email: z.string().email().optional(),
  password: z.string().min(6).optional(),
});

// ─── GET /api/admin/users/:id ───────────────────────────────

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = await verifyAdminAuth("superadmin");
  if ("error" in authResult) return authResult.error;

  const { id } = await params;
  const admin = createAdminClient();

  try {
    const { data: profile, error } = await admin
      .from("profiles")
      .select("id, full_name, role, dni, phone, created_at")
      .eq("id", id)
      .single();

    if (error || !profile) {
      return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 });
    }

    // Obtener email
    const { data: authData } = await admin.auth.admin.getUserById(id);
    const email = authData?.user?.email ?? null;

    // Verificar si es owner de alguna clínica
    const { data: ownedClinic } = await admin
      .from("clinics")
      .select("id, name")
      .eq("owner_id", id)
      .single();

    return NextResponse.json({
      user: {
        ...profile,
        email,
        is_clinic_owner: !!ownedClinic,
        clinic_name: ownedClinic?.name ?? null,
      },
    });
  } catch (error) {
    console.error("[GET user/:id]", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

// ─── PATCH /api/admin/users/:id ─────────────────────────────

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = await verifyAdminAuth("superadmin");
  if ("error" in authResult) return authResult.error;

  const { id } = await params;

  try {
    const body = (await request.json()) as unknown;
    const parsed = updateUserSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Datos inválidos", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const admin = createAdminClient();

    // Verificar que el usuario existe
    const { data: existing } = await admin
      .from("profiles")
      .select("id")
      .eq("id", id)
      .single();

    if (!existing) {
      return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 });
    }

    // Actualizar perfil (campos que van a profiles)
    const profileUpdates: Record<string, unknown> = {};
    if (parsed.data.full_name !== undefined) profileUpdates.full_name = parsed.data.full_name;
    if (parsed.data.dni !== undefined) profileUpdates.dni = parsed.data.dni;
    if (parsed.data.phone !== undefined) profileUpdates.phone = parsed.data.phone || null;
    if (parsed.data.role !== undefined) profileUpdates.role = parsed.data.role;

    if (Object.keys(profileUpdates).length > 0) {
      const { error: profileError } = await admin
        .from("profiles")
        .update(profileUpdates)
        .eq("id", id);

      if (profileError) {
        console.error("[PATCH profile]", profileError);
        return NextResponse.json({ error: "Error al actualizar perfil" }, { status: 500 });
      }
    }

    // Actualizar auth (email y/o password)
    const authUpdates: Record<string, unknown> = {};
    if (parsed.data.email !== undefined) authUpdates.email = parsed.data.email;
    if (parsed.data.password !== undefined) authUpdates.password = parsed.data.password;

    // Si se cambia el rol, también actualizar app_metadata
    if (parsed.data.role !== undefined) {
      authUpdates.app_metadata = { role: parsed.data.role };
    }

    if (Object.keys(authUpdates).length > 0) {
      const { error: authError } = await admin.auth.admin.updateUserById(id, authUpdates);

      if (authError) {
        console.error("[PATCH auth]", authError);
        return NextResponse.json({ error: "Error al actualizar cuenta" }, { status: 500 });
      }
    }

    return NextResponse.json({ message: "Usuario actualizado exitosamente" });
  } catch (error) {
    console.error("[PATCH user/:id]", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

// ─── DELETE /api/admin/users/:id ────────────────────────────

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = await verifyAdminAuth("superadmin");
  if ("error" in authResult) return authResult.error;

  const { id } = await params;
  const admin = createAdminClient();

  try {
    // No permitir eliminarse a uno mismo
    if (authResult.userId === id) {
      return NextResponse.json(
        { error: "No podés eliminarte a vos mismo" },
        { status: 400 }
      );
    }

    // Verificar que el usuario existe
    const { data: profile } = await admin
      .from("profiles")
      .select("id, role, full_name")
      .eq("id", id)
      .single();

    if (!profile) {
      return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 });
    }

    // Verificar si es owner de alguna clínica — avisar pero permitir
    const { data: ownedClinics } = await admin
      .from("clinics")
      .select("id, name")
      .eq("owner_id", id);

    // Eliminar perfil (CASCADE eliminará registros relacionados)
    const { error: profileError } = await admin
      .from("profiles")
      .delete()
      .eq("id", id);

    if (profileError) {
      console.error("[DELETE profile]", profileError);
      return NextResponse.json({ error: "Error al eliminar perfil" }, { status: 500 });
    }

    // Eliminar de auth
    const { error: authError } = await admin.auth.admin.deleteUser(id);

    if (authError) {
      console.error("[DELETE auth]", authError);
      // El perfil ya se eliminó, logear pero no fallar
    }

    return NextResponse.json({
      message: "Usuario eliminado exitosamente",
      had_clinics: (ownedClinics?.length ?? 0) > 0,
      clinic_names: ownedClinics?.map((c) => c.name) ?? [],
    });
  } catch (error) {
    console.error("[DELETE user/:id]", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
