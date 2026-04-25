import { Resend } from "resend";

// Inicialización lazy para evitar error en build time cuando la env var no existe
let _resend: Resend | null = null;
function getResend(): Resend {
  if (!_resend) {
    _resend = new Resend(process.env["RESEND_API_KEY"] || "");
  }
  return _resend;
}
const FROM = process.env["RESEND_FROM_EMAIL"] ?? "BookMe <turnos@bookme.ar>";

export interface AppointmentEmailData {
  to: string;
  patientName: string;
  professionalName: string;
  specialty: string;
  startsAt: Date;
  serviceName?: string;
  bookingUrl?: string;
  meetUrl?: string | null;
}

// Envía confirmación inmediata al paciente tras reservar
export async function sendConfirmationEmail(data: AppointmentEmailData) {
  const dateStr = data.startsAt.toLocaleString("es-AR", {
    dateStyle: "full",
    timeStyle: "short",
    timeZone: "America/Argentina/Buenos_Aires",
  });

  return getResend().emails.send({
    from: FROM,
    to: data.to,
    subject: `Turno confirmado con ${data.professionalName}`,
    html: buildConfirmationHtml({ ...data, dateStr }),
  });
}

// Envía recordatorio X minutos antes del turno (24hs por defecto)
export async function sendReminderEmail(
  data: AppointmentEmailData & { offsetMinutes?: number }
) {
  const dateStr = data.startsAt.toLocaleString("es-AR", {
    dateStyle: "full",
    timeStyle: "short",
    timeZone: "America/Argentina/Buenos_Aires",
  });
  const offsetLabel = formatOffsetLabel(data.offsetMinutes ?? 1440);

  return getResend().emails.send({
    from: FROM,
    to: data.to,
    subject: `Recordatorio: turno ${offsetLabel} con ${data.professionalName}`,
    html: buildReminderHtml({ ...data, dateStr, offsetLabel }),
  });
}

// Convierte minutos a una etiqueta natural para el asunto/cuerpo del recordatorio.
// 1440 → "mañana", 120 → "en 2 horas", 30 → "en 30 minutos", 2880 → "pasado mañana".
function formatOffsetLabel(minutes: number): string {
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

// Aviso ~5 min antes de que arranque la videoconsulta. Requiere meetUrl.
export async function sendVirtualReminderEmail(data: AppointmentEmailData) {
  const timeStr = data.startsAt.toLocaleTimeString("es-AR", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "America/Argentina/Buenos_Aires",
  });

  return getResend().emails.send({
    from: FROM,
    to: data.to,
    subject: `Tu videoconsulta con ${data.professionalName} empieza en unos minutos`,
    html: buildVirtualReminderHtml({ ...data, timeStr }),
  });
}

// Notifica cambio de horario al paciente
export async function sendRescheduleEmail(
  data: AppointmentEmailData & { oldStartsAt: Date }
) {
  const newDateStr = data.startsAt.toLocaleString("es-AR", {
    dateStyle: "full",
    timeStyle: "short",
    timeZone: "America/Argentina/Buenos_Aires",
  });

  return getResend().emails.send({
    from: FROM,
    to: data.to,
    subject: `Tu turno con ${data.professionalName} fue reprogramado`,
    html: buildRescheduleHtml({ ...data, newDateStr }),
  });
}

// Notifica cancelación del turno al paciente
export async function sendCancellationEmail(data: AppointmentEmailData) {
  const dateStr = data.startsAt.toLocaleString("es-AR", {
    dateStyle: "full",
    timeStyle: "short",
    timeZone: "America/Argentina/Buenos_Aires",
  });

  return getResend().emails.send({
    from: FROM,
    to: data.to,
    subject: `Tu turno con ${data.professionalName} fue cancelado`,
    html: buildCancellationHtml({ ...data, dateStr }),
  });
}

// ─── Trial Emails ───────────────────────────────────────────────────────────

export interface TrialEmailData {
  to: string;
  professionalName: string;
  daysLeft: number;
  trialEndsAt: Date;
  upgradeUrl?: string;
}

