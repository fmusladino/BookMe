import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { randomUUID } from "crypto";

/**
 * GET /api/google-calendar/connect
 * Inicia el flujo OAuth2 de Google Calendar.
 */
export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user }, error } = await supabase.auth.getUser();

    if (error || !user) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const client = await import("@/lib/google-calendar/client").catch(() => null);
    if (!client) {
      return NextResponse.json({ error: "Google Calendar no disponible. Instale googleapis." }, { status: 501 });
    }

    const state = `${user.id}:${randomUUID()}`;
    const url = client.getAuthorizationUrl(state);

    return NextResponse.redirect(url);
  } catch (err) {
    console.error("[GCal Connect] Error:", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
