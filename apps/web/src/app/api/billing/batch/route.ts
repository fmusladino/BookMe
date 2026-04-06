export const dynamic = "force-dynamic";

import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { z } from "zod";

const batchUpdateBillingSchema = z.object({
  ids: z.array(z.string().uuid(), {
    errorMap: () => ({
      message: "IDs debe ser un array de UUIDs válidos",
    }),
  }),
  status: z.enum(["submitted", "paid"], {
    errorMap: () => ({
      message: 'Estado debe ser "submitted" o "paid"',
    }),
  }),
  facturante_ref: z.string().optional(),
});

/**
 * POST /api/billing/batch — Actualizar múltiples items de facturación
 * Usado cuando el profesional envía un lote de items a la aseguradora
 *
 * Body: {
 *   ids: string[],           // UUIDs de items a actualizar
 *   status: "submitted"|"paid",  // Nuevo estado
 *   facturante_ref?: string  // Referencia de Facturante/Factura.ai (opcional)
 * }
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

    // Verificar que sea profesional
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("id, role")
      .eq("id", user.id)
      .single();

    if (profileError || !profile || profile.role !== "professional") {
      return NextResponse.json(
        { error: "Solo profesionales pueden actualizar facturación" },
        { status: 403 }
      );
    }

    const body = (await request.json()) as unknown;
    const parsed = batchUpdateBillingSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          error: "Datos inválidos",
          details: parsed.error.flatten(),
        },
        { status: 400 }
      );
    }

    const { ids, status, facturante_ref } = parsed.data;

    // Validar que no haya ids duplicados
    if (new Set(ids).size !== ids.length) {
      return NextResponse.json(
        { error: "No se permiten IDs duplicados" },
        { status: 400 }
      );
    }

    // Verificar que todos los items pertenecen al profesional
    const { data: items, error: itemsError } = await supabase
      .from("billing_items")
      .select("id, professional_id, status")
      .in("id", ids);

    if (itemsError || !items) {
      return NextResponse.json(
        { error: "Error al obtener items" },
        { status: 500 }
      );
    }

    if (items.length !== ids.length) {
      return NextResponse.json(
        {
          error: `Algunos items no fueron encontrados. Se encontraron ${items.length} de ${ids.length}`,
        },
        { status: 404 }
      );
    }

    // Verificar que todos pertenecen al usuario
    const allBelongToUser = items.every((i) => i.professional_id === user.id);
    if (!allBelongToUser) {
      return NextResponse.json(
        {
          error: "Algunos items no pertenecen a este profesional",
        },
        { status: 403 }
      );
    }

    // Preparar datos de actualización
    const updateData: Record<string, unknown> = { status };
    if (facturante_ref) {
      updateData.facturante_ref = facturante_ref;
    }

    // Actualizar todos los items
    const { data: updated, error: updateError } = await supabase
      .from("billing_items")
      .update(updateData)
      .in("id", ids)
      .select();

    if (updateError) {
      console.error("Error updating billing items:", updateError.message);
      return NextResponse.json(
        { error: "Error al actualizar items de facturación" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      updated_count: updated?.length || 0,
      items: updated || [],
    });
  } catch (error) {
    console.error("Error POST /api/billing/batch:", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
