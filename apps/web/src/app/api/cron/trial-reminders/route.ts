import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { verifyCronAuth } from "@/lib/security";

export const dynamic = "force-dynamic";

/**
 * GET /api/cron/trial-reminders
 *
 * Endpoint pensado para ejecutarse con un cron job diario (ej: Vercel Cron, GitHub Actions).
 * Busca profesionales cuyo trial vence en 5, 3 o 0 días y les envía un recordatorio.
 *
 * Seguridad: se valida con un CRON_SECRET en los headers.
 *
 * En producción:
 * - Enviar email vía proveedor transaccional (Resend, SendGrid, etc.)
 * - Enviar WhatsApp vía BookMe number
 * Por ahora loguea y retorna los profesionales afectados.
 */
export async function GET(request: NextRequest) {
  const authError = verifyCronAuth(request);
  if (authError) return authError;

  try {
    const admin = createAdminClient();
    const now = new Date();

    // Calcular fechas objetivo: hoy, +3 días, +5 días
    const targetDays = [0, 3, 5];
    const results: Record<number, Array<{ id: string; full_name: string; email: string; trial_ends_at: string }>> = {};

    for (const days of targetDays) {
      const targetDate = new Date(now);
      targetDate.setDate(targetDate.getDate() + days);
      const targetStr = targetDate.toISOString().split("T")[0]; // YYYY-MM-DD

      // Buscar profesionales cuyo trial termina en esta fecha
      const { data, error } = await admin
        .from("professionals")
        .select("id, line, subscription_plan, subscription_status, trial_ends_at, profile:profiles!id(full_name, email:id)")
        .eq("subscription_status", "trialing")
        .gte("trial_ends_at", `${targetStr}T00:00:00`)
        .lt("trial_ends_at", `${targetStr}T23:59:59`);

      if (error) {
        console.error(`[trial-reminders] Error querying day ${days}:`, error);
        continue;
      }

      // Obtener emails desde auth (los profiles no tienen email directo)
      const professionals = [];
      for (const prof of data ?? []) {
        // Obtener email del usuario de auth
        const { data: authUser } = await admin.auth.admin.getUserById(prof.id);
        if (authUser?.user) {
          const profileData = prof.profile as unknown as { full_name: string } | null;
          professionals.push({
            id: prof.id,
            full_name: profileData?.full_name ?? "Profesional",
            email: authUser.user.email ?? "",
            trial_ends_at: prof.trial_ends_at as string,
          });
        }
      }

      results[days] = professionals;

      // ── Enviar notificaciones (placeholder) ──
      for (const prof of professionals) {
        if (days === 5) {
          // 5 días antes: recordatorio suave
          console.log(
            `[trial-reminder] 5 DÍAS → ${prof.full_name} (${prof.email}): ` +
            `Tu trial vence el ${new Date(prof.trial_ends_at).toLocaleDateString("es-AR")}. ` +
            `Elegí un plan en bookme.ar/dashboard/plan`
          );
          // TODO: enviar email + WhatsApp
        } else if (days === 3) {
          // 3 días antes: urgente
          console.log(
            `[trial-reminder] 3 DÍAS → ${prof.full_name} (${prof.email}): ` +
            `Tu trial vence en 3 días. Ingresá tu tarjeta para no perder acceso.`
          );
          // TODO: enviar email + WhatsApp
        } else if (days === 0) {
          // Día del vencimiento
          console.log(
            `[trial-reminder] HOY VENCE → ${prof.full_name} (${prof.email}): ` +
            `Tu trial vence hoy. Si no elegís un plan, se suspenderá tu cuenta mañana.`
          );
          // TODO: enviar email + WhatsApp
        }
      }
    }

    const totalNotified = Object.values(results).reduce((sum, arr) => sum + arr.length, 0);

    return NextResponse.json({
      success: true,
      timestamp: now.toISOString(),
      summary: {
        day_0: results[0]?.length ?? 0,
        day_3: results[3]?.length ?? 0,
        day_5: results[5]?.length ?? 0,
        total_notified: totalNotified,
      },
      details: results,
    });
  } catch (err) {
    console.error("[GET /api/cron/trial-reminders]", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
