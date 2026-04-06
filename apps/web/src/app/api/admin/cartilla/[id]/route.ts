import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { verifyAdminAuth } from "../../_lib/auth";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * PATCH /api/admin/cartilla/[id] — Cambiar visibilidad en cartilla (superadmin)
 * Body: { is_visible: boolean }
 */
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  const authResult = await verifyAdminAuth("superadmin");
  if ("error" in authResult) return authResult.error;

  try {
    const { id } = await params;
    const body = await request.json() as { is_visible: boolean };

    if (typeof body.is_visible !== "boolean") {
      return NextResponse.json({ error: "is_visible debe ser boolean" }, { status: 400 });
    }

    const admin = createAdminClient();

    // Verificar que existe el profesional
    const { data: existing, error: fetchErr } = await admin
      .from("professionals")
      .select("id, is_visible")
      .eq("id", id)
      .single();

    if (fetchErr || !existing) {
      return NextResponse.json({ error: "Profesional no encontrado" }, { status: 404 });
    }

    // Actualizar visibilidad
    // Si la migración 00014 fue aplicada, también guardamos auditoría
    const now = new Date().toISOString();
    const updateData: Record<string, unknown> = {
      is_visible: body.is_visible,
    };

    // Intentar con campos de auditoría primero
    if (body.is_visible) {
      updateData.directory_approved_by = authResult.userId;
      updateData.directory_approved_at = now;
    } else {
      updateData.directory_hidden_by = authResult.userId;
      updateData.directory_hidden_at = now;
    }

    let { error: updateErr } = await admin
      .from("professionals")
      .update(updateData)
      .eq("id", id);

    // Si falla por columnas inexistentes, reintentar solo con is_visible
    if (updateErr) {
      const fallback = await admin
        .from("professionals")
        .update({ is_visible: body.is_visible })
        .eq("id", id);
      updateErr = fallback.error;
    }

    if (updateErr) {
      console.error("Error updating cartilla visibility:", updateErr);
      return NextResponse.json({ error: "Error al actualizar" }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      is_visible: body.is_visible,
      message: body.is_visible ? "Profesional publicado en cartilla" : "Profesional ocultado de cartilla",
    });
  } catch (err) {
    console.error("Error PATCH /api/admin/cartilla/[id]:", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
