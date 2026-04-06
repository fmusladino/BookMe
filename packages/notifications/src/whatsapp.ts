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

export async function sendReminderWhatsApp(data: WhatsAppMessageData) {
  const dateStr = formatDateAR(data.startsAt);
  const service = data.serviceName ? `\n*Servicio:* ${data.serviceName}` : "";

  return getClient().messages.create({
    from: FROM,
    to: toWhatsAppNumber(data.to),
    body: `⏰ *Recordatorio de turno*\n\nHola ${data.patientName}, mañana tenés turno con *${data.professionalName}*.\n\n*Fecha:* ${dateStr}${service}\n\n_BookMe — bookme.ar_`,
  });
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
