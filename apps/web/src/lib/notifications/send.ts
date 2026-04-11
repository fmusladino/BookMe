/**
 * Helper centralizado para enviar notificaciones de turnos.
 * Envía email + WhatsApp en paralelo, sin bloquear el flujo principal.
 * Los errores se logean pero nunca rompen la operación principal.
 */
import {
  sendConfirmationEmail,
  sendRescheduleEmail,
  sendCancellationEmail,
  sendConfirmationWhatsApp,
  sendRescheduleWhatsApp,
  sendCancellationWhatsApp,
  sendPushNotification,
  buildNewBookingPush,
} from "@bookme/notifications";
import { createAdminClient } from "@/lib/supabase/server";

export interface NotificationContext {
  appointmentId: string;
  patientName: string;
  patientEmail: string | null;
  patientPhone: string | null;
  professionalName: string;
  specialty: string;
  startsAt: Date;
  serviceName?: string;
}

// Verifica si las credenciales de notificación están configuradas
function isEmailConfigured(): boolean {
  const key = process.env["RESEND_API_KEY"];
  return !!key && key !== "placeholder";
}

function isWhatsAppConfigured(): boolean {
  const sid = process.env["TWILIO_ACCOUNT_SID"];
  return !!sid && sid !== "placeholder" && sid.startsWith("AC");
}

/**
 * Envía notificación de confirmación de turno (email + WhatsApp).
 * Se ejecuta en background — no bloquea la respuesta de la API.
 */
export function sendBookingConfirmation(ctx: NotificationContext) {
  // Fire and forget — no await
  _sendBookingConfirmationAsync(ctx).catch((err) =>
    console.error(`[Notifications] Error confirmación turno ${ctx.appointmentId}:`, err)
  );
}

async function _sendBookingConfirmationAsync(ctx: NotificationContext) {
  const promises: Promise<unknown>[] = [];
  const baseUrl = process.env["NEXT_PUBLIC_APP_URL"] ?? "https://bookme.ar";

  if (ctx.patientEmail && isEmailConfigured()) {
    promises.push(
      sendConfirmationEmail({
        to: ctx.patientEmail,
        patientName: ctx.patientName,
        professionalName: ctx.professionalName,
        specialty: ctx.specialty,
        startsAt: ctx.startsAt,
        serviceName: ctx.serviceName,
        bookingUrl: `${baseUrl}/mis-turnos`,
      })
    );
  }

  if (ctx.patientPhone && isWhatsAppConfigured()) {
    promises.push(
      sendConfirmationWhatsApp({
        to: ctx.patientPhone,
        patientName: ctx.patientName,
        professionalName: ctx.professionalName,
        startsAt: ctx.startsAt,
        serviceName: ctx.serviceName,
      })
    );
  }

  const results = await Promise.allSettled(promises);
  results.forEach((r, i) => {
    if (r.status === "rejected") {
      console.error(`[Notifications] Confirmación canal ${i} falló:`, r.reason);
    }
  });
}

/**
 * Envía notificación de reprogramación de turno (email + WhatsApp).
 */
export function sendRescheduleNotification(
  ctx: NotificationContext & { oldStartsAt: Date }
) {
  _sendRescheduleAsync(ctx).catch((err) =>
    console.error(`[Notifications] Error reprogramación turno ${ctx.appointmentId}:`, err)
  );
}

async function _sendRescheduleAsync(
  ctx: NotificationContext & { oldStartsAt: Date }
) {
  const promises: Promise<unknown>[] = [];
  const baseUrl = process.env["NEXT_PUBLIC_APP_URL"] ?? "https://bookme.ar";

  if (ctx.patientEmail && isEmailConfigured()) {
    promises.push(
      sendRescheduleEmail({
        to: ctx.patientEmail,
        patientName: ctx.patientName,
        professionalName: ctx.professionalName,
        specialty: ctx.specialty,
        startsAt: ctx.startsAt,
        oldStartsAt: ctx.oldStartsAt,
        serviceName: ctx.serviceName,
        bookingUrl: `${baseUrl}/mis-turnos`,
      })
    );
  }

  if (ctx.patientPhone && isWhatsAppConfigured()) {
    promises.push(
      sendRescheduleWhatsApp({
        to: ctx.patientPhone,
        patientName: ctx.patientName,
        professionalName: ctx.professionalName,
        startsAt: ctx.startsAt,
        oldStartsAt: ctx.oldStartsAt,
        serviceName: ctx.serviceName,
      })
    );
  }

  const results = await Promise.allSettled(promises);
  results.forEach((r, i) => {
    if (r.status === "rejected") {
      console.error(`[Notifications] Reprogramación canal ${i} falló:`, r.reason);
    }
  });
}

