import { NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";

/**
 * POST /api/google-calendar/disconnect
 * Desconecta Google Calendar: revoca tokens, detiene webhook, desactiva conexión.
 */
export async function POST() {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const client = await import("@/lib/google-calendar/client").catch(() => null);

    // 1. Detener webhook
    if (client) {
      await client.stopWatching(user.id).catch(() => { /* ignorar si falla */ });
    }

    // 2. Revocar tokens de Google
    const admin = createAdminClient();
    const { data: conn } = await admin
      .from("google_calendar_connections")
      .select("access_token")
      .eq("professional_id", user.id)
      .single();

    if (conn?.access_token && client) {
      try {
        const oauth2 = client.createOAuth2Client();
        await oauth2.revokeToken(conn.access_token);
      } catch {
        // Si falla la revocación, no bloquear el flujo
      }
    }

    // 3. Desactivar conexión
    await admin
      .from("google_calendar_connections")
      .update({
        is_active: false,
        channel_id: null,
        channel_expiration: null,
        sync_token: null,
      })
      .eq("professional_id", user.id);

    // 4. Limpiar google_event_id de appointments futuros
    await admin
      .from("appointments")
      .update({ google_event_id: null })
      .eq("professional_id", user.id)
      .not("google_event_id", "is", null);

    // 5. Eliminar bloqueos de Google Calendar
    await admin
      .from("schedule_blocks")
      .delete()
      .eq("professional_id", user.id)
      .not("google_event_id", "is", null);

    return NextResponse.json({ message: "Google Calendar desconectado" });
  } catch (err) {
    console.error("[GCal Disconnect] Error:", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
