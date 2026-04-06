import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { UserRole } from "@/types";

/**
 * Verifica que el usuario autenticado sea un superadmin.
 * Retorna { error: NextResponse } si no está autorizado.
 * Retorna { userId: string } si está autorizado.
 */
export async function verifyAdminAuth(requiredRole: UserRole = "superadmin") {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return {
        error: NextResponse.json(
          { error: "No autorizado" },
          { status: 401 }
        ),
      };
    }

    // Buscar el perfil para verificar el rol
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("id, role")
      .eq("id", user.id)
      .single();

    if (profileError || !profile) {
      return {
        error: NextResponse.json(
          { error: "Perfil no encontrado" },
          { status: 404 }
        ),
      };
    }

    if (profile.role !== requiredRole) {
      return {
        error: NextResponse.json(
          { error: "Acceso denegado. Rol insuficiente." },
          { status: 403 }
        ),
      };
    }

    return { userId: user.id };
  } catch (err) {
    console.error("[Admin Auth Error]", err);
    return {
      error: NextResponse.json({ error: "Error interno" }, { status: 500 }),
    };
  }
}
