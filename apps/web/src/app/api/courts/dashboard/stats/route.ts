import { NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";

/**
 * GET /api/courts/dashboard/stats
 *
 * Returns JSON with aggregated booking and financial stats.
 */
export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

    const admin = createAdminClient();

    const [{ data: owner }, { data: courts }, { data: bookings }, { data: schedules }] = await Promise.all([
      admin.from("court_owners").select("*").eq("id", user.id).single(),
      admin.from("courts").select("*").eq("owner_id", user.id).eq("is_active", true).order("name"),
      admin.from("court_bookings").select("*").eq("owner_id", user.id).order("booking_date", { ascending: false }),
      admin.from("court_schedules").select("*"),
    ]);

    if (!owner || !courts) {
      return NextResponse.json({ error: "No se encontraron datos" }, { status: 404 });
    }

    const allBookings = bookings ?? [];

    const today = new Date();
    const todayStr = today.toISOString().split("T")[0]!;
    const startOfWeek = new Date(today);
    startOfWeek.setDate(today.getDate() - today.getDay() + 1);
    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 6);
    const startOfWeekStr = startOfWeek.toISOString().split("T")[0]!;
    const endOfWeekStr = endOfWeek.toISOString().split("T")[0]!;
    const startOfMonth = `${today.getFullYear()}-${(today.getMonth() + 1).toString().padStart(2, "0")}-01`;

    const active = allBookings.filter((b) => b.status !== "cancelled");
    const cancelled = allBookings.filter((b) => b.status === "cancelled");
    const todayBk = active.filter((b) => b.booking_date === todayStr);
    const weekBk = active.filter((b) => b.booking_date >= startOfWeekStr && b.booking_date <= endOfWeekStr);
    const monthBk = active.filter((b) => b.booking_date >= startOfMonth);

    const sum = (arr: typeof allBookings, field: "total_amount" | "seña_amount") =>
      arr.reduce((acc, b) => acc + (Number(b[field]) || 0), 0);

    const avg = (arr: typeof allBookings) =>
      arr.length > 0 ? Math.round(sum(arr, "total_amount") / arr.length) : 0;

    // Turnos por periodo
    const periodStats = (arr: typeof allBookings, allArr: typeof allBookings) => ({
      total: arr.length,
      confirmed: arr.filter((b) => b.status === "confirmed").length,
      pending: arr.filter((b) => b.status === "pending").length,
      completed: arr.filter((b) => b.status === "completed").length,
      cancelled: allArr.filter((b) => b.status === "cancelled").length,
    });

    const bookingStats = {
      today: periodStats(todayBk, allBookings.filter((b) => b.booking_date === todayStr)),
      week: periodStats(weekBk, allBookings.filter((b) => b.booking_date >= startOfWeekStr && b.booking_date <= endOfWeekStr)),
      month: periodStats(monthBk, allBookings.filter((b) => b.booking_date >= startOfMonth)),
      allTime: { ...periodStats(active, allBookings), cancelled: cancelled.length },
    };

    // Finanzas por periodo
    const financePeriod = (arr: typeof allBookings) => ({
      revenue: sum(arr, "total_amount"),
      cobrado: sum(arr.filter((b) => b.status === "completed"), "total_amount"),
      señasCobradas: sum(arr.filter((b) => b.seña_paid), "seña_amount"),
      señasPendientes: sum(arr.filter((b) => !b.seña_paid && Number(b.seña_amount) > 0), "seña_amount"),
      ticketPromedio: avg(arr),
    });

    const financeStats = {
      today: financePeriod(todayBk),
      week: financePeriod(weekBk),
      month: financePeriod(monthBk),
      allTime: financePeriod(active),
    };

    // Por cancha
    const courtStats = courts.map((court) => {
      const courtBk = active.filter((b) => b.court_id === court.id);
      const courtWeek = courtBk.filter((b) => b.booking_date >= startOfWeekStr && b.booking_date <= endOfWeekStr);
      const courtMonth = courtBk.filter((b) => b.booking_date >= startOfMonth);
      return {
        id: court.id,
        name: court.name,
        sport: court.sport,
        pricePerHour: court.price_per_hour,
        totalBookings: courtBk.length,
        weekBookings: courtWeek.length,
        monthBookings: courtMonth.length,
        confirmed: courtBk.filter((b) => b.status === "confirmed").length,
        revenue: sum(courtBk, "total_amount"),
        weekRevenue: sum(courtWeek, "total_amount"),
        monthRevenue: sum(courtMonth, "total_amount"),
        señasCobradas: sum(courtBk.filter((b) => b.seña_paid), "seña_amount"),
      };
    });

    // Últimos 7 días para gráfico
    const last7Days: { date: string; bookings: number; revenue: number }[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(today.getDate() - i);
      const ds = d.toISOString().split("T")[0]!;
      const dayBk = active.filter((b) => b.booking_date === ds);
      last7Days.push({
        date: ds,
        bookings: dayBk.length,
        revenue: sum(dayBk, "total_amount"),
      });
    }

    // Señas pendientes (listado)
    const pendingSeñas = allBookings
      .filter((b) => !b.seña_paid && Number(b.seña_amount) > 0 && b.status !== "cancelled")
      .slice(0, 20)
      .map((b) => {
        const court = courts.find((c) => c.id === b.court_id);
        return {
          id: b.id,
          date: b.booking_date,
          startTime: (b.start_time ?? "").slice(0, 5),
          court: court?.name ?? "—",
          customer: b.customer_name,
          phone: b.customer_phone,
          señaAmount: Number(b.seña_amount) || 0,
          totalAmount: Number(b.total_amount) || 0,
        };
      });

    // ─── Ocupación: slots totales vs ocupados ───
    // Calcular cuántos slots tiene cada cancha por día de la semana
    const courtSchedules = (schedules ?? []).filter((s) =>
      courts.some((c) => c.id === s.court_id)
    );

    // Slots por cancha por día de semana
    const slotsPerCourtPerDay = (courtId: string, dayOfWeek: number): number => {
      const court = courts.find((c) => c.id === courtId);
      if (!court) return 0;
      const slotDuration = court.slot_duration ?? 60;
      const daySchedule = courtSchedules.filter(
        (s) => s.court_id === courtId && s.day_of_week === dayOfWeek
      );
      let total = 0;
      for (const sched of daySchedule) {
        const [sh, sm] = (sched.start_time as string).split(":").map(Number);
        const [eh, em] = (sched.end_time as string).split(":").map(Number);
        const startMin = (sh ?? 0) * 60 + (sm ?? 0);
        const endMin = (eh ?? 0) * 60 + (em ?? 0);
        total += Math.floor((endMin - startMin) / slotDuration);
      }
      return total;
    };

    // Total slots para una fecha específica (todas las canchas)
    const totalSlotsForDate = (dateStr: string): number => {
      const d = new Date(dateStr + "T12:00:00");
      const dow = d.getDay();
      return courts.reduce((sum2, c) => sum2 + slotsPerCourtPerDay(c.id, dow), 0);
    };

    // Ocupados para una fecha
    const occupiedForDate = (dateStr: string): number => {
      return active.filter((b) => b.booking_date === dateStr).length;
    };

    // Hoy
    const todayTotalSlots = totalSlotsForDate(todayStr);
    const todayOccupied = occupiedForDate(todayStr);

    // Esta semana: sumar cada día lun-dom
    let weekTotalSlots = 0;
    let weekOccupied = 0;
    for (let i = 0; i < 7; i++) {
      const d = new Date(startOfWeek);
      d.setDate(startOfWeek.getDate() + i);
      const ds = d.toISOString().split("T")[0]!;
      weekTotalSlots += totalSlotsForDate(ds);
      weekOccupied += occupiedForDate(ds);
    }

    // Este mes: sumar cada día del mes
    let monthTotalSlots = 0;
    let monthOccupied = 0;
    const monthYear = today.getFullYear();
    const monthNum = today.getMonth();
    const daysInMonth = new Date(monthYear, monthNum + 1, 0).getDate();
    for (let i = 1; i <= daysInMonth; i++) {
      const ds = `${monthYear}-${(monthNum + 1).toString().padStart(2, "0")}-${i.toString().padStart(2, "0")}`;
      monthTotalSlots += totalSlotsForDate(ds);
      if (ds <= todayStr) {
        monthOccupied += occupiedForDate(ds);
      }
    }

    const occupancy = {
      today: {
        totalSlots: todayTotalSlots,
        occupied: todayOccupied,
        free: todayTotalSlots - todayOccupied,
        pct: todayTotalSlots > 0 ? Math.round((todayOccupied / todayTotalSlots) * 100) : 0,
      },
      week: {
        totalSlots: weekTotalSlots,
        occupied: weekOccupied,
        free: weekTotalSlots - weekOccupied,
        pct: weekTotalSlots > 0 ? Math.round((weekOccupied / weekTotalSlots) * 100) : 0,
      },
      month: {
        totalSlots: monthTotalSlots,
        occupied: monthOccupied,
        free: monthTotalSlots - monthOccupied,
        pct: monthTotalSlots > 0 ? Math.round((monthOccupied / monthTotalSlots) * 100) : 0,
      },
    };

    return NextResponse.json({
      businessName: owner.business_name,
      bookingStats,
      financeStats,
      courtStats,
      last7Days,
      pendingSeñas,
      totalCourts: courts.length,
      occupancy,
    });
  } catch (error) {
    console.error("GET /api/courts/dashboard/stats:", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
