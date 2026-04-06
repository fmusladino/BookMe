/**
 * Fix: inserta schedule_configs y working_hours para profesionales que no los tengan.
 * Ejecutar: npx tsx scripts/fix-working-hours.ts
 */
import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";
import * as path from "path";

dotenv.config({ path: path.resolve(__dirname, "../apps/web/.env.local") });

const supabaseUrl = process.env["NEXT_PUBLIC_SUPABASE_URL"]!;
const serviceRoleKey = process.env["SUPABASE_SERVICE_ROLE_KEY"]!;

if (!supabaseUrl || !serviceRoleKey) {
  console.error("Faltan variables de entorno");
  process.exit(1);
}

const admin = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function main() {
  // Obtener todos los profesionales
  const { data: professionals, error } = await admin
    .from("professionals")
    .select("id, profile:profiles(full_name)");

  if (error || !professionals) {
    console.error("Error obteniendo profesionales:", error?.message);
    return;
  }

  console.log(`Encontrados ${professionals.length} profesionales\n`);

  for (const pro of professionals) {
    const name = (pro.profile as any)?.full_name || pro.id;

    // Verificar si ya tiene schedule_config
    const { data: existing } = await admin
      .from("schedule_configs")
      .select("id")
      .eq("professional_id", pro.id)
      .single();

    if (!existing) {
      console.log(`[${name}] Creando schedule_config...`);
      await admin.from("schedule_configs").upsert({
        professional_id: pro.id,
        working_days: [1, 2, 3, 4, 5],
        slot_duration: 30,
        vacation_mode: false,
      });
    } else {
      console.log(`[${name}] schedule_config ya existe`);
    }

    // Verificar si ya tiene working_hours
    const { data: hours } = await admin
      .from("working_hours")
      .select("id")
      .eq("professional_id", pro.id)
      .limit(1);

    if (!hours || hours.length === 0) {
      console.log(`[${name}] Creando working_hours (Lun-Vie 09:00-13:00 y 14:00-18:00)...`);
      for (const day of [1, 2, 3, 4, 5]) {
        await admin.from("working_hours").insert([
          { professional_id: pro.id, day_of_week: day, start_time: "09:00", end_time: "13:00" },
          { professional_id: pro.id, day_of_week: day, start_time: "14:00", end_time: "18:00" },
        ]);
      }
      console.log(`[${name}] ✅ Horarios creados`);
    } else {
      console.log(`[${name}] working_hours ya existen`);
    }

    console.log("");
  }

  console.log("✅ Listo!");
}

main();
