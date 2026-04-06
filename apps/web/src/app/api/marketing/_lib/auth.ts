import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * Verifica que el usuario autenticado sea marketing o superadmin.
 * Marketing puede ver datos pero no modificar configuraciones críticas.
 */
export async function verifyMarketingAuth() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return {
        error: NextResponse.json({ error: "No autorizado" }, { status: 401 }),
      };
    }

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("id, role")
      .eq("id", user.id)
      .single();

    if (profileError || !profile) {
      return {
        error: NextResponse.json({ error: "Perfil no encontrado" }, { status: 404 }),
      };
    }

    // Marketing y superadmin tienen acceso
    if (profile.role !== "marketing" && profile.role !== "superadmin") {
      return {
        error: NextResponse.json({ error: "Acceso denegado" }, { status: 403 }),
      };
    }

    return { userId: user.id, role: profile.role };
  } catch (err) {
    console.error("[Marketing Auth Error]", err);
    return {
      error: NextResponse.json({ error: "Error interno" }, { status: 500 }),
    };
  }
}
