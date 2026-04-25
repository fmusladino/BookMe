/**
 * Seed: profesional de prueba en mora
 *
 * Crea (o reutiliza) un profesional con su pago atrasado hace 8 días para
 * que aparezca en /admin/cobros y reciba el recordatorio "soft" cuando se
 * ejecute /api/cron/billing-reminders.
 *
 * Uso:
 *   node scripts/seed-overdue-test.mjs
 *
 * Requiere las env vars en apps/web/.env.local:
 *   NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 */

import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";
import { fileURLToPath } from "url";
import path from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, "../apps/web/.env.local") });

const SUPA_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPA_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPA_URL || !SUPA_KEY) {
  console.error("❌ Faltan NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en apps/web/.env.local");
  process.exit(1);
}

const admin = createClient(SUPA_URL, SUPA_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// ─── Datos del profesional de prueba ──────────────────────────
const TEST_USER = {
  email: "moroso.test@bookme-test.com",
  password: "BookMe2024!",
  full_name: "Dr. Test Moroso",
  dni: "99999001",
  phone: "+5491155559999",
  line: "healthcare",
  specialty: "Médico Clínico",
  specialty_slug: "medico-clinico",
  city: "CABA",
  province: "Buenos Aires",
  bio: "Profesional de prueba para validar el flujo de impago de BookMe.",
  public_slug: "dr-test-moroso",
};

// 8 días atrás → entra en bucket "soft" (día 7)
const DAYS_OVERDUE = 8;
const PAST_DUE_SINCE = new Date();
PAST_DUE_SINCE.setDate(PAST_DUE_SINCE.getDate() - DAYS_OVERDUE);

async function main() {
  console.log("🌱 Seed: profesional de prueba en mora\n");

  // 1. Crear o reutilizar el usuario en auth
  console.log(`👤 Creando ${TEST_USER.email}...`);
  let userId;
  const { data: created, error: createErr } = await admin.auth.admin.createUser({
    email: TEST_USER.email,
    password: TEST_USER.password,
    email_confirm: true,
  });

  if (createErr) {
    if (createErr.message?.includes("already") || createErr.message?.includes("exists")) {
      const { data: existing } = await admin.auth.admin.listUsers({ perPage: 1000 });
      const u = existing?.users?.find((x) => x.email === TEST_USER.email);
      if (!u) throw new Error(`No pude encontrar usuario existente ${TEST_USER.email}`);
      userId = u.id;
      console.log(`  ⚠️  ya existía → reusando ${userId}`);
    } else {
      throw createErr;
    }
  } else {
    userId = created.user.id;
    console.log(`  ✅ creado ${userId}`);
  }

  // 2. Profile
  console.log("👤 Upserting profile...");
  const { error: profErr } = await admin.from("profiles").upsert({
    id: userId,
    role: "professional",
    full_name: TEST_USER.full_name,
    dni: TEST_USER.dni,
    phone: TEST_USER.phone,
  });
  if (profErr) console.error("  ❌ profile:", profErr.message);
  else console.log("  ✅ profile ok");

  // 3. Professional con past_due_since seteado
  console.log("🩺 Upserting professional con past_due_since...");
  const { error: proErr } = await admin.from("professionals").upsert({
    id: userId,
    line: TEST_USER.line,
    specialty: TEST_USER.specialty,
    specialty_slug: TEST_USER.specialty_slug,
    bio: TEST_USER.bio,
    city: TEST_USER.city,
    province: TEST_USER.province,
    country: "AR",
    public_slug: TEST_USER.public_slug,
    is_visible: true,
    subscription_plan: "standard",
    subscription_status: "past_due",
    past_due_since: PAST_DUE_SINCE.toISOString(),
  });
  if (proErr) console.error("  ❌ professional:", proErr.message);
  else console.log(`  ✅ professional ok (past_due_since = ${PAST_DUE_SINCE.toISOString().slice(0, 10)})`);

  // 4. Payment failed asociado
  console.log("💳 Insertando payment failed...");
  // Borrar payments previos del mismo profesional para mantener idempotencia
  await admin.from("payments").delete().eq("professional_id", userId);

  const period = { year: PAST_DUE_SINCE.getUTCFullYear(), month: PAST_DUE_SINCE.getUTCMonth() + 1 };
  const { error: payErr } = await admin.from("payments").insert({
    professional_id: userId,
    period_year: period.year,
    period_month: period.month,
    amount: 15000, // ARS 15.000 plan Standard healthcare
    currency: "ARS",
    status: "failed",
    failure_reason: "MercadoPago: tarjeta rechazada (cc_rejected_insufficient_amount)",
    attempted_at: PAST_DUE_SINCE.toISOString(),
  });
  if (payErr) console.error("  ❌ payment:", payErr.message);
  else console.log("  ✅ payment failed registrado (ARS 15.000)");

  // 5. Limpiar reminders previos para que el cron pueda mandarlos de nuevo si querés probarlo
  await admin.from("payment_reminders").delete().eq("professional_id", userId);
  console.log("🧹 Reminders previos borrados (para que el cron tenga qué hacer)");

  console.log("\n╔══════════════════════════════════════════════════════════════╗");
  console.log("║       ✅ USUARIO DE PRUEBA EN MORA CREADO                    ║");
  console.log("╠══════════════════════════════════════════════════════════════╣");
  console.log(`║  Email:    ${TEST_USER.email.padEnd(48)} ║`);
  console.log(`║  Password: ${TEST_USER.password.padEnd(48)} ║`);
  console.log(`║  Estado:   past_due  (${DAYS_OVERDUE} días en mora)                       ║`);
  console.log(`║  Monto:    ARS 15.000 (plan Standard healthcare)             ║`);
  console.log("╠══════════════════════════════════════════════════════════════╣");
  console.log("║  Cómo verlo:                                                 ║");
  console.log("║    1) Login como admin@bookme-test.com                       ║");
  console.log("║    2) Ir a /admin/cobros                                     ║");
  console.log("║    3) Aparece en bucket \"Días 7-9 (soft)\"                    ║");
  console.log("║                                                              ║");
  console.log("║  Para ver el banner del profesional:                         ║");
  console.log(`║    Login con ${TEST_USER.email.padEnd(35)}      ║`);
  console.log("║    Verás el banner naranja \"Pago pendiente\" en el dashboard. ║");
  console.log("╚══════════════════════════════════════════════════════════════╝\n");
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("\n❌ Error fatal:", err);
    process.exit(1);
  });
