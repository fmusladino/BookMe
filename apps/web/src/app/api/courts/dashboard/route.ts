import { NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";

/**
 * GET /api/courts/dashboard
 *
 * Genera un CSV con el dashboard completo de turnos y finanzas.
 * Se puede abrir directo en Excel / Google Sheets.
 */
export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

    const admin = createAdminClient();

    // Obtener datos
    const [{ data: owner }, { data: courts }, { data: bookings }] = await Promise.all([
      admin.from("court_owners").select("*").eq("id", user.id).single(),
      admin.from("courts").select("*").eq("owner_id", user.id).eq("is_active", true).order("name"),
      admin.from("court_bookings").select("*").eq("owner_id", user.id).order("booking_date", { ascending: false }),
    ]);

    if (!owner || !courts || !bookings) {
      return NextResponse.json({ error: "No se encontraron datos" }, { status: 404 });
    }

    const courtsMap: Record<string, typeof courts[0]> = {};
    for (const c of courts) courtsMap[c.id] = c;

    const today = new Date();
    const todayStr = today.toISOString().split("T")[0]!;
    const startOfWeek = new Date(today);
    startOfWeek.setDate(today.getDate() - today.getDay() + 1);
    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 6);
    const startOfWeekStr = startOfWeek.toISOString().split("T")[0]!;
    const endOfWeekStr = endOfWeek.toISOString().split("T")[0]!;
    const startOfMonth = `${today.getFullYear()}-${(today.getMonth() + 1).toString().padStart(2, "0")}-01`;

    const active = bookings.filter((b) => b.status !== "cancelled");
    const todayBk = active.filter((b) => b.booking_date === todayStr);
    const weekBk = active.filter((b) => b.booking_date >= startOfWeekStr && b.booking_date <= endOfWeekStr);
    const monthBk = active.filter((b) => b.booking_date >= startOfMonth);

    const sum = (arr: typeof bookings, field: "total_amount" | "seña_amount") =>
      arr.reduce((acc, b) => acc + (Number(b[field]) || 0), 0);

    // Build CSV
    const lines: string[] = [];
    const add = (...cols: (string | number)[]) => lines.push(cols.map((c) => `"${c}"`).join(","));
    const blank = () => lines.push("");

    // ─── RESUMEN GENERAL ───
    add("BOOKME DASHBOARD - " + (owner.business_name ?? ""));
    add("Generado:", new Date().toLocaleString("es-AR"));
    blank();

    add("=== RESUMEN DE TURNOS ===");
    add("Métrica", "Hoy", "Esta Semana", "Este Mes", "Total Histórico");
    add("Reservas activas", todayBk.length, weekBk.length, monthBk.length, active.length);
    add("Confirmadas",
      todayBk.filter((b) => b.status === "confirmed").length,
      weekBk.filter((b) => b.status === "confirmed").length,
      monthBk.filter((b) => b.status === "confirmed").length,
      active.filter((b) => b.status === "confirmed").length,
    );
    add("Pendientes",
      todayBk.filter((b) => b.status === "pending").length,
      weekBk.filter((b) => b.status === "pending").length,
      monthBk.filter((b) => b.status === "pending").length,
      active.filter((b) => b.status === "pending").length,
    );
    add("Canceladas",
      bookings.filter((b) => b.booking_date === todayStr && b.status === "cancelled").length,
      bookings.filter((b) => b.booking_date >= startOfWeekStr && b.booking_date <= endOfWeekStr && b.status === "cancelled").length,
      bookings.filter((b) => b.booking_date >= startOfMonth && b.status === "cancelled").length,
      bookings.filter((b) => b.status === "cancelled").length,
    );
    blank();

    add("=== RESUMEN FINANCIERO ===");
    add("Métrica", "Hoy", "Esta Semana", "Este Mes", "Total Histórico");
    add("Facturación ($)", sum(todayBk, "total_amount"), sum(weekBk, "total_amount"), sum(monthBk, "total_amount"), sum(active, "total_amount"));
    add("Señas cobradas ($)",
      sum(todayBk.filter((b) => b.seña_paid), "seña_amount"),
      sum(weekBk.filter((b) => b.seña_paid), "seña_amount"),
      sum(monthBk.filter((b) => b.seña_paid), "seña_amount"),
      sum(active.filter((b) => b.seña_paid), "seña_amount"),
    );
    add("Señas pendientes ($)",
      sum(todayBk.filter((b) => !b.seña_paid && Number(b.seña_amount) > 0), "seña_amount"),
      sum(weekBk.filter((b) => !b.seña_paid && Number(b.seña_amount) > 0), "seña_amount"),
      sum(monthBk.filter((b) => !b.seña_paid && Number(b.seña_amount) > 0), "seña_amount"),
      sum(active.filter((b) => !b.seña_paid && Number(b.seña_amount) > 0), "seña_amount"),
    );
    const avgToday = todayBk.length > 0 ? Math.round(sum(todayBk, "total_amount") / todayBk.length) : 0;
    const avgWeek = weekBk.length > 0 ? Math.round(sum(weekBk, "total_amount") / weekBk.length) : 0;
    const avgMonth = monthBk.length > 0 ? Math.round(sum(monthBk, "total_amount") / monthBk.length) : 0;
    const avgTotal = active.length > 0 ? Math.round(sum(active, "total_amount") / active.length) : 0;
    add("Ticket promedio ($)", avgToday, avgWeek, avgMonth, avgTotal);
    blank();

    // ─── POR CANCHA ───
    add("=== RENDIMIENTO POR CANCHA ===");
    add("Cancha", "Deporte", "Precio/h ($)", "Reservas", "Confirmadas", "Facturación ($)", "Señas Cobradas ($)");
    for (const court of courts) {
      const courtBk = active.filter((b) => b.court_id === court.id);
      add(
        court.name,
        court.sport,
        court.price_per_hour,
        courtBk.length,
        courtBk.filter((b) => b.status === "confirmed").length,
        sum(courtBk, "total_amount"),
        sum(courtBk.filter((b) => b.seña_paid), "seña_amount"),
      );
    }
    blank();

    // ─── CONTROL DE SEÑAS ───
    add("=== CONTROL DE SEÑAS ===");
    add("Fecha", "Cancha", "Cliente", "Teléfono", "Seña ($)", "Estado Seña", "Total ($)", "Estado Reserva");
    const señaBk = bookings.filter((b) => Number(b.seña_amount) > 0).sort((a, b) => (b.booking_date ?? "").localeCompare(a.booking_date ?? ""));
    for (const b of señaBk) {
      const court = courtsMap[b.court_id];
      add(
        b.booking_date,
        court?.name ?? "—",
        b.customer_name,
        b.customer_phone ?? "—",
        Number(b.seña_amount) || 0,
        b.seña_paid ? "PAGADA" : "PENDIENTE",
        Number(b.total_amount) || 0,
        b.status === "confirmed" ? "Confirmada" : b.status === "pending" ? "Pendiente" : "Cancelada",
      );
    }
    blank();

    // ─── TODAS LAS RESERVAS ───
    add("=== LISTADO COMPLETO DE RESERVAS ===");
    add("Fecha", "Hora Inicio", "Hora Fin", "Cancha", "Deporte", "Cliente", "Teléfono", "Monto ($)", "Seña Pagada", "Estado");
    for (const b of bookings) {
      const court = courtsMap[b.court_id];
      add(
        b.booking_date,
        (b.start_time ?? "").slice(0, 5),
        (b.end_time ?? "").slice(0, 5),
        court?.name ?? "—",
        court?.sport ?? "—",
        b.customer_name,
        b.customer_phone ?? "—",
        Number(b.total_amount) || 0,
        b.seña_paid ? "Sí" : Number(b.seña_amount) > 0 ? "Pendiente" : "N/A",
        b.status === "confirmed" ? "Confirmada" : b.status === "pending" ? "Pendiente" : "Cancelada",
      );
    }

    const csv = "\uFEFF" + lines.join("\n"); // BOM for Excel UTF-8
    const filename = `BookMe_Dashboard_${todayStr}.csv`;

    return new Response(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    console.error("GET /api/courts/dashboard:", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
