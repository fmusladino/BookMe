import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { verifyMarketingAuth } from "../_lib/auth";
import { z } from "zod";

export const dynamic = "force-dynamic";

/**
 * GET /api/marketing/coupons — Listar cupones (solo lectura).
 * POST /api/marketing/coupons — Crear cupón (marketing puede crear, no modificar).
 */

export async function GET() {
  const authResult = await verifyMarketingAuth();
  if ("error" in authResult) return authResult.error;

  try {
    const supabase = await createClient();

    const { data: coupons, error } = await supabase
      .from("coupons")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("[GET marketing/coupons]", error);
      return NextResponse.json({ error: "Error al obtener cupones" }, { status: 500 });
    }

    return NextResponse.json({ coupons: coupons || [] });
  } catch (error) {
    console.error("[GET marketing/coupons]", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

const createCouponSchema = z.object({
  code: z
    .string()
    .min(3, "El código debe tener al menos 3 caracteres")
    .max(30)
    .transform((v) => v.toUpperCase().replace(/\s+/g, "")),
  discount_pct: z.number().min(1).max(100),
  max_uses: z.number().min(1).nullable().optional(),
  valid_until: z.string().nullable().optional(),
});

export async function POST(request: NextRequest) {
  const authResult = await verifyMarketingAuth();
  if ("error" in authResult) return authResult.error;

  try {
    const body = await request.json();
    const parsed = createCouponSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Datos inválidos", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const supabase = await createClient();

    // Verificar que no exista un cupón con ese código
    const { data: existing } = await supabase
      .from("coupons")
      .select("id")
      .eq("code", parsed.data.code)
      .maybeSingle();

    if (existing) {
      return NextResponse.json({ error: "Ya existe un cupón con ese código" }, { status: 409 });
    }

    const { data: coupon, error } = await supabase
      .from("coupons")
      .insert({
        code: parsed.data.code,
        discount_pct: parsed.data.discount_pct,
        max_uses: parsed.data.max_uses ?? null,
        valid_until: parsed.data.valid_until ?? null,
        is_active: true,
        used_count: 0,
        created_by: authResult.userId,
      })
      .select()
      .single();

    if (error) {
      console.error("[POST marketing/coupons]", error);
      return NextResponse.json({ error: "Error al crear cupón" }, { status: 500 });
    }

    return NextResponse.json({ coupon }, { status: 201 });
  } catch (error) {
    console.error("[POST marketing/coupons]", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
