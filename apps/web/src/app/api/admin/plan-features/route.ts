import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { z } from "zod";
import { verifyAdminAuth } from "../_lib/auth";
import { invalidateFeatureCache } from "@/lib/subscriptions/feature-flags";

// ─── GET /api/admin/plan-features ─────────────────────────────
// Devuelve la matriz completa de features por plan y línea
export async function GET() {
  const authResult = await verifyAdminAuth("superadmin");
  if ("error" in authResult) return authResult.error;

  try {
    const admin = createAdminClient();
    const { data, error } = await admin
      .from("plan_features")
      .select("*, feature:feature_definitions(id, key, label, category, sort_order, is_active)")
      .order("line")
      .order("plan");

    if (error) {
      console.error("[GET plan_features]", error);
      return NextResponse.json({ error: "Error al obtener plan features" }, { status: 500 });
    }

    return NextResponse.json({ planFeatures: data });
  } catch (err) {
    console.error("[GET plan-features]", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

// ─── PUT /api/admin/plan-features ─────────────────────────────
// Toggle de una feature para un plan/línea específico
const toggleSchema = z.object({
  line: z.enum(["healthcare", "business"]),
  plan: z.enum(["free", "base", "standard", "premium"]),
  feature_id: z.string().uuid(),
  enabled: z.boolean(),
});

export async function PUT(request: NextRequest) {
  const authResult = await verifyAdminAuth("superadmin");
  if ("error" in authResult) return authResult.error;

  try {
    const body = await request.json();
    const parsed = toggleSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Datos inválidos", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { line, plan, feature_id, enabled } = parsed.data;
    const admin = createAdminClient();

    const { data, error } = await admin
      .from("plan_features")
      .upsert(
        { line, plan, feature_id, enabled },
        { onConflict: "line,plan,feature_id" }
      )
      .select()
      .single();

    if (error) {
      console.error("[PUT plan_features]", error);
      return NextResponse.json({ error: "Error al actualizar: " + error.message }, { status: 500 });
    }

    // Invalidar cache del servidor para que la próxima lectura tome los cambios
    invalidateFeatureCache();
    return NextResponse.json({ planFeature: data });
  } catch (err) {
    console.error("[PUT plan-features]", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

// ─── POST /api/admin/plan-features/bulk ───────────────────────
// Actualización masiva de features para un plan/línea
const bulkSchema = z.object({
  line: z.enum(["healthcare", "business"]),
  plan: z.enum(["free", "base", "standard", "premium"]),
  features: z.array(z.object({
    feature_id: z.string().uuid(),
    enabled: z.boolean(),
  })),
});

export async function POST(request: NextRequest) {
  const authResult = await verifyAdminAuth("superadmin");
  if ("error" in authResult) return authResult.error;

  try {
    const body = await request.json();
    const parsed = bulkSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Datos inválidos", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { line, plan, features } = parsed.data;
    const admin = createAdminClient();

    const rows = features.map((f) => ({
      line,
      plan,
      feature_id: f.feature_id,
      enabled: f.enabled,
    }));

    const { error } = await admin
      .from("plan_features")
      .upsert(rows, { onConflict: "line,plan,feature_id" });

    if (error) {
      console.error("[POST plan_features bulk]", error);
      return NextResponse.json({ error: "Error al guardar: " + error.message }, { status: 500 });
    }

    // Invalidar cache del servidor para que la próxima lectura tome los cambios
    invalidateFeatureCache();
    return NextResponse.json({ message: "Features actualizadas", count: rows.length });
  } catch (err) {
    console.error("[POST plan-features]", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
