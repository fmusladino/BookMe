import { NextResponse, type NextRequest } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";

/**
 * PATCH /api/professionals/me/meet-url — Actualizar link de Google Meet del profesional
 * Body: { default_meet_url: string | null }
 */
export async function PATCH(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authErr } = await supabase.auth.getUser();
    if (authErr || !user) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const body = await request.json() as { default_meet_url: string | null };

    // Validar formato de URL si se proporciona
    if (body.default_meet_url && typeof body.default_meet_url === "string") {
      const url = body.default_meet_url.trim();
      if (url && !url.startsWith("https://meet.google.com/")) {
        return NextResponse.json(
          { error: "El link debe ser de Google Meet (https://meet.google.com/...)" },
          { status: 400 }
        );
      }
    }

    const admin = createAdminClient();

    const { error: updateErr } = await admin
      .from("professionals")
      .update({ default_meet_url: body.default_meet_url || null })
      .eq("id", user.id);

    if (updateErr) {
      return NextResponse.json({ error: "Error al actualizar" }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      default_meet_url: body.default_meet_url || null,
    });
  } catch {
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
