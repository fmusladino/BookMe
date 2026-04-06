export const dynamic = "force-dynamic";

import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { z } from "zod";

const createInsuranceSchema = z.object({
  name: z.string().min(1, "Nombre de seguro requerido"),
  code: z.string().min(1, "Código de seguro requerido").optional(),
  logo_url: z.string().url().optional().nullable(),
});

/**
 * GET /api/insurances — Listar seguros activos (público, sin autenticación requerida)
 * Usado para dropdowns en formularios de pacientes
 */
export async function GET() {
  try {
    const supabase = await createClient();

    const { data, error } = await supabase
      .from("insurances")
      .select("id, name, code, logo_url, is_active")
      .eq("is_active", true)
      .order("name", { ascending: true });

    if (error) {
      console.error("Supabase error insurances:", error.message);
      return NextResponse.json(
        { error: "Error al obtener seguros" },
        { status: 500 }
      );
    }

    return NextResponse.json({ insurances: data });
  } catch (error) {
    console.error("Error GET /api/insurances:", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

/**
 * POST /api/insurances — Crear nuevo seguro (admin only)
 * Body: { name, code?, logo_url? }
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: "No autorizado" },
        { status: 401 }
      );
    }

    // Verificar que sea admin o superadmin
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("id, role")
      .eq("id", user.id)
      .single();

    if (profileError || !profile) {
      return NextResponse.json(
        { error: "Perfil no encontrado" },
        { status: 404 }
      );
    }

    if (profile.role !== "admin" && profile.role !== "superadmin") {
      return NextResponse.json(
        { error: "Acceso denegado. Solo administradores pueden crear seguros." },
        { status: 403 }
      );
    }

    const body = (await request.json()) as unknown;
    const parsed = createInsuranceSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          error: "Datos inválidos",
          details: parsed.error.flatten(),
        },
        { status: 400 }
      );
    }

    const { data, error } = await supabase
      .from("insurances")
      .insert({
        ...parsed.data,
        is_active: true,
      })
      .select()
      .single();

    if (error) {
      // Verificar si es un error de unicidad (código duplicado)
      if (error.code === "23505") {
        return NextResponse.json(
          { error: "El código de seguro ya existe" },
          { status: 409 }
        );
      }
      console.error("Error creating insurance:", error.message);
      return NextResponse.json(
        { error: "Error al crear seguro" },
        { status: 500 }
      );
    }

    return NextResponse.json({ insurance: data }, { status: 201 });
  } catch (error) {
    console.error("Error POST /api/insurances:", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
