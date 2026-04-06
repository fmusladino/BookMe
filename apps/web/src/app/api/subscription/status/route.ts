import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

/**
 * GET /api/subscription/status — Devuelve estado de suscripción del profesional.
 * Requiere autenticación.
 *
 * NOTA: Este endpoint se mantiene por retrocompatibilidad, pero el SubscriptionBanner
 * ahora lee los datos directamente de /api/auth/me (que ya incluye subscription).
 * Si no tenés clientes consumiendo este endpoint directamente, podés eliminarlo.
 *
 * Optimizado: una sola query en vez de dos (antes consultaba profiles + professionals por separado).
 */
export async function GET() {
  try {
    const supabase = await createClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    // Una sola query: obtener datos de suscripción directamente de professionals.
    // Si no existe el registro, el usuario no es profesional.
    const { data: professional, error: proError } = await supabase
      .from("professionals")
      .select("subscription_plan, subscription_status, trial_ends_at")
      .eq("id", user.id)
      .maybeSingle();

    if (proError) {
      return NextResponse.json({ error: "Error al consultar datos" }, { status: 500 });
    }

    if (!professional) {
      return NextResponse.json(
        { error: "Solo los profesionales pueden acceder a esta información" },
        { status: 403 }
      );
    }

    const { subscription_plan, subscription_status, trial_ends_at } = professional;

    // Calcular días hasta fin del trial
    let daysUntilTrialEnd: number | null = null;
    if (trial_ends_at) {
      const now = new Date();
      const trialEnd = new Date(trial_ends_at);
      const diffMs = trialEnd.getTime() - now.getTime();
      daysUntilTrialEnd = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
    }

    return NextResponse.json({
      plan: subscription_plan || "free",
      status: subscription_status || "trialing",
      trialEndsAt: trial_ends_at,
      daysUntilTrialEnd,
    });
  } catch (error) {
    console.error("Error GET /api/subscription/status:", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
