import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { verifyMarketingAuth } from "../_lib/auth";

export const dynamic = "force-dynamic";

/**
 * GET /api/marketing/stats
 *
 * Métricas de producto para el usuario de marketing:
 * - Registros del mes actual y anterior (con % cambio)
 * - Profesionales activos vs inactivos
 * - Distribución por línea y plan
 * - Evolución mensual de registros (últimos 12 meses)
 * - Tasa de conversión trial → pago
 */
export async function GET() {
  const authResult = await verifyMarketingAuth();
  if ("error" in authResult) return authResult.error;

  try {
    const supabase = await createClient();
    const now = new Date();

    // Fechas útiles
    const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
    const prevMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString();
    const prevMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59).toISOString();

    // Ejecutar queries en paralelo
    const [
      totalProsResult,
      thisMonthResult,
      prevMonthResult,
      allProsResult,
      totalPatientsResult,
      totalAppointmentsResult,
    ] = await Promise.all([
      // Total profesionales
      supabase.from("professionals").select("id", { count: "exact" }),
      // Registros este mes
      supabase
        .from("professionals")
        .select("id", { count: "exact" })
        .gte("created_at", thisMonthStart),
      // Registros mes anterior
      supabase
        .from("professionals")
        .select("id", { count: "exact" })
        .gte("created_at", prevMonthStart)
        .lte("created_at", prevMonthEnd),
      // Todos los profesionales con datos para métricas
      supabase
        .from("professionals")
        .select("line, subscription_plan, subscription_status, created_at, trial_ends_at"),
      // Total pacientes
      supabase.from("patients").select("id", { count: "exact" }),
      // Total turnos
      supabase.from("appointments").select("id", { count: "exact" }),
    ]);

    const totalPros = totalProsResult.count || 0;
    const registrosEsteMes = thisMonthResult.count || 0;
    const registrosMesAnterior = prevMonthResult.count || 0;
    const totalPatients = totalPatientsResult.count || 0;
    const totalAppointments = totalAppointmentsResult.count || 0;

    const changePct =
      registrosMesAnterior > 0
        ? ((registrosEsteMes - registrosMesAnterior) / registrosMesAnterior) * 100
        : registrosEsteMes > 0
        ? 100
        : 0;

    // Distribución por línea, plan y status
    const allPros = allProsResult.data || [];

    const byLine = { healthcare: 0, business: 0 };
    const byPlan = { free: 0, base: 0, standard: 0, premium: 0 };
    const byStatus = { active: 0, trialing: 0, past_due: 0, cancelled: 0, read_only: 0 };
    let trialConverted = 0;
    let totalTrialEnded = 0;

    for (const p of allPros) {
      // Por línea
      if (p.line === "healthcare") byLine.healthcare++;
      else if (p.line === "business") byLine.business++;

      // Por plan
      const plan = p.subscription_plan as keyof typeof byPlan;
      if (plan in byPlan) byPlan[plan]++;

      // Por status
      const status = p.subscription_status as keyof typeof byStatus;
      if (status in byStatus) byStatus[status]++;

      // Conversión trial → pago
      if (p.trial_ends_at && new Date(p.trial_ends_at) < now) {
        totalTrialEnded++;
        if (p.subscription_plan !== "free" && p.subscription_status === "active") {
          trialConverted++;
        }
      }
    }

    const conversionRate = totalTrialEnded > 0 ? (trialConverted / totalTrialEnded) * 100 : 0;

    // Evolución mensual (últimos 12 meses)
    const monthlyEvolution: Array<{ month: string; count: number }> = [];
    for (let i = 11; i >= 0; i--) {
      const mStart = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const mEnd = new Date(now.getFullYear(), now.getMonth() - i + 1, 0, 23, 59, 59);
      const monthLabel = `${mStart.getFullYear()}-${String(mStart.getMonth() + 1).padStart(2, "0")}`;

      const count = allPros.filter((p) => {
        const d = new Date(p.created_at);
        return d >= mStart && d <= mEnd;
      }).length;

      monthlyEvolution.push({ month: monthLabel, count });
    }

    return NextResponse.json({
      summary: {
        total_professionals: totalPros,
        total_patients: totalPatients,
        total_appointments: totalAppointments,
        registros_este_mes: registrosEsteMes,
        registros_mes_anterior: registrosMesAnterior,
        change_pct: Math.round(changePct * 10) / 10,
        conversion_rate: Math.round(conversionRate * 10) / 10,
      },
      distribution: {
        by_line: byLine,
        by_plan: byPlan,
        by_status: byStatus,
      },
      monthly_evolution: monthlyEvolution,
      generated_at: new Date().toISOString(),
    });
  } catch (error) {
    console.error("[GET marketing/stats]", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
