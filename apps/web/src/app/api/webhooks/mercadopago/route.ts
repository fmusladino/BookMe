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

    // Determinar plan:
    // 1. Si viene preapproval_plan_id (suscripción creada con template), usar MP_PLAN_MAP
    // 2. Si no (creada con monto dinámico vía /create-checkout), parsear external_reference
    //    formato: "bookme|<userId>|<plan>|<cycle>|<line>"
    let resolvedPlan: SubscriptionPlan = "base";
    let resolvedUserId: string | null = null;
    let refBillingCycle: "monthly" | "annual" | null = null;

    const planId = subscription.preapproval_plan_id ?? "";
    if (planId && MP_PLAN_MAP[planId]) {
      resolvedPlan = MP_PLAN_MAP[planId]!;
    } else if (subscription.external_reference?.startsWith("bookme|")) {
      const parts = subscription.external_reference.split("|");
      // parts: ["bookme", userId, plan, cycle, line]
      if (parts[2] === "base" || parts[2] === "standard" || parts[2] === "premium") {
        resolvedPlan = parts[2];
      }
      if (parts[1]) resolvedUserId = parts[1];
      if (parts[3] === "monthly" || parts[3] === "annual") refBillingCycle = parts[3];
    }

    // Determinar billing cycle:
    // 1. Si external_reference lo trae, usarlo (más confiable)
    // 2. Si no, derivar de auto_recurring
    const freqType = subscription.auto_recurring?.frequency_type;
    const billingCycle =
      refBillingCycle ??
      (freqType === "months" && (subscription.auto_recurring?.frequency ?? 1) >= 12
        ? "annual"
        : "monthly");

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

    // ─── Marcar past_due_since y registrar el payment ──────────────────
    // Si pasa a past_due, dejamos `past_due_since` con el primer fallo del ciclo.
    // Si vuelve a active, lo limpiamos (cobro regularizado) y marcamos el último
    // payment como `paid`.
    const now = new Date();
    if (mapped.status === "past_due") {
      // Solo setear past_due_since si todavía no estaba marcado (no pisar fechas previas)
      const { data: currentPro } = await supabase
        .from("professionals")
        .select("past_due_since")
        .eq("mp_subscription_id", subscription.id)
        .maybeSingle();
      if (!currentPro?.past_due_since) {
        updateData["past_due_since"] = now.toISOString();
      }
    } else if (mapped.status === "active") {
      updateData["past_due_since"] = null;
    }

    // Actualizar estado del profesional:
    // preferimos matchear por mp_subscription_id (que grabamos al crear el
    // preapproval), pero si no existe aún caemos al user_id del external_reference.
    if (resolvedUserId) {
      await supabase
        .from("professionals")
        .update(updateData)
        .or(`mp_subscription_id.eq.${subscription.id},id.eq.${resolvedUserId}`);
    } else {
      await supabase
        .from("professionals")
        .update(updateData)
        .eq("mp_subscription_id", subscription.id);
    }

    // Registrar el payment en histórico (para alimentar /admin/cobros y el cron)
    if (resolvedUserId || subscription.id) {
      // Buscar el id del profesional (necesitamos uuid, no mp_subscription_id)
      let proId = resolvedUserId;
      if (!proId) {
        const { data: pro } = await supabase
          .from("professionals")
          .select("id")
          .eq("mp_subscription_id", subscription.id)
          .maybeSingle();
        proId = pro?.id ?? null;
      }

      if (proId) {
        const period = { year: now.getUTCFullYear(), month: now.getUTCMonth() + 1 };
        const paymentStatus =
          subscription.status === "authorized" ? "paid" :
          subscription.status === "paused"     ? "failed" : null;

        if (paymentStatus) {
          // Upsert por (professional_id, period_year, period_month) — máx 1 payment por mes.
          // La UNIQUE INDEX uq_payments_pro_period garantiza idempotencia ante reentradas
          // del webhook (MP puede reenviar el mismo evento varias veces).
          await supabase
            .from("payments")
            .upsert(
              {
                professional_id: proId,
                period_year: period.year,
                period_month: period.month,
                amount: 0, // amount real se setea al crear el preapproval; acá registramos el evento
                currency: "ARS",
                status: paymentStatus,
                mp_subscription_id: subscription.id,
                attempted_at: now.toISOString(),
                paid_at: paymentStatus === "paid" ? now.toISOString() : null,
                failure_reason: paymentStatus === "failed" ? "MercadoPago: subscription paused" : null,
              },
              { onConflict: "professional_id,period_year,period_month" }
            );
        }
      }
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error("Error en webhook de MercadoPago:", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
