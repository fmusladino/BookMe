import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

/**
 * GET /api/courts/stats — Estadísticas de canchas del dueño autenticado
 */
export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

    const today = new Date().toISOString().split("T")[0];

    const [courtsResult, bookingsResult, todayResult] = await Promise.all([
      supabase.from("courts").select("id, is_active").eq("owner_id", user.id),
      supabase.from("court_bookings").select("id, status").eq("owner_id", user.id),
      supabase.from("court_bookings").select("id").eq("owner_id", user.id).eq("booking_date", today ?? ""),
    ]);

    const courts = courtsResult.data ?? [];
    const bookings = bookingsResult.data ?? [];
    const todayBookings = todayResult.data ?? [];

    return NextResponse.json({
      totalCourts: courts.length,
      activeCourts: courts.filter((c) => c.is_active).length,
      totalBookings: bookings.length,
      pendingBookings: bookings.filter((b) => b.status === "pending").length,
      confirmedBookings: bookings.filter((b) => b.status === "confirmed").length,
      cancelledBookings: bookings.filter((b) => b.status === "cancelled").length,
      todayBookings: todayBookings.length,
    });
  } catch (error) {
    console.error("GET /api/courts/stats:", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
