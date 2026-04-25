import twilio from "twilio";

// Inicialización lazy para evitar crasheos en build/dev sin credenciales
let _client: ReturnType<typeof twilio> | null = null;

function getClient() {
  if (!_client) {
    const sid = process.env["TWILIO_ACCOUNT_SID"];
    const token = process.env["TWILIO_AUTH_TOKEN"];
    if (!sid || !token || sid === "placeholder" || !sid.startsWith("AC")) {
      throw new Error("Twilio no configurado: TWILIO_ACCOUNT_SID y TWILIO_AUTH_TOKEN requeridos");
    }
    _client = twilio(sid, token);
  }
  return _client;
}

const FROM = process.env["TWILIO_WHATSAPP_FROM"] ?? "whatsapp:+14155238886";

export interface WhatsAppMessageData {
  to: string; // número en formato +54XXXXXXXXXX
  patientName: string;
  professionalName: string;
  startsAt: Date;
  serviceName?: string;
}

// Formatea fecha en español para Argentina
function formatDateAR(date: Date): string {
  return date.toLocaleString("es-AR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "America/Argentina/Buenos_Aires",
  });
}

// Normaliza número a formato WhatsApp: whatsapp:+54XXXXXXXXXX
function toWhatsAppNumber(phone: string): string {
  const clean = phone.replace(/\D/g, "");
  const withCountry = clean.startsWith("54") ? clean : `54${clean}`;
  return `whatsapp:+${withCountry}`;
}

export async function sendConfirmationWhatsApp(data: WhatsAppMessageData) {
  const dateStr = formatDateAR(data.startsAt);
  const service = data.serviceName ? `\n*Servicio:* ${data.serviceName}` : "";

  return getClient().messages.create({
    from: FROM,
    to: toWhatsAppNumber(data.to),
    body: `✅ *Turno confirmado*\n\nHola ${data.patientName}, tu turno con *${data.professionalName}* está confirmado.\n\n*Fecha:* ${dateStr}${service}\n\n_BookMe — bookme.ar_`,
  });
}

export async function sendReminderWhatsApp(
  data: WhatsAppMessageData & { offsetMinutes?: number }
) {
  const dateStr = formatDateAR(data.startsAt);
  const service = data.serviceName ? `\n*Servicio:* ${data.serviceName}` : "";
  const offsetLabel = formatOffsetLabelWpp(data.offsetMinutes ?? 1440);

  return getClient().messages.create({
    from: FROM,
    to: toWhatsAppNumber(data.to),
    body: `⏰ *Recordatorio de turno*\n\nHola ${data.patientName}, ${offsetLabel} tenés turno con *${data.professionalName}*.\n\n*Fecha:* ${dateStr}${service}\n\n_BookMe — bookme.ar_`,
  });
}

function formatOffsetLabelWpp(minutes: number): string {
  if (minutes < 60) return `en ${minutes} minutos`;
  if (minutes === 1440) return "mañana";
  if (minutes === 2880) return "pasado mañana";
  if (minutes % 1440 === 0) return `en ${minutes / 1440} días`;
  if (minutes % 60 === 0) {
    const hours = minutes / 60;
    return hours === 1 ? "en 1 hora" : `en ${hours} horas`;
  }
  return `en ${Math.round(minutes / 60)} horas`;
}

export async function sendRescheduleWhatsApp(
  data: WhatsAppMessageData & { oldStartsAt: Date }
) {
  const newDateStr = formatDateAR(data.startsAt);

  return getClient().messages.create({
    from: FROM,
    to: toWhatsAppNumber(data.to),
    body: `📅 *Turno reprogramado*\n\nHola ${data.patientName}, tu turno con *${data.professionalName}* fue reprogramado.\n\n*Nuevo horario:* ${newDateStr}\n\n_BookMe — bookme.ar_`,
  });
}

export async function sendCancellationWhatsApp(data: WhatsAppMessageData) {
  const dateStr = formatDateAR(data.startsAt);

  return getClient().messages.create({
    from: FROM,
    to: toWhatsAppNumber(data.to),
    body: `❌ *Turno cancelado*\n\nHola ${data.patientName}, tu turno con *${data.professionalName}* del ${dateStr} fue cancelado.\n\nPodés reservar un nuevo turno desde bookme.ar\n\n_BookMe_`,
  });
}

// ─── Payment Reminder WhatsApp (impago de abono mensual) ───────────────────

export type PaymentReminderKindWA = "soft" | "firm" | "final" | "read_only";

export interface PaymentReminderWAData {
  to: string;            // teléfono del profesional
  professionalName: string;
  amount: number;
  currency: string;
  daysOverdue: number;
  retryUrl?: string;
}

/**
 * Manda recordatorio de impago vía WhatsApp al profesional.
 * El tono escala con el `kind` (soft → firm → final → read_only).
 */
export async function sendPaymentReminderWhatsApp(
  kind: PaymentReminderKindWA,
  data: PaymentReminderWAData
) {
  const url = data.retryUrl ?? "https://bookme.ar/dashboard/plan";
  const amountStr = `${data.currency} ${data.amount.toLocaleString("es-AR", { minimumFractionDigits: 2 })}`;

  let body: string;
  switch (kind) {
    case "soft":
      body =
        `💳 *Pago pendiente*\n\nHola ${data.professionalName}, no pudimos procesar tu abono mensual de ${amountStr}. ` +
        `Revisá tu medio de pago para evitar inconvenientes:\n${url}\n\n_BookMe_`;
      break;
    case "firm":
      body =
        `⚠️ *Tu pago sigue pendiente*\n\nHola ${data.professionalName}, hace ${data.daysOverdue} días que no pudimos cobrar tu abono (${amountStr}). ` +
        `Actualizá tu medio de pago acá:\n${url}\n\n_BookMe_`;
      break;
    case "final":
      body =
        `🚨 *Tu cuenta será suspendida en ${15 - data.daysOverdue} día(s)*\n\nHola ${data.professionalName}, esta es la última notificación. ` +
        `Si no regularizás el pago de ${amountStr}, tu cuenta pasará a modo solo lectura.\n${url}\n\n_BookMe_`;
      break;
    case "read_only":
      body =
        `🔒 *Tu cuenta está en modo solo lectura*\n\nHola ${data.professionalName}, pasaron 15 días desde el fallo de cobro y tu cuenta fue congelada. ` +
        `Tus pacientes ya no pueden reservar online. Reactivala regularizando el pago:\n${url}\n\n_BookMe_`;
      break;
  }

  return getClient().messages.create({
    from: FROM,
    to: toWhatsAppNumber(data.to),
    body,
  });
}
