import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * GET /api/google-calendar/status
 * Devuelve si el profesional tiene Google Calendar conectado.
 */
export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const { data: conn } = await supabase
      .from("google_calendar_connections")
      .select("is_active, calendar_id, last_synced_at, created_at")
      .eq("professional_id", user.id)
      .single();

    return NextResponse.json({
      connected: conn?.is_active ?? false,
      calendarId: conn?.calendar_id ?? null,
      lastSyncedAt: conn?.last_synced_at ?? null,
      connectedSince: conn?.is_active ? conn.created_at : null,
    });
  } catch (err) {
    console.error("[GCal Status] Error:", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