/** Aviso genérico de vencimiento de trial (7 días, 3 días, o día del vencimiento) */
export async function sendTrialExpiringEmail(data: TrialEmailData) {
  const dateStr = data.trialEndsAt.toLocaleDateString("es-AR", {
    dateStyle: "long",
    timeZone: "America/Argentina/Buenos_Aires",
  });

  const subject =
    data.daysLeft === 0
      ? "Tu prueba gratuita de BookMe vence hoy"
      : data.daysLeft <= 3
      ? `Tu prueba gratuita vence en ${data.daysLeft} días`
      : `Tu prueba gratuita vence en ${data.daysLeft} días`;

  return getResend().emails.send({
    from: FROM,
    to: data.to,
    subject,
    html: buildTrialExpiringHtml(data, dateStr),
  });
}

/** Aviso de trial ya expirado — cuenta pasa a modo solo lectura */
export async function sendTrialExpiredEmail(data: Omit<TrialEmailData, "daysLeft">) {
  return getResend().emails.send({
    from: FROM,
    to: data.to,
    subject: "Tu prueba gratuita de BookMe ha terminado",
    html: buildTrialExpiredHtml(data),
  });
}

// ─── Helpers de HTML (inline CSS para compatibilidad con clientes de email) ──

function buildConfirmationHtml(
  data: AppointmentEmailData & { dateStr: string }
) {
  return `
    <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #0f172a;">Tu turno está confirmado</h2>
      <p>Hola <strong>${data.patientName}</strong>,</p>
      <p>Tu turno con <strong>${data.professionalName}</strong> (${data.specialty}) fue confirmado.</p>
      <div style="background: #f1f5f9; padding: 16px; border-radius: 8px; margin: 24px 0;">
        <p style="margin: 0;"><strong>Fecha y hora:</strong> ${data.dateStr}</p>
        ${data.serviceName ? `<p style="margin: 8px 0 0;"><strong>Servicio:</strong> ${data.serviceName}</p>` : ""}
        ${data.meetUrl ? `<p style="margin: 8px 0 0;"><strong>Modalidad:</strong> Videoconsulta online</p>` : ""}
      </div>
      ${
        data.meetUrl
          ? `
        <div style="text-align: center; margin: 24px 0;">
          <a href="${data.meetUrl}"
             style="display: inline-block; background: #2563eb; color: white; padding: 14px 32px; border-radius: 8px; text-decoration: none; font-weight: 600;">
            Entrar a la videoconsulta
          </a>
          <p style="margin: 12px 0 0; font-size: 12px; color: #64748b;">
            Entrá a la sala unos minutos antes del horario del turno.<br/>
            No necesitás instalar nada: se abre directamente en el navegador.
          </p>
        </div>
      `
          : ""
      }
      ${data.bookingUrl ? `<p><a href="${data.bookingUrl}" style="color: #0ea5e9;">Ver o cancelar mi turno</a></p>` : ""}
      <p style="color: #64748b; font-size: 14px;">BookMe — bookme.ar</p>
    </div>
  `;
}

function buildReminderHtml(
  data: AppointmentEmailData & { dateStr: string; offsetLabel: string }
) {
  return `
    <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #0f172a;">Recordatorio de turno</h2>
      <p>Hola <strong>${data.patientName}</strong>,</p>
      <p>Te recordamos que ${data.offsetLabel} tenés turno con <strong>${data.professionalName}</strong>.</p>
      <div style="background: #f1f5f9; padding: 16px; border-radius: 8px; margin: 24px 0;">
        <p style="margin: 0;"><strong>Fecha y hora:</strong> ${data.dateStr}</p>
        ${data.serviceName ? `<p style="margin: 8px 0 0;"><strong>Servicio:</strong> ${data.serviceName}</p>` : ""}
        ${data.meetUrl ? `<p style="margin: 8px 0 0;"><strong>Modalidad:</strong> Videoconsulta online</p>` : ""}
      </div>
      ${
        data.meetUrl
          ? `
        <div style="text-align: center; margin: 24px 0;">
          <a href="${data.meetUrl}"
             style="display: inline-block; background: #2563eb; color: white; padding: 14px 32px; border-radius: 8px; text-decoration: none; font-weight: 600;">
            Entrar a la videoconsulta
          </a>
          <p style="margin: 12px 0 0; font-size: 12px; color: #64748b;">
            Guardá este link — lo vas a necesitar mañana a la hora del turno.
          </p>
        </div>
      `
          : ""
      }
      ${data.bookingUrl ? `<p><a href="${data.bookingUrl}" style="color: #0ea5e9;">Ver o cancelar mi turno</a></p>` : ""}
      <p style="color: #64748b; font-size: 14px;">BookMe — bookme.ar</p>
    </div>
  `;
}

