import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import {
  sendReminderEmail,
  sendReminderWhatsApp,
} from "@bookme/notifications";

// GET /api/cron/reminders
// Vercel Cron: 0 9 * * * (9 AM UTC = 6 AM ARG)
// Envía recordatorios de turnos que ocurren dentro de las próximas 24-26hs
export async function GET(request: NextRequest) {
  // Verificar secret del cron para evitar ejecuciones no autorizadas
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env["CRON_SECRET"]}`) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  try {
    const supabase = createAdminClient();

    const now = new Date();
    const from = new Date(now.getTime() + 24 * 60 * 60 * 1000); // +24hs
    const to = new Date(now.getTime() + 26 * 60 * 60 * 1000);   // +26hs (ventana de 2hs)

    // Buscar turnos en la ventana de 24-26hs que aún no recibieron recordatorio
    const { data: appointments, error } = await supabase
      .from("appointments")
      .select(
        `
        id,
        starts_at,
        notes,
        patient:patients(full_name, email, phone),
        professional:professionals(
          specialty,
          profile:profiles(full_name)
        ),
        service:services(name)
        `
      )
      .in("status", ["confirmed", "pending"])
      .eq("reminder_sent", false)
      .gte("starts_at", from.toISOString())
      .lte("starts_at", to.toISOString());

    if (error) {
      console.error("Error consultando turnos para recordatorios:", error);
      return NextResponse.json(
        { error: "Error consultando turnos" },
        { status: 500 }
      );
    }

    if (!appointments || appointments.length === 0) {
      return NextResponse.json({ sent: 0, message: "Sin recordatorios pendientes" });
    }

    let sent = 0;
    const errors: string[] = [];

    for (const appt of appointments) {
      const patient = Array.isArray(appt.patient) ? appt.patient[0] : appt.patient;
      const professional = Array.isArray(appt.professional) ? appt.professional[0] : appt.professional;
      const service = Array.isArray(appt.service) ? appt.service[0] : appt.service;

      if (!patient || !professional) continue;

      const emailData = {
        patientName: patient.full_name,
        professionalName: professional.profile
          ? (Array.isArray(professional.profile) ? professional.profile[0]?.full_name : professional.profile.full_name) ?? ""
          : "",
        specialty: professional.specialty,
        startsAt: new Date(appt.starts_at),
        serviceName: service?.name,
        to: patient.email ?? "",
      };

      // Enviar email si el paciente tiene email
      if (patient.email) {
        try {
          await sendReminderEmail(emailData);
        } catch (err) {
          errors.push(`Email ${appt.id}: ${String(err)}`);
        }
      }

      // Enviar WhatsApp si el paciente tiene teléfono
      if (patient.phone) {
        try {
          await sendReminderWhatsApp({ ...emailData, to: patient.phone });
        } catch (err) {
          errors.push(`WhatsApp ${appt.id}: ${String(err)}`);
        }
      }

      // Marcar como enviado
      await supabase
        .from("appointments")
        .update({ reminder_sent: true })
        .eq("id", appt.id);

      sent++;
    }

    console.log(`Recordatorios enviados: ${sent}. Errores: ${errors.length}`);
    if (errors.length > 0) {
      console.error("Errores en recordatorios:", errors);
    }

    return NextResponse.json({ sent, errors: errors.length > 0 ? errors : undefined });
  } catch (error) {
    console.error("Error en cron de recordatorios:", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
