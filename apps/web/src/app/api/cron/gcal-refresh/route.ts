import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { verifyCronAuth } from "@/lib/security";

/**
 * GET /api/cron/gcal-refresh
 * Cron job diario: renueva webhooks y hace sync incremental de seguridad.
 */
export async function GET(request: NextRequest) {
  const authError = verifyCronAuth(request);
  if (authError) return authError;

  const client = await import("@/lib/google-calendar/client").catch(() => null);
  const syncMod = await import("@/lib/google-calendar/sync").catch(() => null);

  if (!client || !syncMod) {
    return NextResponse.json({ message: "googleapis not installed, skipping", refreshed: 0 });
  }

  const admin = createAdminClient();

  const { data: connections } = await admin
    .from("google_calendar_connections")
    .select("professional_id, channel_id, channel_expiration")
    .eq("is_active", true);

  if (!connections || connections.length === 0) {
    return NextResponse.json({ message: "No active connections", refreshed: 0 });
  }

  let refreshed = 0;
  let synced = 0;
  const twoDaysFromNow = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000);

  for (const conn of connections) {
    const shouldRenew =
      !conn.channel_id ||
      !conn.channel_expiration ||
      new Date(conn.channel_expiration) < twoDaysFromNow;

    if (shouldRenew) {
      const success = await client.watchCalendar(conn.professional_id);
      if (success) refreshed++;
    }

    try {
      const result = await syncMod.processGoogleCalendarChanges(conn.professional_id);
      if (result && result.processed > 0) synced += result.processed;
    } catch (err) {
      console.error(`[GCal Cron] Sync error for ${conn.professional_id}:`, err);
    }
  }

  return NextResponse.json({
    message: "GCal refresh completed",
    connections: connections.length,
    refreshed,
    synced,
  });
}
