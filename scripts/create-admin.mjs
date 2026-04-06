// Script para crear el usuario admin en Supabase
// Ejecutar: node scripts/create-admin.mjs

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const email = "admin@bookme.ar";
const password = "Admin1234!";

async function createUser() {
  console.log(`Creando usuario ${email}...`);

  const res = await fetch(`${SUPABASE_URL}/auth/v1/admin/users`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
      apikey: SERVICE_ROLE_KEY,
    },
    body: JSON.stringify({
      email,
      password,
      email_confirm: true,
    }),
  });

  const data = await res.json();

  if (!res.ok) {
    console.error("Error:", JSON.stringify(data, null, 2));
    process.exit(1);
  }

  console.log("Usuario creado exitosamente!");
  console.log("ID:", data.id);
  console.log("Email:", email);
  console.log("Password:", password);
  console.log("\nYa podés iniciar sesión en localhost:3000/login");
}

createUser();
