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

// Envía recordatorio 24hs antes del turno
export async function sendReminderEmail(data: AppointmentEmailData) {
  const dateStr = data.startsAt.toLocaleString("es-AR", {
    dateStyle: "full",
    timeStyle: "short",
    timeZone: "America/Argentina/Buenos_Aires",
  });

  return getResend().emails.send({
    from: FROM,
    to: data.to,
    subject: `Recordatorio: turno mañana con ${data.professionalName}`,
    html: buildReminderHtml({ ...data, dateStr }),
  });
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

function buildReminderHtml(data: AppointmentEmailData & { dateStr: string }) {
  return `
    <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #0f172a;">Recordatorio de turno</h2>
      <p>Hola <strong>${data.patientName}</strong>,</p>
      <p>Te recordamos que mañana tenés turno con <strong>${data.professionalName}</strong>.</p>
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
