// Script para configurar la base de datos de BookMe
// Ejecutar: node scripts/setup-db.mjs

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const ADMIN_EMAIL = "admin@bookme.ar";
const ADMIN_PASSWORD = "Admin1234!";

async function supabaseAdmin(path, options = {}) {
  const res = await fetch(`${SUPABASE_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
      apikey: SERVICE_ROLE_KEY,
      Prefer: options.prefer || "return=representation",
      ...options.headers,
    },
  });
  const data = await res.json().catch(() => null);
  return { ok: res.ok, status: res.status, data };
}

async function main() {
  console.log("=== BookMe — Setup de base de datos ===\n");

  // 1. Verificar que las tablas existen
  console.log("1. Verificando tablas...");
  const { ok: tablesOk, data: tablesData } = await supabaseAdmin(
    "/rest/v1/profiles?select=id&limit=1"
  );

  if (!tablesOk) {
    console.error("   ❌ Las tablas no existen. Necesitás ejecutar las migraciones SQL.");
    console.error("   Ve al SQL Editor en https://supabase.com/dashboard y ejecutá:");
    console.error("   - supabase/migrations/00001_initial_schema.sql");
    console.error("   - supabase/migrations/00002_rls_policies.sql");
    console.error("   - supabase/migrations/00003_subscription_plans_update.sql (si existe)");
    console.error("\n   Después volvé a ejecutar este script.");
    process.exit(1);
  }
  console.log("   ✅ Tablas encontradas\n");

  // 2. Buscar o crear el usuario admin
  console.log("2. Buscando usuario admin...");
  const { data: users } = await supabaseAdmin(
    "/auth/v1/admin/users?page=1&per_page=50"
  );

  let adminUser = users?.users?.find((u) => u.email === ADMIN_EMAIL);

  if (!adminUser) {
    console.log("   Creando usuario admin...");
    const { ok, data } = await supabaseAdmin("/auth/v1/admin/users", {
      method: "POST",
      body: JSON.stringify({
        email: ADMIN_EMAIL,
        password: ADMIN_PASSWORD,
        email_confirm: true,
        user_metadata: {
          role: "professional",
          full_name: "Admin BookMe",
          dni: "00000000",
        },
      }),
    });

    if (!ok) {
      console.error("   ❌ Error creando usuario:", JSON.stringify(data));
      process.exit(1);
    }
    adminUser = data;
    console.log("   ✅ Usuario creado:", adminUser.id);
  } else {
    console.log("   ✅ Usuario encontrado:", adminUser.id);
  }

  // 3. Verificar/crear perfil
  console.log("\n3. Verificando perfil...");
  const { data: profiles } = await supabaseAdmin(
    `/rest/v1/profiles?id=eq.${adminUser.id}&select=*`
  );

  if (!profiles || profiles.length === 0) {
    console.log("   Creando perfil...");
    const { ok, data } = await supabaseAdmin("/rest/v1/profiles", {
      method: "POST",
      body: JSON.stringify({
        id: adminUser.id,
        role: "professional",
        full_name: "Admin BookMe",
        dni: "00000000",
        phone: "+5491100000000",
      }),
    });

    if (!ok) {
      console.error("   ❌ Error creando perfil:", JSON.stringify(data));
      process.exit(1);
    }
    console.log("   ✅ Perfil creado");
  } else {
    console.log("   ✅ Perfil existente");
  }

  // 4. Verificar/crear registro de profesional
  console.log("\n4. Verificando registro de profesional...");
  const { data: profs } = await supabaseAdmin(
    `/rest/v1/professionals?id=eq.${adminUser.id}&select=*`
  );

  if (!profs || profs.length === 0) {
    console.log("   Creando registro de profesional...");
    const { ok, data } = await supabaseAdmin("/rest/v1/professionals", {
      method: "POST",
      body: JSON.stringify({
        id: adminUser.id,
        line: "healthcare",
        specialty: "Medicina General",
        specialty_slug: "medicina-general",
        city: "Buenos Aires",
        province: "CABA",
        country: "AR",
        public_slug: "admin-bookme",
        is_visible: true,
        subscription_plan: "premium",
        subscription_status: "active",
      }),
    });

    if (!ok) {
      console.error("   ❌ Error creando profesional:", JSON.stringify(data));
      process.exit(1);
    }
    console.log("   ✅ Profesional creado");
  } else {
    console.log("   ✅ Profesional existente");
  }

  // 5. Crear config de agenda
  console.log("\n5. Verificando configuración de agenda...");
  const { data: configs } = await supabaseAdmin(
    `/rest/v1/schedule_configs?professional_id=eq.${adminUser.id}&select=*`
  );

  if (!configs || configs.length === 0) {
    console.log("   Creando configuración de agenda...");
    const { ok } = await supabaseAdmin("/rest/v1/schedule_configs", {
      method: "POST",
      body: JSON.stringify({
        professional_id: adminUser.id,
        working_days: [1, 2, 3, 4, 5],
        slot_duration: 30,
      }),
    });

    if (ok) console.log("   ✅ Config de agenda creada");
  } else {
    console.log("   ✅ Config existente");
  }

  console.log("\n=== Setup completo ===");
  console.log(`Email:    ${ADMIN_EMAIL}`);
  console.log(`Password: ${ADMIN_PASSWORD}`);
  console.log("Ahora refrescá localhost:3000/dashboard/agenda");
}

main().catch(console.error);
