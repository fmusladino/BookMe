export const dynamic = "force-dynamic";

import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

type BillingItem = {
  id: string;
  professional_id: string;
  patient_id: string;
  appointment_id: string;
  insurance_id: string;
  practice_code: string;
  practice_name: string;
  amount: number;
  status: string;
  period_month: number;
  period_year: number;
  facturante_ref: string | null;
  created_at: string;
  insurance?: { name: string };
};

/**
 * GET /api/billing/summary — Resumen de facturación del profesional
 * Query params:
 *   - period=YYYY-MM (defaults to current month)
 *
 * Retorna:
 *   - total_pending, total_submitted, total_paid, total_amount
 *   - items_by_insurance: agrupado por seguro con total
 *   - items_by_status: arrays de items por estado
 */
export async function GET(request: NextRequest) {
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
        { error: "Solo profesionales pueden acceder a facturación" },
        { status: 403 }
      );
    }

    // Determinar período: usar parámetro o mes actual
    const { searchParams } = new URL(request.url);
    let period = searchParams.get("period");

    if (!period) {
      const now = new Date();
      const year = now.getFullYear();
      const month = String(now.getMonth() + 1).padStart(2, "0");
      period = `${year}-${month}`;
    }

    const [yearStr, monthStr] = period.split("-");
    const year = parseInt(yearStr, 10);
    const month = parseInt(monthStr, 10);

    if (!year || !month || month < 1 || month > 12) {
      return NextResponse.json(
        { error: "Formato de período inválido. Usa YYYY-MM" },
        { status: 400 }
      );
    }

    // Obtener items del período
    const { data, error } = await supabase
      .from("billing_items")
      .select(
        `id, professional_id, patient_id, appointment_id, insurance_id, practice_code, practice_name, amount, status, period_month, period_year, facturante_ref, created_at,
        insurance:insurances(name)`
      )
      .eq("professional_id", user.id)
      .eq("period_year", year)
      .eq("period_month", month)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Supabase error:", error.message);
      return NextResponse.json(
        { error: "Error al obtener resumen de facturación" },
        { status: 500 }
      );
    }

    const items = (data || []) as BillingItem[];

    // Calcular totales por estado
    const total_pending = items
      .filter((i) => i.status === "pending")
      .reduce((sum, i) => sum + Number(i.amount), 0);

    const total_submitted = items
      .filter((i) => i.status === "submitted")
      .reduce((sum, i) => sum + Number(i.amount), 0);

    const total_paid = items
      .filter((i) => i.status === "paid")
      .reduce((sum, i) => sum + Number(i.amount), 0);

    const total_amount = total_pending + total_submitted + total_paid;

    // Agrupar por seguro
    const items_by_insurance: Record<
      string,
      { count: number; total: number; items: BillingItem[] }
    > = {};

    items.forEach((item) => {
      const insuranceName = item.insurance?.name || "Sin seguro";
      if (!items_by_insurance[insuranceName]) {
        items_by_insurance[insuranceName] = {
          count: 0,
          total: 0,
          items: [],
        };
      }
      items_by_insurance[insuranceName].count += 1;
      items_by_insurance[insuranceName].total += Number(item.amount);
      items_by_insurance[insuranceName].items.push(item);
    });

    // Agrupar por estado
    const items_by_status = {
      pending: items.filter((i) => i.status === "pending"),
      submitted: items.filter((i) => i.status === "submitted"),
      paid: items.filter((i) => i.status === "paid"),
    };

    return NextResponse.json({
      period: `${year}-${String(month).padStart(2, "0")}`,
      total_pending,
      total_submitted,
      total_paid,
      total_amount,
      count_items: items.length,
      items_by_insurance,
      items_by_status,
    });
  } catch (error) {
    console.error("Error GET /api/billing/summary:", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
