import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// GET /api/prestaciones/stats — Estadísticas de prestaciones para el dashboard
export async function GET() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth(); // 0-indexed

    // Obtener todos los turnos completados con prestación del profesional
    const { data: appointments, error: aptError } = await supabase
      .from("appointments")
      .select("id, starts_at, status, prestacion_id, prestaciones:prestacion_id(id, amount, description, insurance_id, insurance:insurances(name))")
      .eq("professional_id", user.id)
      .eq("status", "completed")
      .not("prestacion_id", "is", null)
      .order("starts_at", { ascending: false });

    if (aptError) {
      console.error("Error fetching appointment prestaciones:", aptError);
      return NextResponse.json(
        { error: "Error al obtener estadísticas" },
        { status: 500 }
      );
    }

    // Calcular totales por mes (últimos 12 meses)
    const monthlyTotals: Array<{
      month: string;
      year: number;
      monthNum: number;
      total: number;
      count: number;
    }> = [];

    const monthNames = [
      "Ene", "Feb", "Mar", "Abr", "May", "Jun",
      "Jul", "Ago", "Sep", "Oct", "Nov", "Dic",
    ];

    for (let i = 11; i >= 0; i--) {
      const date = new Date(currentYear, currentMonth - i, 1);
      const y = date.getFullYear();
      const m = date.getMonth();

      const monthAppointments = (appointments || []).filter((apt) => {
        const aptDate = new Date(apt.starts_at);
        return aptDate.getFullYear() === y && aptDate.getMonth() === m;
      });

      const total = monthAppointments.reduce((sum, apt) => {
        const prestacion = apt.prestaciones as unknown as { amount: number } | null;
        return sum + (prestacion?.amount || 0);
      }, 0);

      monthlyTotals.push({
        month: monthNames[m],
        year: y,
        monthNum: m + 1,
        total: Number(total),
        count: monthAppointments.length,
      });
    }

    // Total del mes actual
    const currentMonthData = monthlyTotals[monthlyTotals.length - 1];

    // Total acumulado
    const totalHistorico = monthlyTotals.reduce((sum, m) => sum + m.total, 0);
    const totalCount = monthlyTotals.reduce((sum, m) => sum + m.count, 0);

    // Desglose por obra social del mes actual
    const currentMonthAppointments = (appointments || []).filter((apt) => {
      const aptDate = new Date(apt.starts_at);
      return aptDate.getFullYear() === currentYear && aptDate.getMonth() === currentMonth;
    });

    const byInsurance: Record<string, { name: string; total: number; count: number }> = {};
    for (const apt of currentMonthAppointments) {
      const prestacion = apt.prestaciones as unknown as {
        amount: number;
        insurance: { name: string } | null;
      } | null;
      if (!prestacion) continue;
      const insuranceName = prestacion.insurance?.name || "Sin OS";
      if (!byInsurance[insuranceName]) {
        byInsurance[insuranceName] = { name: insuranceName, total: 0, count: 0 };
      }
      byInsurance[insuranceName].total += Number(prestacion.amount);
      byInsurance[insuranceName].count += 1;
    }

    return NextResponse.json({
      currentMonth: {
        total: currentMonthData?.total || 0,
        count: currentMonthData?.count || 0,
        label: currentMonthData ? `${currentMonthData.month} ${currentMonthData.year}` : "",
      },
      totalHistorico,
      totalCount,
      monthlyEvolution: monthlyTotals,
      byInsurance: Object.values(byInsurance).sort((a, b) => b.total - a.total),
    });
  } catch (error) {
    console.error("Error GET /api/prestaciones/stats:", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
