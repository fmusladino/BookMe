import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { verifyAdminAuth } from "../_lib/auth";

// ─── GET /api/admin/stats ────────────────────────────────────────────

/**
 * Retorna estadísticas de dashboard en tiempo real:
 * - Total de profesionales
 * - Total de pacientes
 * - Total de turnos en plataforma
 * - Turnos en el mes actual
 * - Suscripciones activas
 * - Ingresos por plan
 * - Profesionales por línea
 * - Nuevos registros esta semana
 */
export async function GET(request: NextRequest) {
  const authResult = await verifyAdminAuth("superadmin");
  if ("error" in authResult) return authResult.error;

  try {
    const supabase = await createClient();

    // Calcular fechas útiles
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
    const monthEnd = new Date(
      now.getFullYear(),
      now.getMonth() + 1,
      0,
      23,
      59,
      59
    ).toISOString();
    const weekStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();

    // 1. Total de profesionales
    const { count: totalProfessionals } = await supabase
      .from("professionals")
      .select("id", { count: "exact" });

    // 2. Total de pacientes
    const { count: totalPatients } = await supabase
      .from("patients")
      .select("id", { count: "exact" });

    // 3. Total de turnos
    const { count: totalAppointments } = await supabase
      .from("appointments")
      .select("id", { count: "exact" });

    // 4. Turnos este mes
    const { count: appointmentsThisMonth } = await supabase
      .from("appointments")
      .select("id", { count: "exact" })
      .gte("starts_at", monthStart)
      .lte("starts_at", monthEnd);

    // 5. Suscripciones activas
    const { data: subscriptions, error: subError } = await supabase
      .from("professionals")
      .select("subscription_status", { count: "exact" })
      .eq("subscription_status", "active");

    const activeSubscriptions = subscriptions?.length || 0;

    // 6. Ingresos por plan (conteos)
    const { data: planCounts } = await supabase
      .from("professionals")
      .select("subscription_plan");

    const planMetrics = {
      free: 0,
      base: 0,
      standard: 0,
      premium: 0,
    };

    if (planCounts) {
      planCounts.forEach((p: any) => {
        if (p.subscription_plan in planMetrics) {
          planMetrics[p.subscription_plan as keyof typeof planMetrics]++;
        }
      });
    }

    // 7. Profesionales por línea
    const { data: byLine } = await supabase
      .from("professionals")
      .select("line");

    const lineMetrics = {
      healthcare: 0,
      business: 0,
    };

    if (byLine) {
      byLine.forEach((p: any) => {
        if (p.line === "healthcare") {
          lineMetrics.healthcare++;
        } else if (p.line === "business") {
          lineMetrics.business++;
        }
      });
    }

    // 8. Nuevos registros esta semana
    const { count: newSignupsThisWeek } = await supabase
      .from("professionals")
      .select("id", { count: "exact" })
      .gte("created_at", weekStart);

    // 9. Nuevos pacientes esta semana
    const { count: newPatientsThisWeek } = await supabase
      .from("patients")
      .select("id", { count: "exact" })
      .gte("created_at", weekStart);

    // 10. Estadísticas de turnos (confirmar, completar, cancelar, no show)
    const { data: appointmentStats } = await supabase
      .from("appointments")
      .select("status");

    const appointmentMetrics = {
      pending: 0,
      confirmed: 0,
      completed: 0,
      cancelled: 0,
      no_show: 0,
    };

    if (appointmentStats) {
      appointmentStats.forEach((a: any) => {
        if (a.status in appointmentMetrics) {
          appointmentMetrics[a.status as keyof typeof appointmentMetrics]++;
        }
      });
    }

    // 11. Usuarios por rol
    const { data: usersByRole } = await supabase
      .from("profiles")
      .select("role");

    const userRoleCounts = {
      professional: 0,
      patient: 0,
      admin: 0,
      superadmin: 0,
      marketing: 0,
    };

    if (usersByRole) {
      usersByRole.forEach((u: any) => {
        if (u.role in userRoleCounts) {
          userRoleCounts[u.role as keyof typeof userRoleCounts]++;
        }
      });
    }

    return NextResponse.json({
      summary: {
        total_professionals: totalProfessionals || 0,
        total_patients: totalPatients || 0,
        total_appointments: totalAppointments || 0,
        appointments_this_month: appointmentsThisMonth || 0,
        active_subscriptions: activeSubscriptions,
        new_signups_this_week: newSignupsThisWeek || 0,
        new_patients_this_week: newPatientsThisWeek || 0,
      },
      plans: planMetrics,
      lines: lineMetrics,
      appointments: appointmentMetrics,
      users: userRoleCounts,
      generated_at: new Date().toISOString(),
    });
  } catch (error) {
    console.error("[GET stats]", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
