import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { sendTrialExpiringEmail, sendTrialExpiredEmail } from "@bookme/notifications";

/**
 * GET /api/cron/trial-emails
 *
 * Vercel Cron: 0 12 * * * (12 UTC = 9 AM ARG)
 * Envía emails de aviso de vencimiento de trial:
 *   - 7 días antes del vencimiento
 *   - 3 días antes del vencimiento
 *   - El día del vencimiento
 *   - 1 día después (trial expirado)
 *
 * Usa un campo `trial_email_sent` en la tabla professionals para trackear
 * qué notificaciones ya se enviaron y no repetir.
 * Formato: "7d,3d,0d,expired" (CSV de los hitos ya enviados)
 */
export async function GET(request: NextRequest) {
  // Verificar secret
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env["CRON_SECRET"]}`) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  try {
    const supabase = createAdminClient();
    const now = new Date();

    // Buscar profesionales en trial con trial_ends_at definido
    const { data: professionals, error } = await supabase
      .from("professionals")
      .select(
        `id, trial_ends_at, trial_email_sent,
         profile:profiles!id(full_name)`
      )
      .eq("subscription_status", "trialing")
      .not("trial_ends_at", "is", null);

    if (error) {
      console.error("Error consultando profesionales en trial:", error);
      return NextResponse.json({ error: "Error consultando datos" }, { status: 500 });
    }

    if (!professionals || professionals.length === 0) {
      return NextResponse.json({ sent: 0, message: "Sin trials activos" });
    }

    // También buscar trials ya expirados que no recibieron el email de "expired"
    const { data: expiredPros } = await supabase
      .from("professionals")
      .select(
        `id, trial_ends_at, trial_email_sent,
         profile:profiles!id(full_name)`
      )
      .in("subscription_status", ["read_only", "cancelled"])
      .not("trial_ends_at", "is", null);

    const allPros = [...(professionals || []), ...(expiredPros || [])];

    // Obtener emails desde auth.users
    const { data: authUsers } = await supabase.auth.admin.listUsers({ perPage: 1000 });
    const emailMap: Record<string, string> = {};
    if (authUsers?.users) {
      for (const u of authUsers.users) {
        if (u.email) emailMap[u.id] = u.email;
      }
    }

    let sent = 0;
    const errors: string[] = [];

    for (const pro of allPros) {
      const profile = Array.isArray(pro.profile) ? pro.profile[0] : pro.profile;
      const email = emailMap[pro.id];
      if (!email || !profile || !pro.trial_ends_at) continue;

      const trialEnd = new Date(pro.trial_ends_at);
      const diffMs = trialEnd.getTime() - now.getTime();
      const daysLeft = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

      // Parse los hitos ya enviados
      const sentMilestones = new Set(
        (pro.trial_email_sent || "").split(",").filter(Boolean)
      );

      // Determinar qué milestone corresponde
      let milestone: string | null = null;
      let shouldSend = false;

      if (daysLeft <= 0 && daysLeft >= -1 && !sentMilestones.has("expired")) {
        // Trial expirado (hoy o ayer)
        milestone = "expired";
        shouldSend = true;
      } else if (daysLeft === 0 && !sentMilestones.has("0d")) {
        milestone = "0d";
        shouldSend = true;
      } else if (daysLeft > 0 && daysLeft <= 3 && !sentMilestones.has("3d")) {
        milestone = "3d";
        shouldSend = true;
      } else if (daysLeft > 3 && daysLeft <= 7 && !sentMilestones.has("7d")) {
        milestone = "7d";
        shouldSend = true;
      }

      if (!shouldSend || !milestone) continue;

      try {
        if (milestone === "expired") {
          await sendTrialExpiredEmail({
            to: email,
            professionalName: profile.full_name,
            trialEndsAt: trialEnd,
          });
        } else {
          await sendTrialExpiringEmail({
            to: email,
            professionalName: profile.full_name,
            daysLeft: daysLeft <= 0 ? 0 : daysLeft,
            trialEndsAt: trialEnd,
          });
        }

        // Actualizar milestones enviados
        sentMilestones.add(milestone);
        const newSentValue = Array.from(sentMilestones).join(",");

        await supabase
          .from("professionals")
          .update({ trial_email_sent: newSentValue })
          .eq("id", pro.id);

        sent++;
      } catch (err) {
        errors.push(`${pro.id} (${milestone}): ${String(err)}`);
      }
    }

    console.log(`Trial emails enviados: ${sent}. Errores: ${errors.length}`);
    if (errors.length > 0) {
      console.error("Errores en trial emails:", errors);
    }

    return NextResponse.json({
      sent,
      total_in_trial: professionals.length,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (error) {
    console.error("Error en cron de trial emails:", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
