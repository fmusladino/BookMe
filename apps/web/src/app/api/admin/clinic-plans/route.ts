import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { z } from "zod";
import { verifyAdminAuth } from "../_lib/auth";

// ─── GET /api/admin/clinic-plans ──────────────────────────────
export async function GET() {
  const authResult = await verifyAdminAuth("superadmin");
  if ("error" in authResult) return authResult.error;

  try {
    const admin = createAdminClient();
    const { data, error } = await admin
      .from("clinic_plan_prices")
      .select("*")
      .order("plan")
      .order("billing_cycle");

    if (error) {
      console.error("[GET clinic_plan_prices]", error);
      return NextResponse.json({ error: "Error al obtener precios de consultorio" }, { status: 500 });
    }

    return NextResponse.json({ prices: data });
  } catch (err) {
    console.error("[GET clinic-plans]", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

// ─── PUT /api/admin/clinic-plans ──────────────────────────────
const updateSchema = z.object({
  id: z.string().uuid(),
  price_usd: z.number().min(0),
  is_active: z.boolean().optional(),
});

export async function PUT(request: NextRequest) {
  const authResult = await verifyAdminAuth("superadmin");
  if ("error" in authResult) return authResult.error;

  try {
    const body = await request.json();
    const parsed = updateSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Datos inválidos", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { id, price_usd, is_active } = parsed.data;
    const admin = createAdminClient();

    const updateData: Record<string, unknown> = { price_usd };
    if (is_active !== undefined) updateData.is_active = is_active;

    const { data, error } = await admin
      .from("clinic_plan_prices")
      .update(updateData)
      .eq("id", id)
      .select()
      .single();

    if (error) {
      console.error("[PUT clinic_plan_prices]", error);
      return NextResponse.json({ error: "Error al actualizar precio" }, { status: 500 });
    }

    return NextResponse.json({ price: data });
  } catch (err) {
    console.error("[PUT clinic-plans]", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
