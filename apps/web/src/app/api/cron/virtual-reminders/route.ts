import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { verifyCronAuth } from "@/lib/security";
import { sendVirtualReminderEmail } from "@bookme/notifications";

// GET /api/cron/virtual-reminders
// Vercel Cron: * * * * * (cada minuto)
// Avisa ~5 minutos antes del arranque de cada videoconsulta.
// Busca turnos donde:
//   - modality = 'virtual' y meet_url no es null
//   - starts_at entre now+4min y now+6min (ventana de 2 min por si el cron se saltea un tick)
//   - virtual_reminder_sent = false
//   - status ∈ (confirmed, pending)
export async function GET(request: NextRequest) {
  const authError = verifyCronAuth(request);
  if (authError) return authError;

  try {
    const supabase = createAdminClient();

    const now = new Date();
    const from = new Date(now.getTime() + 4 * 60 * 1000);
    const to = new Date(now.getTime() + 6 * 60 * 1000);

    const { data: appointments, error } = await supabase
      .from("appointments")
      .select(
        `
        id,
        starts_at,
        meet_url,
        patient:patients(full_name, email),
        professional:professionals(
          specialty,
          profile:profiles!professionals_id_fkey(full_name)
        ),
        service:services(name)
        `
      )
      .eq("modality", "virtual")
      .not("meet_url", "is", null)
      .eq("virtual_reminder_sent", false)
      .in("status", ["confirmed", "pending"])
      .gte("starts_at", from.toISOString())
      .lte("starts_at", to.toISOString());

    if (error) {
      console.error("[VirtualReminders] Error consultando turnos:", error);
      return NextResponse.json({ error: "Error consultando turnos" }, { status: 500 });
    }

    if (!appointments || appointments.length === 0) {
      return NextResponse.json({ sent: 0 });
    }

    let sent = 0;
    const errors: string[] = [];

    for (const appt of appointments) {
      const patient = Array.isArray(appt.patient) ? appt.patient[0] : appt.patient;
      const professional = Array.isArray(appt.professional)
        ? appt.professional[0]
        : appt.professional;
      const service = Array.isArray(appt.service) ? appt.service[0] : appt.service;

      if (!patient || !professional || !patient.email) continue;

      const profName = professional.profile
        ? Array.isArray(professional.profile)
          ? professional.profile[0]?.full_name ?? ""
          : professional.profile.full_name ?? ""
        : "";

      try {
        await sendVirtualReminderEmail({
          to: patient.email,
          patientName: patient.full_name,
          professionalName: profName,
          specialty: professional.specialty,
          startsAt: new Date(appt.starts_at),
          serviceName: service?.name,
          meetUrl: (appt as { meet_url?: string | null }).meet_url ?? null,
        });
        sent++;
      } catch (err) {
        errors.push(`Email ${appt.id}: ${String(err)}`);
      }

      await supabase
        .from("appointments")
        .update({ virtual_reminder_sent: true })
        .eq("id", appt.id);
    }

    if (errors.length > 0) {
      console.error("[VirtualReminders] Errores:", errors);
    }

    return NextResponse.json({ sent, errors: errors.length > 0 ? errors : undefined });
  } catch (error) {
    console.error("[VirtualReminders] Error general:", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