function buildVirtualReminderHtml(
  data: AppointmentEmailData & { timeStr: string }
) {
  return `
    <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #0f172a;">Tu videoconsulta empieza en unos minutos</h2>
      <p>Hola <strong>${data.patientName}</strong>,</p>
      <p>Te recordamos que a las <strong>${data.timeStr}</strong> tenés tu videoconsulta con <strong>${data.professionalName}</strong>.</p>
      ${
        data.meetUrl
          ? `
        <div style="text-align: center; margin: 24px 0;">
          <a href="${data.meetUrl}"
             style="display: inline-block; background: #2563eb; color: white; padding: 14px 32px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 16px;">
            Entrar ahora a la videoconsulta
          </a>
          <p style="margin: 12px 0 0; font-size: 12px; color: #64748b;">
            Se abre en el navegador. No necesitás instalar nada.
          </p>
        </div>
      `
          : ""
      }
      <p style="color: #64748b; font-size: 14px;">BookMe — bookme.ar</p>
    </div>
  `;
}

function buildRescheduleHtml(
  data: AppointmentEmailData & { newDateStr: string }
) {
  return `
    <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #0f172a;">Tu turno fue reprogramado</h2>
      <p>Hola <strong>${data.patientName}</strong>,</p>
      <p>Tu turno con <strong>${data.professionalName}</strong> fue reprogramado.</p>
      <div style="background: #f1f5f9; padding: 16px; border-radius: 8px; margin: 24px 0;">
        <p style="margin: 0;"><strong>Nuevo horario:</strong> ${data.newDateStr}</p>
        ${data.serviceName ? `<p style="margin: 8px 0 0;"><strong>Servicio:</strong> ${data.serviceName}</p>` : ""}
      </div>
      ${data.bookingUrl ? `<p><a href="${data.bookingUrl}" style="color: #0ea5e9;">Ver mi turno</a></p>` : ""}
      <p style="color: #64748b; font-size: 14px;">BookMe — bookme.ar</p>
    </div>
  `;
}

function buildCancellationHtml(
  data: AppointmentEmailData & { dateStr: string }
) {
  return `
    <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #dc2626;">Tu turno fue cancelado</h2>
      <p>Hola <strong>${data.patientName}</strong>,</p>
      <p>Tu turno con <strong>${data.professionalName}</strong> (${data.specialty}) fue cancelado.</p>
      <div style="background: #fef2f2; padding: 16px; border-radius: 8px; margin: 24px 0;">
        <p style="margin: 0;"><strong>Fecha original:</strong> ${data.dateStr}</p>
        ${data.serviceName ? `<p style="margin: 8px 0 0;"><strong>Servicio:</strong> ${data.serviceName}</p>` : ""}
      </div>
      <p>Podés reservar un nuevo turno desde <a href="https://bookme.ar" style="color: #0ea5e9;">bookme.ar</a></p>
      <p style="color: #64748b; font-size: 14px;">BookMe — bookme.ar</p>
    </div>
  `;
}

