/**
 * Google Calendar API client — server-only
 * Maneja OAuth tokens, refresh, y operaciones CRUD de eventos.
 *
 * googleapis se carga de forma lazy para no romper el build si no está instalado.
 */
import { createAdminClient } from "@/lib/supabase/server";

// Configuración OAuth2
const GOOGLE_CLIENT_ID = process.env["GOOGLE_CALENDAR_CLIENT_ID"] || "";
const GOOGLE_CLIENT_SECRET = process.env["GOOGLE_CALENDAR_CLIENT_SECRET"] || "";
const GOOGLE_REDIRECT_URI = `${process.env["NEXT_PUBLIC_APP_URL"]}/api/google-calendar/callback`;

// Scopes requeridos para sync bidireccional
export const GOOGLE_CALENDAR_SCOPES = [
  "https://www.googleapis.com/auth/calendar.events",
  "https://www.googleapis.com/auth/calendar.readonly",
];

// Lazy-load googleapis para no romper si no está instalado
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function getGoogleApis(): any {
  try {
    // require() no es resuelto por webpack de la misma forma que import
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { google } = require("googleapis");
    return google;
  } catch {
    throw new Error(
      "El paquete 'googleapis' no está instalado. Ejecutá: pnpm add googleapis"
    );
  }
}

// ─── OAuth2 Client ──────────────────────────────────────────────────────────

export function createOAuth2Client() {
  const google = getGoogleApis();
  return new google.auth.OAuth2(
    GOOGLE_CLIENT_ID,
    GOOGLE_CLIENT_SECRET,
    GOOGLE_REDIRECT_URI,
  );
}

/**
 * Genera la URL de autorización de Google
 */
export function getAuthorizationUrl(state: string): string {
  const oauth2 = createOAuth2Client();
  return oauth2.generateAuthUrl({
    access_type: "offline",
    prompt: "consent",
    scope: GOOGLE_CALENDAR_SCOPES,
    state,
  });
}

/**
 * Intercambia el authorization code por tokens
 */
export async function exchangeCodeForTokens(code: string) {
  const oauth2 = createOAuth2Client();
  const { tokens } = await oauth2.getToken(code);
  return tokens;
}

// ─── Authenticated Calendar Client ──────────────────────────────────────────

interface GCalConnection {
  id: string;
  professional_id: string;
  access_token: string;
  refresh_token: string;
  token_expires_at: string;
  calendar_id: string;
  sync_token: string | null;
  channel_id: string | null;
  channel_expiration: string | null;
  is_active: boolean;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
interface CalendarClient { calendar: any; connection: GCalConnection }

/**
 * Obtiene un cliente autenticado de Google Calendar para un profesional.
 * Refresca el token automáticamente si está expirado.
 */
export async function getCalendarClient(
  professionalId: string,
): Promise<CalendarClient | null> {
  const google = getGoogleApis();
  const admin = createAdminClient();

  const { data: conn, error } = await admin
    .from("google_calendar_connections")
    .select("*")
    .eq("professional_id", professionalId)
    .eq("is_active", true)
    .single();

  if (error || !conn) return null;

  const connection = conn as unknown as GCalConnection;
  const oauth2 = createOAuth2Client();

  oauth2.setCredentials({
    access_token: connection.access_token,
    refresh_token: connection.refresh_token,
  });

  // Verificar si el token está expirado (con 5 min de margen)
  const expiresAt = new Date(connection.token_expires_at);
  const fiveMinFromNow = new Date(Date.now() + 5 * 60 * 1000);

  if (expiresAt < fiveMinFromNow) {
    try {
      const { credentials } = await oauth2.refreshAccessToken();
      await admin
        .from("google_calendar_connections")
        .update({
          access_token: credentials.access_token!,
          token_expires_at: new Date(credentials.expiry_date!).toISOString(),
        })
        .eq("id", connection.id);

      oauth2.setCredentials(credentials);
      connection.access_token = credentials.access_token!;
      connection.token_expires_at = new Date(credentials.expiry_date!).toISOString();
    } catch (refreshError) {
      console.error("[GCal] Error refreshing token:", refreshError);
      await admin
        .from("google_calendar_connections")
        .update({ is_active: false })
        .eq("id", connection.id);
      return null;
    }
  }

  const calendar = google.calendar({ version: "v3", auth: oauth2 });
  return { calendar, connection };
}

// ─── Event Operations ───────────────────────────────────────────────────────

interface BookMeAppointment {
  id: string;
  starts_at: string;
  ends_at: string;
  status: string;
  notes?: string | null;
  patient?: { full_name: string; phone?: string | null } | null;
  service?: { name: string; duration_minutes: number } | null;
}

/**
 * Crea un evento en Google Calendar y devuelve el google_event_id
 */
export async function createGoogleEvent(
  professionalId: string,
  appointment: BookMeAppointment,
): Promise<string | null> {
  const client = await getCalendarClient(professionalId);
  if (!client) return null;

  const { calendar, connection } = client;

  const summary = appointment.service?.name
    ? `${appointment.patient?.full_name ?? "Paciente"} — ${appointment.service.name}`
    : `Turno: ${appointment.patient?.full_name ?? "Paciente"}`;

  const description = [
    appointment.notes ? `Notas: ${appointment.notes}` : null,
    appointment.patient?.phone ? `Tel: ${appointment.patient.phone}` : null,
    `Gestionado por BookMe`,
  ]
    .filter(Boolean)
    .join("\n");

  try {
    const res = await calendar.events.insert({
      calendarId: connection.calendar_id,
      requestBody: {
        summary,
        description,
        start: {
          dateTime: appointment.starts_at,
          timeZone: "America/Argentina/Buenos_Aires",
        },
        end: {
          dateTime: appointment.ends_at,
          timeZone: "America/Argentina/Buenos_Aires",
        },
        extendedProperties: {
          private: {
            bookme_appointment_id: appointment.id,
            source: "bookme",
          },
        },
        reminders: {
          useDefault: false,
          overrides: [{ method: "popup", minutes: 30 }],
        },
      },
    });

    return res.data.id ?? null;
  } catch (err) {
    console.error("[GCal] Error creating event:", err);
    return null;
  }
}

/**
 * Actualiza un evento existente en Google Calendar
 */
export async function updateGoogleEvent(
  professionalId: string,
  googleEventId: string,
  appointment: BookMeAppointment,
): Promise<boolean> {
  const client = await getCalendarClient(professionalId);
  if (!client) return false;

  const { calendar, connection } = client;

  const summary = appointment.service?.name
    ? `${appointment.patient?.full_name ?? "Paciente"} — ${appointment.service.name}`
    : `Turno: ${appointment.patient?.full_name ?? "Paciente"}`;

  try {
    await calendar.events.patch({
      calendarId: connection.calendar_id,
      eventId: googleEventId,
      requestBody: {
        summary,
        start: {
          dateTime: appointment.starts_at,
          timeZone: "America/Argentina/Buenos_Aires",
        },
        end: {
          dateTime: appointment.ends_at,
          timeZone: "America/Argentina/Buenos_Aires",
        },
        status: appointment.status === "cancelled" ? "cancelled" : "confirmed",
      },
    });
    return true;
  } catch (err) {
    console.error("[GCal] Error updating event:", err);
    return false;
  }
}

/**
 * Elimina (cancela) un evento en Google Calendar
 */
export async function deleteGoogleEvent(
  professionalId: string,
  googleEventId: string,
): Promise<boolean> {
  const client = await getCalendarClient(professionalId);
  if (!client) return false;

  const { calendar, connection } = client;

  try {
    await calendar.events.delete({
      calendarId: connection.calendar_id,
      eventId: googleEventId,
    });
    return true;
  } catch (err) {
    console.error("[GCal] Error deleting event:", err);
    return false;
  }
}

// ─── Incremental Sync ───────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export interface GCalSyncResult {
  events: any[];
  nextSyncToken: string | null;
}