/**
 * Envía notificación de cancelación de turno (email + WhatsApp).
 */
export function sendCancellationNotification(ctx: NotificationContext) {
  _sendCancellationAsync(ctx).catch((err) =>
    console.error(`[Notifications] Error cancelación turno ${ctx.appointmentId}:`, err)
  );
}

async function _sendCancellationAsync(ctx: NotificationContext) {
  const promises: Promise<unknown>[] = [];

  if (ctx.patientEmail && isEmailConfigured()) {
    promises.push(
      sendCancellationEmail({
        to: ctx.patientEmail,
        patientName: ctx.patientName,
        professionalName: ctx.professionalName,
        specialty: ctx.specialty,
        startsAt: ctx.startsAt,
        serviceName: ctx.serviceName,
      })
    );
  }

  if (ctx.patientPhone && isWhatsAppConfigured()) {
    promises.push(
      sendCancellationWhatsApp({
        to: ctx.patientPhone,
        patientName: ctx.patientName,
        professionalName: ctx.professionalName,
        startsAt: ctx.startsAt,
        serviceName: ctx.serviceName,
      })
    );
  }

  const results = await Promise.allSettled(promises);
  results.forEach((r, i) => {
    if (r.status === "rejected") {
      console.error(`[Notifications] Cancelación canal ${i} falló:`, r.reason);
    }
  });
}

// Verifica si las credenciales VAPID de push están configuradas
function isPushConfigured(): boolean {
  const key = process.env["NEXT_PUBLIC_VAPID_PUBLIC_KEY"];
  return !!key && key !== "placeholder";
}

/**
 * Envía push notification al profesional cuando un paciente reserva.
 * Busca las suscripciones push del profesional y envía a todas.
 */
export function sendPushToProNewBooking(
  professionalId: string,
  patientName: string,
  startsAt: Date
) {
  if (!isPushConfigured()) return;

  _sendPushToProAsync(professionalId, patientName, startsAt).catch((err) =>
    console.error(`[Notifications] Error push al profesional ${professionalId}:`, err)
  );
}

async function _sendPushToProAsync(
  professionalId: string,
  patientName: string,
  startsAt: Date
) {
  const supabase = createAdminClient();

  const { data: subscriptions } = await supabase
    .from("push_subscriptions")
    .select("endpoint, p256dh, auth")
    .eq("user_id", professionalId);

  if (!subscriptions || subscriptions.length === 0) return;

  const dateStr = startsAt.toLocaleString("es-AR", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "America/Argentina/Buenos_Aires",
  });

  const payload = buildNewBookingPush(patientName, dateStr);

  const results = await Promise.allSettled(
    subscriptions.map((sub) =>
      sendPushNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
        payload
      )
    )
  );

  results.forEach((r, i) => {
    if (r.status === "rejected") {
      console.error(`[Notifications] Push subscription ${i} falló:`, r.reason);
    }
  });
}

/**
 * Obtiene el contexto de notificación a partir de un appointmentId.
 * Usa admin client para acceder a los datos sin restricciones de RLS.
 */
export async function getNotificationContext(
  appointmentId: string
): Promise<NotificationContext | null> {
  // Usa admin client para acceder sin restricciones de RLS
  const supabase = createAdminClient();
  const { data: appt, error } = await supabase
    .from("appointments")
    .select(
      `
      id,
      starts_at,
      patient:patients(full_name, email, phone),
      professional:professionals(
        specialty,
        profile:profiles!id(full_name)
      ),
      service:services(name)
    `
    )
    .eq("id", appointmentId)
    .single();

  if (error || !appt) {
    console.error("[Notifications] Error obteniendo datos del turno:", error);
    return null;
  }

  const patient = Array.isArray(appt.patient) ? appt.patient[0] : appt.patient;
  const professional = Array.isArray(appt.professional)
    ? appt.professional[0]
    : appt.professional;
  const service = Array.isArray(appt.service) ? appt.service[0] : appt.service;
  const profile = professional?.profile;
  const profName = Array.isArray(profile) ? profile[0]?.full_name : profile?.full_name;

  if (!patient || !professional) return null;

  return {
    appointmentId: appt.id,
    patientName: patient.full_name,
    patientEmail: patient.email,
    patientPhone: patient.phone,
    professionalName: profName ?? "",
    specialty: professional.specialty,
    startsAt: new Date(appt.starts_at),
    serviceName: service?.name,
  };
}