function buildTrialExpiringHtml(data: TrialEmailData, dateStr: string) {
  const upgradeUrl = data.upgradeUrl || "https://bookme.ar/dashboard/configuracion";
  const urgencyColor = data.daysLeft <= 3 ? "#f59e0b" : "#0ea5e9";
  const urgencyBg = data.daysLeft <= 3 ? "#fffbeb" : "#f0f9ff";

  return `
    <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #0f172a;">
        ${data.daysLeft === 0
          ? "Tu prueba gratuita vence hoy"
          : `Tu prueba gratuita vence en ${data.daysLeft} días`}
      </h2>
      <p>Hola <strong>${data.professionalName}</strong>,</p>
      <p>
        ${data.daysLeft === 0
          ? "Hoy es el último día de tu prueba gratuita de BookMe."
          : `Te quedan <strong>${data.daysLeft} días</strong> de prueba gratuita en BookMe.`}
      </p>
      <div style="background: ${urgencyBg}; border-left: 4px solid ${urgencyColor}; padding: 16px; border-radius: 4px; margin: 24px 0;">
        <p style="margin: 0;"><strong>Tu trial vence el:</strong> ${dateStr}</p>
        <p style="margin: 8px 0 0; font-size: 14px; color: #64748b;">
          Después de esa fecha, tu cuenta pasará a modo solo lectura hasta que elijas un plan.
        </p>
      </div>
      <p>No pierdas acceso a tu agenda, tus pacientes y todas las funcionalidades:</p>
      <div style="text-align: center; margin: 24px 0;">
        <a href="${upgradeUrl}"
           style="display: inline-block; background: #0F2A47; color: white; padding: 12px 32px; border-radius: 8px; text-decoration: none; font-weight: 600;">
          Elegir mi plan
        </a>
      </div>
      <p style="color: #64748b; font-size: 14px;">
        ¿Tenés dudas? Escribinos a <a href="mailto:soporte@bookme.ar" style="color: #0ea5e9;">soporte@bookme.ar</a>
      </p>
      <p style="color: #64748b; font-size: 14px;">BookMe — bookme.ar</p>
    </div>
  `;
}

// ─── Payment Reminder Emails (impago de abono mensual) ─────────────────────

export type PaymentReminderKind = "soft" | "firm" | "final" | "read_only";

export interface PaymentReminderEmailData {
  to: string;
  professionalName: string;
  amount: number;
  currency: string;          // "ARS", "USD"…
  daysOverdue: number;       // 7, 10, 14, 15
  retryUrl?: string;
}

/**
 * Envía recordatorio de pago atrasado al profesional.
 * Tono y urgencia varían según el `kind`:
 *   - soft       (día 7): amable, "no pudimos procesar"
 *   - firm       (día 10): firme, "actualizá tu medio de pago"
 *   - final      (día 14): aviso de suspensión próxima
 *   - read_only  (día 15): notificación de cuenta congelada
 */
export async function sendPaymentReminderEmail(
  kind: PaymentReminderKind,
  data: PaymentReminderEmailData
) {
  const subject = subjectFor(kind, data);
  return getResend().emails.send({
    from: FROM,
    to: data.to,
    subject,
    html: buildPaymentReminderHtml(kind, data),
  });
}

function subjectFor(kind: PaymentReminderKind, data: PaymentReminderEmailData): string {
  switch (kind) {
    case "soft":
      return "No pudimos procesar el pago de tu suscripción";
    case "firm":
      return "Tu pago sigue pendiente — actualizá tu medio de pago";
    case "final":
      return `Última notificación: tu cuenta será suspendida en ${15 - data.daysOverdue} día(s)`;
    case "read_only":
      return "Tu cuenta de BookMe pasó a modo solo lectura";
  }
}

