import { NextResponse, type NextRequest } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { z } from "zod";

// Motivos predefinidos + opción libre. El front los muestra como radio buttons.
const CANCELLATION_REASONS = [
  "price_too_high",
  "not_using",
  "missing_features",
  "switched_platform",
  "closed_business",
  "technical_issues",
  "other",
] as const;

const cancelSchema = z.object({
  reason: z.enum(CANCELLATION_REASONS),
  feedback: z.string().max(1000).optional().nullable(),
});

// POST /api/subscription/cancel — da de baja la suscripción al cierre del período actual.
// - Cancela el auto-renew en MercadoPago (si hay preapproval).
// - Marca cancelled_at + motivos en la DB.
// - La suscripción sigue activa hasta subscription_expires_at (o trial_ends_at).
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const body = (await request.json()) as unknown;
    const parsed = cancelSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Motivo inválido", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const admin = createAdminClient();

    const { data: professional, error: proError } = await admin
      .from("professionals")
      .select("id, subscription_status, mp_subscription_id, cancelled_at, subscription_expires_at, trial_ends_at")
      .eq("id", user.id)
      .single();

    if (proError || !professional) {
      return NextResponse.json({ error: "Profesional no encontrado" }, { status: 404 });
    }

    if (professional.cancelled_at) {
      return NextResponse.json(
        { error: "La suscripción ya fue dada de baja previamente" },
        { status: 409 }
      );
    }

    if (professional.subscription_status === "cancelled") {
      return NextResponse.json(
        { error: "La suscripción ya está cancelada" },
        { status: 409 }
      );
    }

    // Cancelar el auto-renew en MercadoPago (si existe preapproval activo)
    const mpToken = process.env["MP_ACCESS_TOKEN"];
    if (professional.mp_subscription_id && mpToken && mpToken !== "placeholder") {
      try {
        const mpRes = await fetch(
          `https://api.mercadopago.com/preapproval/${professional.mp_subscription_id}`,
          {
            method: "PUT",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${mpToken}`,
            },
            body: JSON.stringify({ status: "cancelled" }),
          }
        );
        if (!mpRes.ok) {
          const errText = await mpRes.text();
          console.error("[cancel] MP no pudo cancelar preapproval:", mpRes.status, errText);
          // Seguimos de todas formas: marcamos cancelled_at local, el admin podrá re-sincronizar.
        }
      } catch (err) {
        console.error("[cancel] Error llamando a MP:", err);
      }
    }

    // Guardar motivos + cancelled_at. Mantener subscription_status como estaba
    // para que el profesional conserve acceso hasta el fin del período pago / trial.
    const { error: updError } = await admin
      .from("professionals")
      .update({
        cancelled_at: new Date().toISOString(),
        cancellation_reason: parsed.data.reason,
        cancellation_feedback: parsed.data.feedback ?? null,
      })
      .eq("id", user.id);

    if (updError) {
      console.error("[cancel] Error guardando cancelación:", updError);
      return NextResponse.json({ error: "Error al guardar" }, { status: 500 });
    }

    // Fecha hasta la cual el profesional sigue teniendo acceso completo
    const accessUntil =
      professional.subscription_expires_at ??
      professional.trial_ends_at ??
      null;

    return NextResponse.json({
      success: true,
      access_until: accessUntil,
      message: accessUntil
        ? "Tu suscripción se dará de baja al finalizar el período actual."
        : "Tu suscripción fue dada de baja.",
    });
  } catch (error) {
    console.error("[cancel] Error:", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
