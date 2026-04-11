import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { z } from "zod";

const updatePrestacionSchema = z.object({
  insurance_id: z.string().uuid().optional(),
  code: z.string().min(1).optional(),
  description: z.string().min(2).optional(),
  amount: z.number().min(0).optional(),
  valid_from: z.string().optional(),
  valid_until: z.string().optional().nullable(),
  is_active: z.boolean().optional(),
});

// PATCH /api/prestaciones/[id] — Actualizar prestación
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    // Verificar que la prestación pertenece al profesional
    const { data: existing } = await supabase
      .from("prestaciones")
      .select("id, professional_id")
      .eq("id", id)
      .single();

    if (!existing) {
      return NextResponse.json({ error: "Prestación no encontrada" }, { status: 404 });
    }
    if (existing.professional_id !== user.id) {
      return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    }

    const body = (await request.json()) as unknown;
    const parsed = updatePrestacionSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Datos inválidos", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { data, error } = await supabase
      .from("prestaciones")
      .update(parsed.data)
      .eq("id", id)
      .select("*, insurance:insurances(id, name, code, logo_url)")
      .single();

    if (error) {
      console.error("Error al actualizar prestación:", error);
      return NextResponse.json(
        { error: "Error al actualizar prestación" },
        { status: 500 }
      );
    }

    return NextResponse.json({ prestacion: data });
  } catch (error) {
    console.error("Error PATCH /api/prestaciones/[id]:", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

// DELETE /api/prestaciones/[id] — Eliminar prestación (soft delete: is_active = false)
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const { data: existing } = await supabase
      .from("prestaciones")
      .select("id, professional_id")
      .eq("id", id)
      .single();

    if (!existing) {
      return NextResponse.json({ error: "Prestación no encontrada" }, { status: 404 });
    }
    if (existing.professional_id !== user.id) {
      return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    }

    // Soft delete
    const { error } = await supabase
      .from("prestaciones")
      .update({ is_active: false })
      .eq("id", id);

    if (error) {
      console.error("Error al eliminar prestación:", error);
      return NextResponse.json(
        { error: "Error al eliminar prestación" },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error DELETE /api/prestaciones/[id]:", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
