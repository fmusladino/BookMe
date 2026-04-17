import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

/**
 * GET /api/directory/filters
 *
 * Devuelve las opciones de filtros para el directorio público:
 * - Obras sociales / prepagas que tienen al menos un profesional asignado (sin duplicados)
 * - Localidades (ciudades) únicas donde hay profesionales visibles
 *
 * Usa exclusivamente el admin client (service_role) para evitar problemas
 * con cookies/RLS en un endpoint público sin sesión.
 */
export async function GET() {
  try {
    const admin = createAdminClient();

    // ── 1. Localidades únicas de profesionales visibles ─────────────────
    const { data: prosData, error: prosError } = await admin
      .from("professionals")
      .select("city")
      .eq("is_visible", true)
      .not("subscription_status", "eq", "cancelled");

    if (prosError) {
      console.error("[Directory Filters] Error fetching cities:", prosError.message);
    }

    const citiesSet = new Set<string>();
    if (prosData) {
      for (const p of prosData) {
        if (p.city && p.city.trim()) {
          citiesSet.add(p.city.trim());
        }
      }
    }
    const cities = Array.from(citiesSet).sort((a, b) => a.localeCompare(b));

    // ── 2. Obras sociales ───────────────────────────────────────────────
    // Estrategia: traer las OS que tienen profesionales asignados.
    // Si no hay datos de relación, fallback a todas las activas.
    const insuranceIds = new Set<string>();

    // Fuente A: professional_insurances
    try {
      const { data, error } = await admin
        .from("professional_insurances")
        .select("insurance_id")
        .eq("is_active", true);
      if (error) console.error("[Filters] prof_ins error:", error.message);
      if (data) data.forEach((r: { insurance_id: string }) => insuranceIds.add(r.insurance_id));
    } catch (e) {
      console.error("[Filters] prof_ins catch:", e);
    }

    // Fuente B: prestaciones
    try {
      const { data, error } = await admin
        .from("prestaciones")
        .select("insurance_id")
        .eq("is_active", true);
      if (error) console.error("[Filters] prestaciones error:", error.message);
      if (data) data.forEach((r: { insurance_id: string }) => insuranceIds.add(r.insurance_id));
    } catch (e) {
      console.error("[Filters] prestaciones catch:", e);
    }

    // Fuente C: service_insurances
    try {
      const { data, error } = await admin
        .from("service_insurances")
        .select("insurance_id");
      if (error) console.error("[Filters] svc_ins error:", error.message);
      if (data) data.forEach((r: { insurance_id: string }) => insuranceIds.add(r.insurance_id));
    } catch (e) {
      console.error("[Filters] svc_ins catch:", e);
    }

    let insurances: { id: string; name: string }[] = [];
    const idsArray = Array.from(insuranceIds);

    if (idsArray.length > 0) {
      const { data: insData, error: insError } = await admin
        .from("insurances")
        .select("id, name")
        .in("id", idsArray)
        .eq("is_active", true)
        .order("name", { ascending: true });
      if (insError) console.error("[Filters] insurances by ids error:", insError.message);
      insurances = insData || [];
    }

    // Fallback: si no se encontraron relaciones, traer TODAS las OS activas
    if (insurances.length === 0) {
      const { data: allIns, error: allInsError } = await admin
        .from("insurances")
        .select("id, name")
        .eq("is_active", true)
        .order("name", { ascending: true });
      if (allInsError) console.error("[Filters] fallback insurances error:", allInsError.message);
      insurances = allIns || [];
    }

    console.log("[Directory Filters] OK — insurances:", insurances.length, "cities:", cities.length);
    return NextResponse.json({ insurances, cities });
  } catch (error) {
    console.error("[Directory Filters] Unexpected error:", error);
    return NextResponse.json({ insurances: [], cities: [], error: "Error interno" }, { status: 500 });
  }
}
