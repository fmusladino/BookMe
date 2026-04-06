import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import type { SubscriptionPlan, SubscriptionStatus } from "@/types";
import crypto from "crypto";

// Mapeo de plan_id de MercadoPago → plan interno de BookMe.
// Estos IDs se configuran al crear los planes en MP.
const MP_PLAN_MAP: Record<string, SubscriptionPlan> = {
  [process.env["MP_PLAN_BASE"] ?? ""]: "base",
  [process.env["MP_PLAN_STANDARD"] ?? ""]: "standard",
  [process.env["MP_PLAN_PREMIUM"] ?? ""]: "premium",
};

// POST /api/webhooks/mercadopago
// Recibe notificaciones de cambios en suscripciones de MercadoPago
export async function POST(request: NextRequest) {
  try {
    // Verificar firma de MercadoPago
    const xSignature = request.headers.get("x-signature");
    const xRequestId = request.headers.get("x-request-id");

    if (!xSignature || !xRequestId) {
      return NextResponse.json(
        { error: "Firma inválida" },
        { status: 401 }
      );
    }

    const body = await request.text();

    // Validar HMAC-SHA256
    const secret = process.env["MP_WEBHOOK_SECRET"] ?? "";
    const parts = xSignature.split(",");
    const ts = parts.find((p) => p.startsWith("ts="))?.split("=")[1];
    const v1 = parts.find((p) => p.startsWith("v1="))?.split("=")[1];

    const template = `id:${xRequestId};request-id:${xRequestId};ts:${ts};`;
    const hmac = crypto
      .createHmac("sha256", secret)
      .update(template)
      .digest("hex");

    if (hmac !== v1) {
      return NextResponse.json(
        { error: "Firma inválida" },
        { status: 401 }
      );
    }

    const event = JSON.parse(body) as {
      type: string;
      data: { id: string };
    };

    // Solo procesamos eventos de suscripciones
    if (event.type !== "subscription_preapproval") {
      return NextResponse.json({ received: true });
    }

    const supabase = createAdminClient();

    // Consultar estado actual de la suscripción en MercadoPago
    const mpRes = await fetch(
      `https://api.mercadopago.com/preapproval/${event.data.id}`,
      {
        headers: {
          Authorization: `Bearer ${process.env["MP_ACCESS_TOKEN"]}`,
        },
      }
    );

    if (!mpRes.ok) {
      console.error("Error consultando MP:", await mpRes.text());
      return NextResponse.json({ error: "Error MP" }, { status: 500 });
    }

    const subscription = (await mpRes.json()) as {
      id: string;
      status: string;
      preapproval_plan_id?: string;
      external_reference?: string;
      auto_recurring?: {
        frequency: number;
        frequency_type: string;
      };
    };

    // Determinar plan según el preapproval_plan_id
    const planId = subscription.preapproval_plan_id ?? "";
    const resolvedPlan = MP_PLAN_MAP[planId] ?? "base";

    // Determinar billing cycle según frecuencia de MP
    const freqType = subscription.auto_recurring?.frequency_type;
    const billingCycle =
      freqType === "months" && (subscription.auto_recurring?.frequency ?? 1) >= 12
        ? "annual"
        : "monthly";

    // Mapeo de estado MP → estado BookMe
    const statusMap: Record<
      string,
      { plan: SubscriptionPlan; status: SubscriptionStatus }
    > = {
      authorized: { plan: resolvedPlan, status: "active" },
      paused: { plan: resolvedPlan, status: "past_due" },
      cancelled: { plan: "free", status: "cancelled" },
    };

    const mapped = statusMap[subscription.status];
    if (!mapped) {
      return NextResponse.json({ received: true });
    }

    // Campos base para actualizar
    const updateData: Record<string, unknown> = {
      subscription_plan: mapped.plan,
      subscription_status: mapped.status,
      mp_subscription_id: subscription.id,
      mp_plan_id: planId,
      billing_cycle: billingCycle,
    };

    // Si se cancela, registrar fecha y retención de datos (90 días)
    if (subscription.status === "cancelled") {
      const now = new Date();
      const retentionDate = new Date(now);
      retentionDate.setDate(retentionDate.getDate() + 90);
      updateData["cancelled_at"] = now.toISOString();
      updateData["data_retention_until"] = retentionDate.toISOString();
    }

    // Actualizar estado del profesional
    await supabase
      .from("professionals")
      .update(updateData)
      .eq("mp_subscription_id", subscription.id);

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error("Error en webhook de MercadoPago:", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
