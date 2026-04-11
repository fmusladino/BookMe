import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { verifyMarketingAuth } from "../_lib/auth";

export const dynamic = "force-dynamic";

/**
 * GET /api/marketing/professionals
 *
 * Top profesionales por actividad y profesionales con riesgo de abandono.
 * - Top 10 por cantidad de turnos en los últimos 30 días
 * - Riesgo de abandono: profesionales sin turnos hace 14+ días o con suscripción past_due
 */
export async function GET() {
  const authResult = await verifyMarketingAuth();
  if ("error" in authResult) return authResult.error;

  try {
    const supabase = await createClient();
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const fourteenDaysAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000).toISOString();

    // Queries en paralelo
    const [appointmentsResult, prosResult] = await Promise.all([
      // Turnos de los últimos 30 días con datos del profesional
      supabase
        .from("appointments")
        .select("professional_id, starts_at")
        .gte("starts_at", thirtyDaysAgo),
      // Todos los profesionales con perfil
      supabase
        .from("professionals")
        .select(
          `id, line, specialty, subscription_plan, subscription_status, created_at,
           profile:profiles!id(full_name, avatar_url)`
        ),
    ]);

    const appointments = appointmentsResult.data || [];
    const professionals = (prosResult.data || []) as Array<{
      id: string;
      line: string;
      specialty: string;
      subscription_plan: string;
      subscription_status: string;
      created_at: string;
      profile: { full_name: string; avatar_url: string | null } | null;
    }>;

    // ─── Top profesionales por turnos ────────────────────────────────
    const appointmentsByPro: Record<string, number> = {};
    for (const apt of appointments) {
      appointmentsByPro[apt.professional_id] = (appointmentsByPro[apt.professional_id] || 0) + 1;
    }

    const topProfessionals = professionals
      .map((p) => ({
        id: p.id,
        full_name: p.profile?.full_name || "Sin nombre",
        specialty: p.specialty,
        line: p.line,
        plan: p.subscription_plan,
        appointments_30d: appointmentsByPro[p.id] || 0,
      }))
      .sort((a, b) => b.appointments_30d - a.appointments_30d)
      .slice(0, 10);

    // ─── Riesgo de abandono ──────────────────────────────────────────
    // Criterios: sin turnos en 14+ días O suscripción past_due/cancelled O trial a punto de vencer
    const lastAppointmentByPro: Record<string, string> = {};
    for (const apt of appointments) {
      const current = lastAppointmentByPro[apt.professional_id];
      if (!current || apt.starts_at > current) {
        lastAppointmentByPro[apt.professional_id] = apt.starts_at;
      }
    }

    const churnRisk = professionals
      .filter((p) => {
        const lastApt = lastAppointmentByPro[p.id];
        const noRecentActivity = !lastApt || lastApt < fourteenDaysAgo;
        const paymentIssue = p.subscription_status === "past_due" || p.subscription_status === "cancelled";
        return noRecentActivity || paymentIssue;
      })
      .map((p) => {
        const lastApt = lastAppointmentByPro[p.id];
        const reasons: string[] = [];

        if (!lastApt) {
          reasons.push("Sin turnos registrados");
        } else if (lastApt < fourteenDaysAgo) {
          const daysSince = Math.floor((now.getTime() - new Date(lastApt).getTime()) / (1000 * 60 * 60 * 24));
          reasons.push(`Sin actividad hace ${daysSince} días`);
        }

        if (p.subscription_status === "past_due") reasons.push("Pago pendiente");
        if (p.subscription_status === "cancelled") reasons.push("Suscripción cancelada");

        return {
          id: p.id,
          full_name: p.profile?.full_name || "Sin nombre",
          specialty: p.specialty,
          line: p.line,
          plan: p.subscription_plan,
          status: p.subscription_status,
          last_appointment: lastApt || null,
          created_at: p.created_at,
          reasons,
        };
      })
      .sort((a, b) => b.reasons.length - a.reasons.length)
      .slice(0, 20);

    return NextResponse.json({
      top_professionals: topProfessionals,
      churn_risk: churnRisk,
      churn_risk_count: churnRisk.length,
    });
  } catch (error) {
    console.error("[GET marketing/professionals]", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
