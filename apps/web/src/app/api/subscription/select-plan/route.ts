import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { z } from "zod";

export const dynamic = "force-dynamic";

const selectPlanSchema = z.object({
  plan: z.enum(["base", "standard", "premium"]),
  billing_cycle: z.enum(["monthly", "annual"]).default("monthly"),
  // Datos mockeados de tarjeta — en producción se reemplaza con token del procesador
  card_last_four: z.string().length(4),
  card_brand: z.string().optional(),
});

/**
 * POST /api/subscription/select-plan
 * El profesional elige su plan e ingresa su tarjeta.
 * - Si está en trial: registra el plan y la tarjeta. El cobro se hará al vencer el trial.
 * - Si el trial ya venció: "cobra" inmediatamente (mock) y activa.
 *
 * En producción, aquí se crearía la suscripción en MercadoPago/Stripe
 * con cobro diferido si está en trial o cobro inmediato si ya venció.
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    // Obtener profesional
    const { data: professional, error: profError } = await supabase
      .from("professionals")
      .select("id, subscription_plan, subscription_status, trial_ends_at, line")
      .eq("id", user.id)
      .single();

    if (profError || !professional) {
      return NextResponse.json({ error: "Profesional no encontrado" }, { status: 404 });
    }

    // Parsear body
    const body = await request.json();
    const parsed = selectPlanSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Datos inválidos", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { plan, billing_cycle, card_last_four, card_brand } = parsed.data;

    // Determinar si el trial está vigente
    const now = new Date();
    const trialEndsAt = professional.trial_ends_at ? new Date(professional.trial_ends_at) : null;
    const trialActive = trialEndsAt && trialEndsAt > now;

    // En producción:
    // 1. Si trialActive → crear suscripción con cobro diferido (trial_end como start_date)
    // 2. Si !trialActive → cobrar inmediatamente y activar
    // Por ahora, mockeamos el resultado.

    const newStatus = trialActive ? "trialing" : "active";

    // Guardar el plan seleccionado y datos mock de tarjeta
    const { error: updateError } = await supabase
      .from("professionals")
      .update({
        subscription_plan: plan,
        subscription_status: newStatus,
        // Campos mock que se agregarían para almacenar info de pago:
        // payment_card_last_four: card_last_four,
        // payment_card_brand: card_brand,
        // payment_billing_cycle: billing_cycle,
      })
      .eq("id", user.id);

    if (updateError) {
      console.error("[select-plan] update error:", updateError);
      return NextResponse.json({ error: "Error al actualizar plan" }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      plan,
      billing_cycle,
      status: newStatus,
      card_last_four,
      trial_active: !!trialActive,
      message: trialActive
        ? `Plan ${plan} confirmado. Se cobrará al finalizar tu trial.`
        : `Plan ${plan} activado. Pago procesado correctamente.`,
    });
  } catch (err) {
    console.error("[POST /api/subscription/select-plan]", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
