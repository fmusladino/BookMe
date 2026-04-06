export const dynamic = "force-dynamic";

import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { z } from "zod";

const updateBillingItemSchema = z.object({
  status: z.enum(["pending", "submitted", "paid"]).optional(),
  amount: z.number().min(0).optional(),
  practice_code: z.string().min(1).optional(),
  practice_name: z.string().min(1).optional(),
  facturante_ref: z.string().optional().nullable(),
});

/**
 * GET /api/billing/[id] — Obtener un item de facturación con detalles completos
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
      .from("billing_items")
      .select(
        `id, professional_id, patient_id, appointment_id, insurance_id, practice_code, practice_name, amount, status, period_month, period_year, facturante_ref, created_at,
        patient:patients(full_name, email, phone, dni),
        insurance:insurances(name, code),
        appointment:appointments(starts_at, ends_at, notes)`
      )
      .eq("id", id)
      .eq("professional_id", user.id)
      .single();

    if (error || !data) {
      return NextResponse.json(
        { error: "Item de facturación no encontrado" },
        { status: 404 }
      );
    }

    return NextResponse.json({ billing_item: data });
  } catch (error) {
    console.error("Error GET /api/billing/[id]:", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

/**
 * PATCH /api/billing/[id] — Actualizar item de facturación
 * Body: { status?, amount?, practice_code?, practice_name?, facturante_ref? }
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
    const parsed = updateBillingItemSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          error: "Datos inválidos",
          details: parsed.error.flatten(),
        },
        { status: 400 }
      );
    }

    // Verificar que el item existe y pertenece al profesional
    const { data: existing, error: existingError } = await supabase
      .from("billing_items")
      .select("id, status")
      .eq("id", id)
      .eq("professional_id", user.id)
      .single();

    if (existingError || !existing) {
      return NextResponse.json(
        { error: "Item de facturación no encontrado" },
        { status: 404 }
      );
    }

    // Actualizar
    const { data, error } = await supabase
      .from("billing_items")
      .update(parsed.data)
      .eq("id", id)
      .eq("professional_id", user.id)
      .select()
      .single();

    if (error) {
      console.error("Error updating billing item:", error.message);
      return NextResponse.json(
        { error: "Error al actualizar item de facturación" },
        { status: 500 }
      );
    }

    return NextResponse.json({ billing_item: data });
  } catch (error) {
    console.error("Error PATCH /api/billing/[id]:", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

/**
 * DELETE /api/billing/[id] — Eliminar item de facturación (solo si está en pending)
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

    // Verificar que el item existe, pertenece al profesional y está en pending
    const { data: existing, error: existingError } = await supabase
      .from("billing_items")
      .select("id, status")
      .eq("id", id)
      .eq("professional_id", user.id)
      .single();

    if (existingError || !existing) {
      return NextResponse.json(
        { error: "Item de facturación no encontrado" },
        { status: 404 }
      );
    }

    if (existing.status !== "pending") {
      return NextResponse.json(
        {
          error: "Solo se pueden eliminar items en estado 'pending'",
        },
        { status: 409 }
      );
    }

    const { error } = await supabase
      .from("billing_items")
      .delete()
      .eq("id", id)
      .eq("professional_id", user.id);

    if (error) {
      console.error("Error deleting billing item:", error.message);
      return NextResponse.json(
        { error: "Error al eliminar item de facturación" },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error) {
    console.error("Error DELETE /api/billing/[id]:", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
