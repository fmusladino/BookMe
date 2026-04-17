// Crea un usuario de prueba COMPRADOR en Mercado Pago.
// MP no permite pagar con la misma cuenta que creó los planes, por eso necesitás uno aparte.
//
// Uso: node scripts/create-mp-test-buyer.mjs

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const envPath = resolve(process.cwd(), "apps/web/.env.local");
const envContent = readFileSync(envPath, "utf8");
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

if (!ACCESS_TOKEN || ACCESS_TOKEN === "placeholder") {
  console.error("MP_ACCESS_TOKEN no está configurado");
  process.exit(1);
}

const res = await fetch("https://api.mercadopago.com/users/test_user", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    Authorization: `Bearer ${ACCESS_TOKEN}`,
  },
  body: JSON.stringify({
    site_id: "MLA",
    description: "Comprador de prueba BookMe",
  }),
});

const data = await res.json();
if (!res.ok) {
  console.error("Error:", res.status, data);
  process.exit(1);
}

console.log("✓ Usuario COMPRADOR de prueba creado:\n");
console.log(`  Email:    ${data.email}`);
console.log(`  Password: ${data.password}`);
console.log(`  User ID:  ${data.id}`);
console.log();
console.log("Usá estos datos para loguearte en el checkout de MP y completar la suscripción.");
