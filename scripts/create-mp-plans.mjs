// Crea 2 planes de suscripción de prueba en Mercado Pago usando preapproval_plan.
//
// Uso:
//   1. Asegurate que apps/web/.env.local tenga MP_ACCESS_TOKEN con tu token de sandbox
//   2. Correr:  node scripts/create-mp-plans.mjs
//   3. Copiar los plan IDs que imprime y pegarlos en apps/web/.env.local como
//      MP_PLAN_BASE=... y MP_PLAN_STANDARD=...
//
// Docs: https://www.mercadopago.com.ar/developers/es/reference/subscriptions/_preapproval_plan/post

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

// Cargar .env.local de apps/web
const envPath = resolve(process.cwd(), "apps/web/.env.local");
let envContent;
try {
  envContent = readFileSync(envPath, "utf8");
} catch {
  console.error(`No encontré ${envPath}`);
  process.exit(1);
}

const env = Object.fromEntries(
  envContent
    .split("\n")
    .filter((l) => l && !l.startsWith("#") && l.includes("="))
    .map((l) => {
      const idx = l.indexOf("=");
      return [l.slice(0, idx).trim(), l.slice(idx + 1).trim()];
    })
);

const ACCESS_TOKEN = env.MP_ACCESS_TOKEN;
// MP rechaza URLs localhost — usamos el dominio público verificado.
// Esta URL se usa solo para el redirect después del pago. Podés cambiarla luego.
const APP_URL = "https://bookme.ar";

if (!ACCESS_TOKEN || ACCESS_TOKEN === "placeholder") {
  console.error("MP_ACCESS_TOKEN no está configurado en apps/web/.env.local");
  process.exit(1);
}

const PLANS = [
  {
    reason: "BookMe — Plan de prueba BASE",
    external_reference: "bookme_test_base",
    auto_recurring: {
      frequency: 1,
      frequency_type: "months",
      transaction_amount: 100,
      currency_id: "ARS",
    },
    back_url: `${APP_URL}/dashboard/plan?mp=success`,
    status: "active",
  },
  {
    reason: "BookMe — Plan de prueba STANDARD",
    external_reference: "bookme_test_standard",
    auto_recurring: {
      frequency: 1,
      frequency_type: "months",
      transaction_amount: 500,
      currency_id: "ARS",
    },
    back_url: `${APP_URL}/dashboard/plan?mp=success`,
    status: "active",
  },
];

async function createPlan(plan) {
  const res = await fetch("https://api.mercadopago.com/preapproval_plan", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${ACCESS_TOKEN}`,
    },
    body: JSON.stringify(plan),
  });

  const text = await res.text();
  let body;
  try {
    body = JSON.parse(text);
  } catch {
    body = text;
  }

  if (!res.ok) {
    console.error(`Falló al crear "${plan.reason}":`, res.status, body);
    return null;
  }

  return body;
}

console.log("Creando planes de prueba en MercadoPago...\n");

const results = [];
for (const plan of PLANS) {
  const result = await createPlan(plan);
  if (result) {
    results.push({ name: plan.reason, id: result.id, init_point: result.init_point });
    console.log(`✓ ${plan.reason}`);
    console.log(`  ID:         ${result.id}`);
    console.log(`  init_point: ${result.init_point}`);
    console.log();
  }
}

if (results.length > 0) {
  console.log("────────────────────────────────────────────────");
  console.log("Agregá estas líneas a apps/web/.env.local:");
  console.log("────────────────────────────────────────────────");
  console.log(`MP_PLAN_BASE=${results[0]?.id ?? ""}`);
  console.log(`MP_PLAN_STANDARD=${results[1]?.id ?? ""}`);
  console.log("────────────────────────────────────────────────\n");
  console.log("Después reiniciá el server con:");
  console.log("  (en el task runner) reiniciar @bookme/web#dev");
}
