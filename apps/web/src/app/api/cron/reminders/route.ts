import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { verifyCronAuth } from "@/lib/security";
import {
  sendReminderEmail,
  sendReminderWhatsApp,
} from "@bookme/notifications";
import { cleanupExpiredSharedFiles } from "@/lib/shared-files/cleanup";

// Ventana de tolerancia: ± WINDOW_MINUTES / 2 alrededor del offset configurado.
// Con cron horario, 60 garantiza que cada offset se dispara una única vez
// incluso si el cron sufre un pequeño retraso.
const WINDOW_MINUTES = 60;

// Margen mínimo antes del turno para enviar un recordatorio.
// Si faltan menos de 10 min ya no enviamos nada (el paciente está en camino).
const MIN_LEAD_MINUTES = 10;

interface ReminderTarget {
  appointmentId: string;
  offsetMinutes: number;
  startsAt: Date;
  patient: { fullName: string; email: string | null; phone: string | null };
  professionalName: string;
  specialty: string;
  serviceName?: string;
  meetUrl: string | null;
  channels: string[];
}

// GET /api/cron/reminders
// Se ejecuta cada hora. Evalúa los offsets configurados por cada profesional
// y dispara los recordatorios pendientes.
export async function GET(request: NextRequest) {
  const authError = verifyCronAuth(request);
  if (authError) return authError;

  try {
    const supabase = createAdminClient();
    const now = new Date();

    // Traemos todos los turnos futuros dentro de una ventana amplia
    // (7 días = 10080 min, que es el offset máximo permitido por el CHECK).
    const horizonEnd = new Date(now.getTime() + (10080 + WINDOW_MINUTES) * 60 * 1000);

    const { data: appointments, error } = await supabase
      .from("appointments")
      .select(
        `
        id,
        starts_at,
        meet_url,
        professional_id,
        professional:professionals(
          specialty,
          reminder_offsets,
          reminder_channels,
          profile:profiles!professionals_id_fkey(full_name)
        ),
        patient:patients(full_name, email, phone),
        service:services(name)
        `
      )
      .in("status", ["confirmed", "pending"])
      .gte("starts_at", new Date(now.getTime() + MIN_LEAD_MINUTES * 60 * 1000).toISOString())
      .lte("starts_at", horizonEnd.toISOString());

    if (error) {
      console.error("Error consultando turnos para recordatorios:", error);
      return NextResponse.json({ error: "Error consultando turnos" }, { status: 500 });
    }

    if (!appointments || appointments.length === 0) {
      return NextResponse.json({ sent: 0, message: "Sin turnos próximos" });
    }

    // Resolvemos qué (appointment, offset) están due ahora.
    const targets: ReminderTarget[] = [];
    const candidateKeys: Array<{ appointment_id: string; offset_minutes: number }> = [];

    for (const appt of appointments) {
      const professional = Array.isArray(appt.professional) ? appt.professional[0] : appt.professional;
      const patient = Array.isArray(appt.patient) ? appt.patient[0] : appt.patient;
      const service = Array.isArray(appt.service) ? appt.service[0] : appt.service;
      if (!professional || !patient) continue;

      const offsets: number[] = professional.reminder_offsets ?? [];
      const channels: string[] = professional.reminder_channels ?? [];
      if (offsets.length === 0 || channels.length === 0) continue;

      const startsAt = new Date(appt.starts_at);
      const minutesUntil = (startsAt.getTime() - now.getTime()) / 60000;

      const profile = Array.isArray(professional.profile) ? professional.profile[0] : professional.profile;
      const professionalName = profile?.full_name ?? "";

      for (const offset of offsets) {
        // due si minutesUntil cae en [offset - WINDOW/2, offset + WINDOW/2]
        if (Math.abs(minutesUntil - offset) > WINDOW_MINUTES / 2) continue;

        candidateKeys.push({ appointment_id: appt.id, offset_minutes: offset });
        targets.push({
          appointmentId: appt.id,
          offsetMinutes: offset,
          startsAt,
          patient: {
            fullName: patient.full_name,
            email: patient.email,
            phone: patient.phone,
          },
          professionalName,
          specialty: professional.specialty,
          serviceName: service?.name,
          meetUrl: (appt as { meet_url?: string | null }).meet_url ?? null,
          channels,
        });
      }
    }

    if (targets.length === 0) {
      return NextResponse.json({ sent: 0, message: "Sin recordatorios due en esta ventana" });
    }

    // Filtramos los (appt, offset) que ya fueron enviados.
    const { data: alreadySent } = await supabase
      .from("appointment_reminders_sent")
      .select("appointment_id, offset_minutes")
      .in(
        "appointment_id",
        candidateKeys.map((k) => k.appointment_id)
      );

    const sentSet = new Set(
      (alreadySent ?? []).map((r) => `${r.appointment_id}:${r.offset_minutes}`)
    );

    const pending = targets.filter(
      (t) => !sentSet.has(`${t.appointmentId}:${t.offsetMinutes}`)
    );

    let sent = 0;
    const errors: string[] = [];

    for (const t of pending) {
      const emailData = {
        patientName: t.patient.fullName,
        professionalName: t.professionalName,
        specialty: t.specialty,
        startsAt: t.startsAt,
        serviceName: t.serviceName,
        meetUrl: t.meetUrl,
        offsetMinutes: t.offsetMinutes,
        to: t.patient.email ?? "",
      };

      if (t.channels.includes("email") && t.patient.email) {
        try {
          await sendReminderEmail(emailData);
        } catch (err) {
          errors.push(`Email ${t.appointmentId}@${t.offsetMinutes}: ${String(err)}`);
        }
      }

      if (t.channels.includes("whatsapp") && t.patient.phone) {
        try {
          await sendReminderWhatsApp({ ...emailData, to: t.patient.phone });
        } catch (err) {
          errors.push(`WhatsApp ${t.appointmentId}@${t.offsetMinutes}: ${String(err)}`);
        }
      }

      // Registrar como enviado (insert idempotente). Si falla el insert,
      // preferimos no marcar enviado para que el próximo run reintente.
      const { error: logError } = await supabase
        .from("appointment_reminders_sent")
        .insert({ appointment_id: t.appointmentId, offset_minutes: t.offsetMinutes });

      if (logError) {
        errors.push(`Log ${t.appointmentId}@${t.offsetMinutes}: ${logError.message}`);
        continue;
      }

      // Mantener reminder_sent en true cuando se dispara el offset de 24hs,
      // por compatibilidad con código existente que aún lo lee.
      if (t.offsetMinutes === 1440) {
        await supabase
          .from("appointments")
          .update({ reminder_sent: true })
          .eq("id", t.appointmentId);
      }

      sent++;
    }

    console.log(`Recordatorios enviados: ${sent}. Errores: ${errors.length}`);
    if (errors.length > 0) {
      console.error("Errores en recordatorios:", errors);
    }

    // Limpieza diaria de archivos compartidos por pacientes (> 7 días).
    // Va piggyback en este cron para no consumir un slot extra del plan Hobby.
    const cleanup = await cleanupExpiredSharedFiles();
    if (cleanup.deleted > 0) {
      console.log(`[cleanup] Archivos compartidos eliminados: ${cleanup.deleted}`);
    }

    return NextResponse.json({
      sent,
      pending: pending.length,
      shared_files_cleaned: cleanup.deleted,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (error) {
    console.error("Error en cron de recordatorios:", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
