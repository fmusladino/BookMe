import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { z } from "zod";
import { verifyAdminAuth } from "../_lib/auth";

// ─── GET /api/admin/plans ─────────────────────────────────────
// Devuelve todos los plan_prices agrupados por línea
export async function GET() {
  const authResult = await verifyAdminAuth("superadmin");
  if ("error" in authResult) return authResult.error;

  try {
    const admin = createAdminClient();
    const { data, error } = await admin
      .from("plan_prices")
      .select("*")
      .order("line")
      .order("plan")
      .order("billing_cycle");

    if (error) {
      console.error("[GET plan_prices]", error);
      return NextResponse.json({ error: "Error al obtener planes" }, { status: 500 });
    }

    return NextResponse.json({ plans: data });
  } catch (err) {
    console.error("[GET plans]", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

// ─── PUT /api/admin/plans ─────────────────────────────────────
// Actualiza el precio de un plan existente
const updatePriceSchema = z.object({
  id: z.string().uuid(),
  price_usd: z.number().min(0),
  is_active: z.boolean().optional(),
});

export async function PUT(request: NextRequest) {
  const authResult = await verifyAdminAuth("superadmin");
  if ("error" in authResult) return authResult.error;

  try {
    const body = await request.json();
    const parsed = updatePriceSchema.safeParse(body);

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
      .from("plan_prices")
      .update(updateData)
      .eq("id", id)
      .select()
      .single();

    if (error) {
      console.error("[PUT plan_prices]", error);
      return NextResponse.json({ error: "Error al actualizar precio" }, { status: 500 });
    }

    return NextResponse.json({ plan: data });
  } catch (err) {
    console.error("[PUT plans]", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

// ─── POST /api/admin/plans ────────────────────────────────────
// Crea un nuevo precio de plan
const createPriceSchema = z.object({
  line: z.enum(["healthcare", "business"]),
  plan: z.enum(["free", "base", "standard", "premium"]),
  billing_cycle: z.enum(["monthly", "annual"]),
  price_usd: z.number().min(0),
});

export async function POST(request: NextRequest) {
  const authResult = await verifyAdminAuth("superadmin");
  if ("error" in authResult) return authResult.error;

  try {
    const body = await request.json();
    const parsed = createPriceSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Datos inválidos", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const admin = createAdminClient();
    const { data, error } = await admin
      .from("plan_prices")
      .upsert(parsed.data, { onConflict: "line,plan,billing_cycle" })
      .select()
      .single();

    if (error) {
      console.error("[POST plan_prices]", error);
      return NextResponse.json({ error: "Error al crear precio: " + error.message }, { status: 500 });
    }

    return NextResponse.json({ plan: data }, { status: 201 });
  } catch (err) {
    console.error("[POST plans]", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