function buildPaymentReminderHtml(
  kind: PaymentReminderKind,
  data: PaymentReminderEmailData
): string {
  const retryUrl = data.retryUrl ?? "https://bookme.ar/dashboard/plan";
  const amountStr = `${data.currency} ${data.amount.toLocaleString("es-AR", { minimumFractionDigits: 2 })}`;

  // Paleta y copy por nivel de urgencia
  const palette: Record<PaymentReminderKind, { bg: string; border: string; cta: string; title: string; body: string }> = {
    soft: {
      bg: "#fffbeb",
      border: "#f59e0b",
      cta: "#0F2A47",
      title: "No pudimos procesar tu pago",
      body: `Intentamos cobrar el abono mensual de tu plan en BookMe pero la operación no se completó. Es posible que tu tarjeta esté vencida o sin saldo suficiente.`,
    },
    firm: {
      bg: "#fff7ed",
      border: "#ea580c",
      cta: "#ea580c",
      title: "Tu pago sigue pendiente",
      body: `Hace ${data.daysOverdue} días que no pudimos cobrar tu abono mensual. Para evitar que tu cuenta se suspenda, actualizá tu medio de pago lo antes posible.`,
    },
    final: {
      bg: "#fef2f2",
      border: "#dc2626",
      cta: "#dc2626",
      title: `Tu cuenta será suspendida en ${15 - data.daysOverdue} día(s)`,
      body: `Esta es la última notificación antes de que tu cuenta pase a modo solo lectura. Después no vas a poder recibir nuevos turnos hasta que regularices el pago.`,
    },
    read_only: {
      bg: "#fef2f2",
      border: "#dc2626",
      cta: "#dc2626",
      title: "Tu cuenta pasó a modo solo lectura",
      body: `Pasaron 15 días desde el primer intento de cobro fallido y tu cuenta fue congelada. Tus pacientes ya no pueden reservar online. Regularizá el pago para reactivarla.`,
    },
  };

  const p = palette[kind];

  return `
    <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #0f172a;">${p.title}</h2>
      <p>Hola <strong>${data.professionalName}</strong>,</p>
      <p>${p.body}</p>
      <div style="background: ${p.bg}; border-left: 4px solid ${p.border}; padding: 16px; border-radius: 4px; margin: 24px 0;">
        <p style="margin: 0;"><strong>Monto pendiente:</strong> ${amountStr}</p>
        <p style="margin: 8px 0 0;"><strong>Días desde el fallo:</strong> ${data.daysOverdue}</p>
      </div>
      <div style="text-align: center; margin: 24px 0;">
        <a href="${retryUrl}"
           style="display: inline-block; background: ${p.cta}; color: white; padding: 12px 32px; border-radius: 8px; text-decoration: none; font-weight: 600;">
          ${kind === "read_only" ? "Reactivar mi cuenta" : "Regularizar pago"}
        </a>
      </div>
      <p style="color: #64748b; font-size: 14px;">
        Si ya regularizaste el pago, ignorá este mensaje. Si necesitás ayuda, escribinos a
        <a href="mailto:soporte@bookme.ar" style="color: #0ea5e9;">soporte@bookme.ar</a>.
      </p>
      <p style="color: #64748b; font-size: 14px;">BookMe — bookme.ar</p>
    </div>
  `;
}

function buildTrialExpiredHtml(data: Omit<TrialEmailData, "daysLeft">) {
  const upgradeUrl = data.upgradeUrl || "https://bookme.ar/dashboard/configuracion";

  return `
    <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #dc2626;">Tu prueba gratuita ha terminado</h2>
      <p>Hola <strong>${data.professionalName}</strong>,</p>
      <p>Tu período de prueba gratuita de BookMe ha finalizado. Tu cuenta está ahora en <strong>modo solo lectura</strong>.</p>
      <div style="background: #fef2f2; border-left: 4px solid #dc2626; padding: 16px; border-radius: 4px; margin: 24px 0;">
        <p style="margin: 0; font-size: 14px;">
          Mientras tu cuenta esté en modo solo lectura:
        </p>
        <ul style="margin: 8px 0 0; font-size: 14px; color: #64748b; padding-left: 20px;">
          <li>No se pueden agendar nuevos turnos</li>
          <li>Tus pacientes no pueden reservar online</li>
          <li>Tu perfil no aparece en el directorio</li>
        </ul>
      </div>
      <p>Elegí un plan para recuperar el acceso completo:</p>
      <div style="text-align: center; margin: 24px 0;">
        <a href="${upgradeUrl}"
           style="display: inline-block; background: #0F2A47; color: white; padding: 12px 32px; border-radius: 8px; text-decoration: none; font-weight: 600;">
          Activar mi cuenta
        </a>
      </div>
      <p style="color: #64748b; font-size: 14px;">
        No perdés ningún dato. Todo sigue guardado y se reactiva al elegir un plan.
      </p>
      <p style="color: #64748b; font-size: 14px;">BookMe — bookme.ar</p>
    </div>
  `;
}
