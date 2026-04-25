import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { z } from "zod";

export const dynamic = "force-dynamic";

const checkoutSchema = z.object({
  plan: z.enum(["base", "standard", "premium"]),
  billing_cycle: z.enum(["monthly", "annual"]).default("monthly"),
});

// Precios en USD (deberían venir de la DB igual que useFeatures, pero por ahora
// se resuelven desde los fallbacks del front). Si en el futuro se quieren leer
// dinámicamente, reemplazar este objeto por una query a la tabla plan_features.
const USD_PRICES: Record<string, Record<string, Record<string, number>>> = {
  healthcare: {
    base:     { monthly: 9,  annual: 97  }, // 10% off
    standard: { monthly: 15, annual: 162 },
    premium:  { monthly: 20, annual: 216 },
  },
  business: {
    base:     { monthly: 7,  annual: 76  },
    standard: { monthly: 14, annual: 151 },
    premium:  { monthly: 25, annual: 270 },
  },
};

interface DolarApiResponse {
  venta: number;
  compra: number;
}

async function fetchRateARS(): Promise<number> {
  const res = await fetch("https://dolarapi.com/v1/dolares/oficial", {
    next: { revalidate: 1800 },
  });
  if (!res.ok) throw new Error(`dolarapi HTTP ${res.status}`);
  const data = (await res.json()) as DolarApiResponse;
  if (!data.venta || data.venta <= 0) throw new Error("Cotización inválida");
  return data.venta;
}

interface MPPreapprovalRequest {
  reason: string;
  external_reference: string;
  payer_email: string;
  back_url: string;
  status: "pending" | "authorized";
  auto_recurring: {
    frequency: number;
    frequency_type: "months";
    transaction_amount: number;
    currency_id: "ARS";
  };
}

interface MPPreapprovalResponse {
  id: string;
  init_point: string;
  status: string;
}

/**
 * POST /api/subscription/create-checkout
 *
 * Crea una suscripción preapproval en MercadoPago con monto dinámico
 * (USD del plan × cotización ARS oficial) y devuelve el init_point para
 * redirigir al usuario al checkout. El webhook `/api/webhooks/mercadopago`
 * recibe el evento cuando el usuario autoriza y activa la suscripción
 * leyendo el `external_reference`.
 */
export async function POST(request: NextRequest) {
  try {
    const accessToken = process.env["MP_ACCESS_TOKEN"];
    if (!accessToken || accessToken === "placeholder") {
      return NextResponse.json(
        { error: "Mercado Pago no está configurado (MP_ACCESS_TOKEN)" },
        { status: 503 }
      );
    }

    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user || !user.email) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const { data: professional, error: profError } = await supabase
      .from("professionals")
      .select("id, line")
      .eq("id", user.id)
      .single();

    if (profError || !professional || !professional.line) {
      return NextResponse.json(
        { error: "Profesional no encontrado" },
        { status: 404 }
      );
    }

    const parsed = checkoutSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Datos inválidos", details: parsed.error.flatten() },
        { status: 400 }
      );
    }
    const { plan, billing_cycle } = parsed.data;
    const line = professional.line as "healthcare" | "business";

    const usd = USD_PRICES[line]?.[plan]?.[billing_cycle];
    if (!usd) {
      return NextResponse.json(
        { error: `No hay precio configurado para ${line}/${plan}/${billing_cycle}` },
        { status: 400 }
      );
    }

    // Convertir a ARS con la cotización oficial al momento de crear la suscripción.
    // MP solo acepta ARS en Argentina; el monto se fija al crear el preapproval y
    // se mantiene constante en los cobros recurrentes hasta que el usuario edite.
    let rate: number;
    try {
      rate = await fetchRateARS();
    } catch (err) {
      console.error("[create-checkout] error obteniendo cotización:", err);
      return NextResponse.json(
        { error: "No se pudo obtener la cotización del dólar" },
        { status: 503 }
      );
    }
    const amountARS = Math.round(usd * rate);

    // external_reference: codifica quién es el usuario, qué plan y qué ciclo
    // para que el webhook pueda actualizar el professional correcto sin consultas extra.
    const externalRef = `bookme|${user.id}|${plan}|${billing_cycle}|${line}`;

    // back_url: MP exige HTTPS Y que el dominio sea "estable" (rechaza varios
    // subdominios de tunneling/sandbox con 500). Por eso, a menos que se defina
    // explícitamente MP_BACK_URL, usamos siempre bookme.ar como destino final.
    // En desarrollo esto significa que el redirect "mp=success" no vuelve al
    // dev server, pero el webhook (que es quien realmente activa la suscripción)
    // sí funciona vía ngrok. Para testear el redirect localmente, setear
    // MP_BACK_URL=https://tu-ngrok.ngrok-free.dev/dashboard/plan?mp=success
    const backUrl =
      process.env["MP_BACK_URL"] ?? "https://bookme.ar/dashboard/plan?mp=success";

    // Frecuencia MP: mensual = 1 mes, anual = 12 meses.
    // En sandbox MP exige que payer y collector sean ambos "test users". Si se
    // define MP_TEST_PAYER_EMAIL (email de un usuario de prueba creado en el
    // panel de MP), se usa ese en lugar del email real. En producción borrar
    // esa env var para que siempre se cobre al mail real del profesional.
    const payerEmail = process.env["MP_TEST_PAYER_EMAIL"] || user.email;

    const mpBody: MPPreapprovalRequest = {
      reason: `BookMe ${line === "healthcare" ? "Healthcare" : "Business"} - Plan ${plan.charAt(0).toUpperCase() + plan.slice(1)}`,
      external_reference: externalRef,
      payer_email: payerEmail,
      back_url: backUrl,
      status: "pending",
      auto_recurring: {
        frequency: billing_cycle === "annual" ? 12 : 1,
        frequency_type: "months",
        transaction_amount: amountARS,
        currency_id: "ARS",
      },
    };

    console.log("[create-checkout] Enviando a MP:", JSON.stringify(mpBody, null, 2));
    console.log("[create-checkout] Token prefix:", accessToken.slice(0, 15) + "...");

    const mpRes = await fetch("https://api.mercadopago.com/preapproval", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify(mpBody),
    });

    const mpText = await mpRes.text();
    if (!mpRes.ok) {
      console.error("[create-checkout] MP error status:", mpRes.status);
      console.error("[create-checkout] MP error body:", mpText);
      console.error("[create-checkout] MP error headers:", Object.fromEntries(mpRes.headers.entries()));
      return NextResponse.json(
        { error: `Mercado Pago devolvió ${mpRes.status}`, detail: mpText },
        { status: 502 }
      );
    }

    const mpData = JSON.parse(mpText) as MPPreapprovalResponse;

    // Guardamos el preapproval_id pendiente. Cuando MP confirme vía webhook,
    // se actualizará subscription_plan/status con el plan elegido.
    await supabase
      .from("professionals")
      .update({
        mp_subscription_id: mpData.id,
      })
      .eq("id", user.id);

    return NextResponse.json({
      init_point: mpData.init_point,
      preapproval_id: mpData.id,
      amount_ars: amountARS,
      amount_usd: usd,
      exchange_rate: rate,
    });
  } catch (err) {
    console.error("[POST /api/subscription/create-checkout]", err);
    const msg = err instanceof Error ? err.message : "Error interno";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
