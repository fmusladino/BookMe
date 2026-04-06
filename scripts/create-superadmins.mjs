// Script para crear los dos superadmins (Fer y Facu) — dueños de BookMe
// Ejecutar: node scripts/create-superadmins.mjs

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const SUPERADMINS = [
  {
    email: "fer@bookme.ar",
    password: "BookMe2024!",
    full_name: "Fer",
    dni: "00000001",
    phone: null,
    role: "superadmin",
  },
  {
    email: "facu@bookme.ar",
    password: "BookMe2024!",
    full_name: "Facu",
    dni: "00000002",
    phone: null,
    role: "superadmin",
  },
];

async function supaFetch(path, body) {
  const res = await fetch(`${SUPABASE_URL}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
      apikey: SERVICE_ROLE_KEY,
    },
    body: JSON.stringify(body),
  });
  return { ok: res.ok, data: await res.json() };
}

async function supaRpc(path, method, body) {
  const res = await fetch(`${SUPABASE_URL}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
      apikey: SERVICE_ROLE_KEY,
      Prefer: "return=minimal",
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  return { ok: res.ok, status: res.status };
}

async function createSuperAdmin(admin) {
  console.log(`\n--- Creando ${admin.full_name} (${admin.email}) ---`);

  // 1. Crear usuario en auth
  const { ok, data } = await supaFetch("/auth/v1/admin/users", {
    email: admin.email,
    password: admin.password,
    email_confirm: true,
    app_metadata: { role: admin.role },
  });

  if (!ok) {
    // Si el usuario ya existe, buscar su ID
    if (data?.msg?.includes("already been registered") || data?.message?.includes("already been registered")) {
      console.log(`  Usuario ${admin.email} ya existe. Buscando ID...`);

      const listRes = await fetch(`${SUPABASE_URL}/auth/v1/admin/users?page=1&per_page=500`, {
        headers: {
          Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
          apikey: SERVICE_ROLE_KEY,
        },
      });
      const listData = await listRes.json();
      const existing = listData.users?.find((u) => u.email === admin.email);

      if (!existing) {
        console.error("  No se pudo encontrar el usuario existente");
        return null;
      }

      console.log(`  Encontrado: ${existing.id}`);

      // Actualizar app_metadata con el rol
      const updateRes = await fetch(`${SUPABASE_URL}/auth/v1/admin/users/${existing.id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
          apikey: SERVICE_ROLE_KEY,
        },
        body: JSON.stringify({
          app_metadata: { role: admin.role },
        }),
      });

      if (!updateRes.ok) {
        console.error("  Error actualizando app_metadata");
      } else {
        console.log("  app_metadata actualizado a superadmin");
      }

      return existing.id;
    }

    console.error("  Error creando usuario:", JSON.stringify(data, null, 2));
    return null;
  }

  const userId = data.id;
  console.log(`  Auth user creado: ${userId}`);

  return userId;
}

async function upsertProfile(userId, admin) {
  // Intentar insertar perfil, si ya existe actualizarlo
  const checkRes = await fetch(
    `${SUPABASE_URL}/rest/v1/profiles?id=eq.${userId}&select=id`,
    {
      headers: {
        Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
        apikey: SERVICE_ROLE_KEY,
      },
    }
  );
  const existing = await checkRes.json();

  if (existing.length > 0) {
    // Update
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/profiles?id=eq.${userId}`,
      {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
          apikey: SERVICE_ROLE_KEY,
          Prefer: "return=minimal",
        },
        body: JSON.stringify({
          role: admin.role,
          full_name: admin.full_name,
        }),
      }
    );
    if (res.ok) {
      console.log(`  Perfil actualizado → role: ${admin.role}`);
    } else {
      console.error("  Error actualizando perfil:", res.status);
    }
  } else {
    // Insert
    const res = await fetch(`${SUPABASE_URL}/rest/v1/profiles`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
        apikey: SERVICE_ROLE_KEY,
        Prefer: "return=minimal",
      },
      body: JSON.stringify({
        id: userId,
        role: admin.role,
        full_name: admin.full_name,
        dni: admin.dni,
        phone: admin.phone,
      }),
    });
    if (res.ok) {
      console.log(`  Perfil creado → role: ${admin.role}`);
    } else {
      const errBody = await res.text();
      console.error("  Error creando perfil:", res.status, errBody);
    }
  }
}

async function main() {
  console.log("=== Creando superadmins de BookMe ===");

  for (const admin of SUPERADMINS) {
    const userId = await createSuperAdmin(admin);
    if (userId) {
      await upsertProfile(userId, admin);
    }
  }

  console.log("\n=== Listo ===");
  console.log("\nCredenciales:");
  for (const admin of SUPERADMINS) {
    console.log(`  ${admin.full_name}: ${admin.email} / ${admin.password}`);
  }
  console.log("\nAcceso: http://localhost:3000/login → Panel Super Admin en /admin");
}

main().catch(console.error);
