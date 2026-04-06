import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { z } from "zod";
import { hasFeatureAsync } from "@/lib/subscriptions/feature-flags";

export const dynamic = "force-dynamic";

// Esquema de validación para parámetros
const financialParamsSchema = z.object({
  period: z.string().regex(/^\d{4}-\d{2}$/, "Formato inválido. Use YYYY-MM").optional(),
});

// Tipos para las métricas de respuesta
interface RevenueMetrics {
  particular: number;
  insurance_pending: number;
  insurance_paid: number;
  total: number;
}

interface ComparisonMetrics {
  total_prev: number;
  change_pct: number;
}

interface InsuranceData {
  insurance_name: string;
  pending: number;
  paid: number;
}

interface MonthlyTrendData {
  month: string;
  total: number;
}

interface FinancialResponse {
  period: string;
  revenue: RevenueMetrics;
  comparison: ComparisonMetrics;
  byInsurance: InsuranceData[];
  byMonth: MonthlyTrendData[];
}

// GET /api/metrics/financial — Métricas financieras (Healthcare Standard+ only)
export async function GET(request: NextRequest): Promise<NextResponse<FinancialResponse | { error: string }>> {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    // Verificar que el profesional sea Healthcare y tenga plan Standard o Premium
    const { data: professional, error: profError } = await supabase
      .from("professionals")
      .select("line, subscription_plan")
      .eq("id", user.id)
      .single();

    if (profError || !professional) {
      return NextResponse.json({ error: "Profesional no encontrado" }, { status: 404 });
    }

    // Validar acceso según feature flag dinámico
    const hasFinancial = await hasFeatureAsync(
      "dashboard_financial",
      professional.subscription_plan,
      professional.line
    );
    if (!hasFinancial) {
      return NextResponse.json(
        { error: "Se requiere un plan con Dashboard Financiero habilitado para acceder a métricas financieras" },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(request.url);
    const periodParam = searchParams.get("period");

    // Obtener período actual o el especificado
    const now = new Date();
    let period: string;
    let periodStart: Date;
    let periodEnd: Date;

    if (periodParam) {
      const parsed = financialParamsSchema.safeParse({ period: periodParam });
      if (!parsed.success) {
        return NextResponse.json({ error: "Parámetro period inválido (YYYY-MM)" }, { status: 400 });
      }
      period = parsed.data.period!;
      const [year, month] = period.split("-").map(Number);
      periodStart = new Date(year, month - 1, 1);
      periodEnd = new Date(year, month, 0, 23, 59, 59);
    } else {
      period = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
      periodStart = new Date(now.getFullYear(), now.getMonth(), 1);
      periodEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
    }

    const periodStartISO = periodStart.toISOString();
    const periodEndISO = periodEnd.toISOString();

    // Calcular período anterior (mes anterior)
    const prevStart = new Date(periodStart);
    prevStart.setMonth(prevStart.getMonth() - 1);
    const prevEnd = new Date(prevStart);
    prevEnd.setMonth(prevEnd.getMonth() + 1);
    prevEnd.setDate(0);
    prevEnd.setHours(23, 59, 59);

    const prevStartISO = prevStart.toISOString();
    const prevEndISO = prevEnd.toISOString();

    // 1. Obtener ingresos particulares (turnos completados con pacientes particulares)
    // Primero obtener los IDs de pacientes particulares
    const { data: particularPatients, error: particularPatientsError } = await supabase
      .from("patients")
      .select("id")
      .eq("professional_id", user.id)
      .eq("is_particular", true);

    if (particularPatientsError) {
      console.error("Error fetching particular patients:", particularPatientsError);
      return NextResponse.json(
        { error: "Error al obtener ingresos particulares" },
        { status: 500 }
      );
    }

    const particularPatientIds = (particularPatients || []).map((p) => p.id);
    let particularRevenue = 0;

    if (particularPatientIds.length > 0) {
      const { data: particularAppointments, error: particularError } = await supabase
        .from("appointments")
        .select("service:services(price)")
        .eq("professional_id", user.id)
        .eq("status", "completed")
        .gte("starts_at", periodStartISO)
        .lte("starts_at", periodEndISO)
        .in("patient_id", particularPatientIds);

      if (particularError) {
        console.error("Error fetching particular appointments:", particularError);
        return NextResponse.json(
          { error: "Error al obtener ingresos particulares" },
          { status: 500 }
        );
      }

      particularRevenue =
        particularAppointments?.reduce((sum, apt) => {
          return sum + (apt.service?.price || 0);
        }, 0) || 0;
    }

    // 2. Obtener ingresos de obra social (desde tabla billing_items)
    const { data: billingItems, error: billingError } = await supabase
      .from("billing_items")
      .select("amount, status, insurance:insurances(name)")
      .eq("professional_id", user.id)
      .gte("created_at", periodStartISO)
      .lte("created_at", periodEndISO);

    if (billingError) {
      console.error("Error fetching billing items:", billingError);
      return NextResponse.json(
        { error: "Error al obtener datos de facturación" },
        { status: 500 }
      );
    }

    // Separar ingresos por estado
    let insurancePending = 0;
    let insurancePaid = 0;

    billingItems?.forEach((item) => {
      if (item.status === "pending") {
        insurancePending += item.amount || 0;
      } else if (item.status === "paid") {
        insurancePaid += item.amount || 0;
      }
    });

    const totalRevenue = particularRevenue + insurancePending + insurancePaid;

    const revenueMetrics: RevenueMetrics = {
      particular: Math.round(particularRevenue),
      insurance_pending: Math.round(insurancePending),
      insurance_paid: Math.round(insurancePaid),
      total: Math.round(totalRevenue),
    };

    // 3. Obtener ingresos del período anterior para comparación
    const { data: prevBillingItems, error: prevBillingError } = await supabase
      .from("billing_items")
      .select("amount")
      .eq("professional_id", user.id)
      .gte("created_at", prevStartISO)
      .lte("created_at", prevEndISO);

    if (prevBillingError) {
      console.error("Error fetching previous billing items:", prevBillingError);
      return NextResponse.json(
        { error: "Error al obtener datos anteriores" },
        { status: 500 }
      );
    }

    let prevParticularRevenue = 0;

    if (particularPatientIds.length > 0) {
      const { data: prevParticularAppointments, error: prevParticularError } = await supabase
        .from("appointments")
        .select("service:services(price)")
        .eq("professional_id", user.id)
        .eq("status", "completed")
        .gte("starts_at", prevStartISO)
        .lte("starts_at", prevEndISO)
        .in("patient_id", particularPatientIds);

      if (prevParticularError) {
        console.error("Error fetching previous particular appointments:", prevParticularError);
        return NextResponse.json(
          { error: "Error al obtener datos anteriores" },
          { status: 500 }
        );
      }

      prevParticularRevenue =
        prevParticularAppointments?.reduce((sum, apt) => {
          return sum + (apt.service?.price || 0);
        }, 0) || 0;
    }

    const prevBillingRevenue =
      prevBillingItems?.reduce((sum, item) => {
        return sum + (item.amount || 0);
      }, 0) || 0;

    const totalPrev = prevParticularRevenue + prevBillingRevenue;
    const changePct = totalPrev > 0 ? ((totalRevenue - totalPrev) / totalPrev) * 100 : 0;

    const comparison: ComparisonMetrics = {
      total_prev: Math.round(totalPrev),
      change_pct: Math.round(changePct * 10) / 10, // 1 decimal
    };

    // 4. Agrupar por obra social
    const insuranceMap = new Map<string, { pending: number; paid: number }>();

    billingItems?.forEach((item) => {
      if (item.insurance) {
        const key = item.insurance.name;
        const current = insuranceMap.get(key) || { pending: 0, paid: 0 };

        if (item.status === "pending") {
          current.pending += item.amount || 0;
        } else if (item.status === "paid") {
          current.paid += item.amount || 0;
        }

        insuranceMap.set(key, current);
      }
    });

    const byInsurance: InsuranceData[] = Array.from(insuranceMap.entries()).map(
      ([name, { pending, paid }]) => ({
        insurance_name: name,
        pending: Math.round(pending),
        paid: Math.round(paid),
      })
    );

    // 5. Obtener datos de últimos 6 meses
    const sixMonthsAgo = new Date(now);
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 5);
    sixMonthsAgo.setDate(1);

    const { data: sixMonthsBilling, error: sixMonthsError } = await supabase
      .from("billing_items")
      .select("amount, period_month, period_year")
      .eq("professional_id", user.id)
      .gte("period_year", sixMonthsAgo.getFullYear())
      .order("period_year", { ascending: true })
      .order("period_month", { ascending: true });

    if (sixMonthsError) {
      console.error("Error fetching six months data:", sixMonthsError);
      return NextResponse.json(
        { error: "Error al obtener datos históricos" },
        { status: 500 }
      );
    }

    let sixMonthsAppointments: Array<{ starts_at: string; service: { price: number | null } | null }> = [];

    if (particularPatientIds.length > 0) {
      const { data, error: sixMonthsAptError } = await supabase
        .from("appointments")
        .select("starts_at, service:services(price)")
        .eq("professional_id", user.id)
        .eq("status", "completed")
        .gte("starts_at", sixMonthsAgo.toISOString())
        .in("patient_id", particularPatientIds);

      if (sixMonthsAptError) {
        console.error("Error fetching six months appointments:", sixMonthsAptError);
        return NextResponse.json(
          { error: "Error al obtener datos históricos" },
          { status: 500 }
        );
      }

      sixMonthsAppointments = data || [];
    }

    // Agrupar por mes
    const monthlyMap = new Map<string, number>();

    // Inicializar últimos 6 meses
    for (let i = 5; i >= 0; i--) {
      const m = new Date(now);
      m.setMonth(m.getMonth() - i);
      const monthKey = `${m.getFullYear()}-${String(m.getMonth() + 1).padStart(2, "0")}`;
      monthlyMap.set(monthKey, 0);
    }

    // Agregar datos de facturación
    sixMonthsBilling?.forEach((item) => {
      const monthKey = `${item.period_year}-${String(item.period_month).padStart(2, "0")}`;
      const current = monthlyMap.get(monthKey) || 0;
      monthlyMap.set(monthKey, current + (item.amount || 0));
    });

    // Agregar datos de turnos particulares
    sixMonthsAppointments?.forEach((apt) => {
      const date = new Date(apt.starts_at);
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
      const current = monthlyMap.get(monthKey) || 0;
      monthlyMap.set(monthKey, current + (apt.service?.price || 0));
    });

    const byMonth: MonthlyTrendData[] = Array.from(monthlyMap.entries())
      .map(([month, total]) => ({
        month,
        total: Math.round(total),
      }))
      .sort((a, b) => a.month.localeCompare(b.month));

    const financialResponse: FinancialResponse = {
      period,
      revenue: revenueMetrics,
      comparison,
      byInsurance,
      byMonth,
    };

    return NextResponse.json(financialResponse);
  } catch (error) {
    console.error("Error GET /api/metrics/financial:", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
