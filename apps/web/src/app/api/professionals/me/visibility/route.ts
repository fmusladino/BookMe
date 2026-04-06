import { NextResponse, type NextRequest } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";

/**
 * GET /api/professionals/me/visibility — Estado actual de visibilidad en cartilla
 */
export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authErr } = await supabase.auth.getUser();
    if (authErr || !user) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const admin = createAdminClient();
    const { data, error } = await admin
      .from("professionals")
      .select("is_visible")
      .eq("id", user.id)
      .single();

    if (error || !data) {
      return NextResponse.json({ error: "Profesional no encontrado" }, { status: 404 });
    }

    return NextResponse.json({ is_visible: data.is_visible });
  } catch {
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

/**
 * PATCH /api/professionals/me/visibility — Toggle visibilidad en cartilla (profesional)
 * Body: { is_visible: boolean }
 */
export async function PATCH(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authErr } = await supabase.auth.getUser();
    if (authErr || !user) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const body = await request.json() as { is_visible: boolean };
    if (typeof body.is_visible !== "boolean") {
      return NextResponse.json({ error: "is_visible debe ser boolean" }, { status: 400 });
    }

    const admin = createAdminClient();

    // Verificar que es un profesional
    const { data: existing, error: fetchErr } = await admin
      .from("professionals")
      .select("id, is_visible")
      .eq("id", user.id)
      .single();

    if (fetchErr || !existing) {
      return NextResponse.json({ error: "Profesional no encontrado" }, { status: 404 });
    }

    // Actualizar — sin campos de admin audit (el profesional se gestiona solo)
    const { error: updateErr } = await admin
      .from("professionals")
      .update({ is_visible: body.is_visible })
      .eq("id", user.id);

    if (updateErr) {
      return NextResponse.json({ error: "Error al actualizar" }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      is_visible: body.is_visible,
    });
  } catch {
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
