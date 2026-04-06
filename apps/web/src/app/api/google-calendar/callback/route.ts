import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";

/**
 * GET /api/google-calendar/callback
 * Recibe el callback de Google OAuth2 después de que el usuario autorice.
 */
export async function GET(request: NextRequest) {
  const appUrl = process.env["NEXT_PUBLIC_APP_URL"] || "http://localhost:3000";

  try {
    const client = await import("@/lib/google-calendar/client").catch(() => null);
    const syncMod = await import("@/lib/google-calendar/sync").catch(() => null);

    if (!client) {
      return NextResponse.redirect(`${appUrl}/dashboard/configuracion?gcal=error&reason=module_missing`);
    }

    const { searchParams } = new URL(request.url);
    const code = searchParams.get("code");
    const state = searchParams.get("state");
    const errorParam = searchParams.get("error");

    if (errorParam) {
      return NextResponse.redirect(`${appUrl}/dashboard/configuracion?gcal=cancelled`);
    }

    if (!code || !state) {
      return NextResponse.redirect(`${appUrl}/dashboard/configuracion?gcal=error&reason=missing_params`);
    }

    const [userId] = state.split(":");
    if (!userId) {
      return NextResponse.redirect(`${appUrl}/dashboard/configuracion?gcal=error&reason=invalid_state`);
    }

    const tokens = await client.exchangeCodeForTokens(code);

    if (!tokens.access_token || !tokens.refresh_token) {
      return NextResponse.redirect(`${appUrl}/dashboard/configuracion?gcal=error&reason=no_tokens`);
    }

    const admin = createAdminClient();

    const { error: dbError } = await admin
      .from("google_calendar_connections")
      .upsert(
        {
          professional_id: userId,
          access_token: tokens.access_token,
          refresh_token: tokens.refresh_token,
          token_expires_at: new Date(tokens.expiry_date ?? Date.now() + 3600000).toISOString(),
          calendar_id: "primary",
          is_active: true,
          sync_token: null,
          channel_id: null,
          channel_expiration: null,
        },
        { onConflict: "professional_id" },
      );

    if (dbError) {
      console.error("[GCal Callback] DB error:", dbError);
      return NextResponse.redirect(`${appUrl}/dashboard/configuracion?gcal=error&reason=db_error`);
    }

    // Fire and forget
    if (syncMod) {
      syncMod.processGoogleCalendarChanges(userId).catch((err) =>
        console.error("[GCal Callback] Initial sync error:", err),
      );
    }
    client.watchCalendar(userId).catch((err) =>
      console.error("[GCal Callback] Watch error:", err),
    );

    return NextResponse.redirect(`${appUrl}/dashboard/configuracion?gcal=success`);
  } catch (err) {
    console.error("[GCal Callback] Error:", err);
    return NextResponse.redirect(`${appUrl}/dashboard/configuracion?gcal=error&reason=unknown`);
  }
}
