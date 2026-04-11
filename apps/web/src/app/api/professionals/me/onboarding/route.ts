export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";

/**
 * GET /api/professionals/me/onboarding
 * Devuelve si el profesional ya completó el onboarding.
 */
export async function GET() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authErr,
    } = await supabase.auth.getUser();
    if (authErr || !user) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const admin = createAdminClient();
    const { data, error } = await admin
      .from("professionals")
      .select("onboarding_completed, onboarding_completed_at")
      .eq("id", user.id)
      .single();

    if (error || !data) {
      return NextResponse.json(
        { error: "Profesional no encontrado" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      onboarding_completed: data.onboarding_completed,
      onboarding_completed_at: data.onboarding_completed_at,
    });
  } catch {
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

/**
 * PATCH /api/professionals/me/onboarding
 * Marca el onboarding como completado.
 */
export async function PATCH() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authErr,
    } = await supabase.auth.getUser();
    if (authErr || !user) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const admin = createAdminClient();
    const { error } = await admin
      .from("professionals")
      .update({
        onboarding_completed: true,
        onboarding_completed_at: new Date().toISOString(),
      })
      .eq("id", user.id);

    if (error) {
      return NextResponse.json(
        { error: "Error al actualizar" },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
