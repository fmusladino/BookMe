import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
// Import dinámico para evitar error si googleapis no está instalado
async function getSync() {
  try {
    return await import("@/lib/google-calendar/sync");
  } catch {
    return null;
  }
}

/**
 * POST /api/webhooks/google-calendar
 * Recibe push notifications de Google Calendar cuando hay cambios.
 * Google envía headers especiales: X-Goog-Channel-ID, X-Goog-Resource-State
 */
export async function POST(request: NextRequest) {
  try {
    const channelId = request.headers.get("x-goog-channel-id");
    const resourceState = request.headers.get("x-goog-resource-state");

    // Google envía un "sync" notification al registrar el watch — ignorar
    if (resourceState === "sync") {
      return NextResponse.json({ ok: true });
    }

    if (!channelId) {
      return NextResponse.json({ error: "Missing channel ID" }, { status: 400 });
    }

    // Buscar a qué profesional pertenece este channel
    const admin = createAdminClient();
    const { data: conn } = await admin
      .from("google_calendar_connections")
      .select("professional_id")
      .eq("channel_id", channelId)
      .eq("is_active", true)
      .single();

    if (!conn) {
      // Canal no reconocido — puede ser un watch expirado
      return NextResponse.json({ ok: true });
    }

    // Procesar cambios en background (no bloquear response a Google)
    // Google espera respuesta rápida (<10s)
    const syncMod = await getSync();
    if (syncMod) {
      syncMod.processGoogleCalendarChanges(conn.professional_id).catch((err) =>
        console.error("[GCal Webhook] Sync error for", conn.professional_id, err),
      );
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[GCal Webhook] Error:", err);
    // Siempre responder 200 a Google para evitar retries excesivos
    return NextResponse.json({ ok: true });
  }
}
