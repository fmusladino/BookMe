import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { verifyAdminAuth } from "../../_lib/auth";
import { z } from "zod";

const updateCouponSchema = z.object({
  code: z.string().min(3).max(30).optional(),
  discount_pct: z.number().min(1).max(100).optional(),
  max_uses: z.number().min(1).nullable().optional(),
  valid_until: z.string().nullable().optional(),
  is_active: z.boolean().optional(),
});

/**
 * PUT /api/admin/cupones/:id — Actualiza un cupón existente.
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = await verifyAdminAuth("superadmin");
  if ("error" in authResult) return authResult.error;

  const { id } = await params;

  try {
    const body = await request.json();
    const parsed = updateCouponSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Datos inválidos", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const supabase = await createClient();

    const updates: Record<string, unknown> = {};
    if (parsed.data.discount_pct !== undefined) updates.discount_pct = parsed.data.discount_pct;
    if (parsed.data.max_uses !== undefined) updates.max_uses = parsed.data.max_uses;
    if (parsed.data.valid_until !== undefined) updates.valid_until = parsed.data.valid_until;
    if (parsed.data.is_active !== undefined) updates.is_active = parsed.data.is_active;

    const { data: coupon, error } = await supabase
      .from("coupons")
      .update(updates)
      .eq("id", id)
      .select()
      .single();

    if (error) {
      console.error("[PUT admin/cupones/:id]", error);
      return NextResponse.json({ error: "Error al actualizar cupón" }, { status: 500 });
    }

    return NextResponse.json({ coupon });
  } catch (error) {
    console.error("[PUT admin/cupones/:id]", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

/**
 * PATCH /api/admin/cupones/:id/toggle — Activa/desactiva un cupón.
 * Nota: Next.js App Router no soporta sub-rutas como /toggle en un [id] segment,
 * así que usamos PATCH en la misma ruta para toggle.
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = await verifyAdminAuth("superadmin");
  if ("error" in authResult) return authResult.error;

  const { id } = await params;

  try {
    const body = await request.json();
    const isActive = body.is_active as boolean;

    if (typeof isActive !== "boolean") {
      return NextResponse.json({ error: "is_active debe ser boolean" }, { status: 400 });
    }

    const supabase = await createClient();

    const { data: coupon, error } = await supabase
      .from("coupons")
      .update({ is_active: isActive })
      .eq("id", id)
      .select()
      .single();

    if (error) {
      console.error("[PATCH admin/cupones/:id]", error);
      return NextResponse.json({ error: "Error al actualizar cupón" }, { status: 500 });
    }

    return NextResponse.json({ coupon });
  } catch (error) {
    console.error("[PATCH admin/cupones/:id]", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
