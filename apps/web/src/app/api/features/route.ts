export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * GET /api/features
 * Endpoint público que devuelve la matriz completa de features desde la DB.
 * Usado por el hook useFeatures para gating dinámico en el frontend.
 * Cache: 60 segundos (revalidate).
 */
export const revalidate = 60;

export async function GET() {
  try {
    const supabase = await createClient();

    const [featuresRes, planFeaturesRes, pricesRes, clinicPricesRes] = await Promise.all([
      supabase
        .from("feature_definitions")
        .select("id, key, label, description, category, sort_order")
        .eq("is_active", true)
        .order("sort_order"),
      supabase
        .from("plan_features")
        .select("line, plan, feature_id, enabled, feature:feature_definitions(key)")
        .order("line")
        .order("plan"),
      supabase
        .from("plan_prices")
        .select("line, plan, billing_cycle, price_usd, is_active")
        .eq("is_active", true)
        .order("line")
        .order("plan"),
      supabase
        .from("clinic_plan_prices")
        .select("plan, billing_cycle, price_usd, is_active")
        .eq("is_active", true)
        .order("plan"),
    ]);

    // Construir la matriz: { healthcare: { free: { mia_basic: true, ... }, ... }, ... }
    const matrix: Record<string, Record<string, Record<string, boolean>>> = {
      healthcare: { free: {}, base: {}, standard: {}, premium: {} },
      business: { free: {}, base: {}, standard: {}, premium: {} },
    };

    for (const pf of planFeaturesRes.data ?? []) {
      const featureData = pf.feature as unknown as { key: string } | null;
      if (!featureData?.key) continue;
      if (matrix[pf.line]?.[pf.plan]) {
        matrix[pf.line][pf.plan][featureData.key] = pf.enabled;
      }
    }

    // Construir precios: { healthcare: { base: { monthly: 9, annual: 7.20 }, ... } }
    const prices: Record<string, Record<string, Record<string, number>>> = {};
    for (const p of pricesRes.data ?? []) {
      if (!prices[p.line]) prices[p.line] = {};
      if (!prices[p.line][p.plan]) prices[p.line][p.plan] = {};
      prices[p.line][p.plan][p.billing_cycle] = p.price_usd;
    }

    // Precios consultorio
    const clinicPrices: Record<string, Record<string, number>> = {};
    for (const p of clinicPricesRes.data ?? []) {
      if (!clinicPrices[p.plan]) clinicPrices[p.plan] = {};
      clinicPrices[p.plan][p.billing_cycle] = p.price_usd;
    }

    return NextResponse.json({
      features: featuresRes.data ?? [],
      matrix,
      prices,
      clinicPrices,
    });
  } catch (err) {
    console.error("[GET /api/features]", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