/**
 * Obtiene cambios incrementales desde Google Calendar usando sync tokens.
 */
export async function getIncrementalChanges(
  professionalId: string,
): Promise<GCalSyncResult | null> {
  const client = await getCalendarClient(professionalId);
  if (!client) return null;

  const { calendar, connection } = client;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const allEvents: any[] = [];
  let pageToken: string | undefined;
  let nextSyncToken: string | null = null;

  try {
    do {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const params: any = {
        calendarId: connection.calendar_id,
        singleEvents: true,
        showDeleted: true,
      };

      if (connection.sync_token && !pageToken) {
        params.syncToken = connection.sync_token;
      } else if (!pageToken) {
        params.timeMin = new Date().toISOString();
        params.maxResults = 250;
      }

      if (pageToken) {
        params.pageToken = pageToken;
      }

      const res = await calendar.events.list(params);
      const items = res.data.items ?? [];
      allEvents.push(...items);
      pageToken = res.data.nextPageToken ?? undefined;

      if (res.data.nextSyncToken) {
        nextSyncToken = res.data.nextSyncToken;
      }
    } while (pageToken);

    if (nextSyncToken) {
      const admin = createAdminClient();
      await admin
        .from("google_calendar_connections")
        .update({
          sync_token: nextSyncToken,
          last_synced_at: new Date().toISOString(),
        })
        .eq("id", connection.id);
    }

    return { events: allEvents, nextSyncToken };
  } catch (err: unknown) {
    const error = err as { code?: number };
    if (error.code === 410) {
      console.warn("[GCal] Sync token expired, resetting...");
      const admin = createAdminClient();
      await admin
        .from("google_calendar_connections")
        .update({ sync_token: null })
        .eq("id", connection.id);
      return getIncrementalChanges(professionalId);
    }
    console.error("[GCal] Error getting incremental changes:", err);
    return null;
  }
}

// ─── Watch (Push Notifications) ─────────────────────────────────────────────

/**
 * Registra un webhook para recibir notificaciones push de cambios en el calendario.
 */
export async function watchCalendar(professionalId: string): Promise<boolean> {
  const client = await getCalendarClient(professionalId);
  if (!client) return false;

  const { calendar, connection } = client;
  const admin = createAdminClient();

  const channelId = `bookme-${professionalId}-${Date.now()}`;
  const webhookUrl = `${process.env["NEXT_PUBLIC_APP_URL"]}/api/webhooks/google-calendar`;

  try {
    const res = await calendar.events.watch({
      calendarId: connection.calendar_id,
      requestBody: {
        id: channelId,
        type: "web_hook",
        address: webhookUrl,
        expiration: String(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    });

    await admin
      .from("google_calendar_connections")
      .update({
        channel_id: channelId,
        channel_expiration: res.data.expiration
          ? new Date(Number(res.data.expiration)).toISOString()
          : null,
      })
      .eq("id", connection.id);

    return true;
  } catch (err) {
    console.error("[GCal] Error watching calendar:", err);
    return false;
  }
}

/**
 * Detiene el webhook de un canal (al desconectar Google Calendar)
 */
export async function stopWatching(professionalId: string): Promise<boolean> {
  const client = await getCalendarClient(professionalId);
  if (!client) return false;

  const { calendar, connection } = client;

  if (!connection.channel_id) return true;

  try {
    await calendar.channels.stop({
      requestBody: {
        id: connection.channel_id,
        resourceId: connection.calendar_id,
      },
    });
    return true;
  } catch (err) {
    console.error("[GCal] Error stopping watch:", err);
    return false;
  }
}
