export const dynamic = "force-dynamic";

import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { z } from "zod";

const updateServiceSchema = z.object({
  name: z.string().min(2).optional(),
  duration_minutes: z.number().min(5).max(480).optional(),
  price: z.number().min(0).optional().nullable(),
  show_price: z.boolean().optional(),
  is_active: z.boolean().optional(),
  modality: z.enum(["presencial", "virtual", "both"]).optional(),
});

/**
 * GET /api/services/[id] — Obtener un servicio específico
 */
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
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

    const { data, error } = await supabase
      .from("services")
      .select("*")
      .eq("id", id)
      .eq("professional_id", user.id)
      .single();

    if (error || !data) {
      return NextResponse.json(
        { error: "Servicio no encontrado" },
        { status: 404 }
      );
    }

    return NextResponse.json({ service: data });
  } catch (error) {
    console.error("Error GET /api/services/[id]:", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

/**
 * PATCH /api/services/[id] — Actualizar un servicio
 * Body: { name?, duration_minutes?, price?, show_price?, is_active? }
 */
export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
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

    const body = (await request.json()) as unknown;
    const parsed = updateServiceSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          error: "Datos inválidos",
          details: parsed.error.flatten(),
        },
        { status: 400 }
      );
    }

    // Verificar que el servicio pertenece al profesional
    const { data: existing, error: existingError } = await supabase
      .from("services")
      .select("id")
      .eq("id", id)
      .eq("professional_id", user.id)
      .single();

    if (existingError || !existing) {
      return NextResponse.json(
        { error: "Servicio no encontrado" },
        { status: 404 }
      );
    }

    const { data, error } = await supabase
      .from("services")
      .update(parsed.data)
      .eq("id", id)
      .eq("professional_id", user.id)
      .select()
      .single();

    if (error) {
      console.error("Error updating service:", error.message);
      return NextResponse.json(
        { error: "Error al actualizar servicio" },
        { status: 500 }
      );
    }

    return NextResponse.json({ service: data });
  } catch (error) {
    console.error("Error PATCH /api/services/[id]:", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

/**
 * DELETE /api/services/[id] — Eliminar un servicio
 */
export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
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

    // Verificar que el servicio pertenece al profesional
    const { data: existing, error: existingError } = await supabase
      .from("services")
      .select("id")
      .eq("id", id)
      .eq("professional_id", user.id)
      .single();

    if (existingError || !existing) {
      return NextResponse.json(
        { error: "Servicio no encontrado" },
        { status: 404 }
      );
    }

    const { error } = await supabase
      .from("services")
      .delete()
      .eq("id", id)
      .eq("professional_id", user.id);

    if (error) {
      console.error("Error deleting service:", error.message);
      return NextResponse.json(
        { error: "Error al eliminar servicio" },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error DELETE /api/services/[id]:", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
