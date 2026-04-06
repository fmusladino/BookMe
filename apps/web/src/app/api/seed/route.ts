import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";

// POST /api/seed
// Crea un usuario profesional de prueba para desarrollo.
// Solo funciona si no existe ya un usuario con ese email.
// IMPORTANTE: deshabilitar en producción.
export async function POST() {
  if (process.env["NODE_ENV"] === "production") {
    return NextResponse.json({ error: "No disponible en producción" }, { status: 403 });
  }

  const supabase = createAdminClient();

  const TEST_EMAIL = "admin@bookme.ar";
  const TEST_PASSWORD = "BookMe2026!";
  const TEST_DNI = "99999999";

  try {
    // Verificar si ya existe
    const { data: existingUsers } = await supabase.auth.admin.listUsers();
    const existing = existingUsers?.users?.find((u) => u.email === TEST_EMAIL);

    if (existing) {
      return NextResponse.json({
        message: "El usuario de prueba ya existe",
        email: TEST_EMAIL,
        password: TEST_PASSWORD,
      });
    }

    // Crear usuario en Supabase Auth
    const { data: authUser, error: authError } = await supabase.auth.admin.createUser({
      email: TEST_EMAIL,
      password: TEST_PASSWORD,
      email_confirm: true,
      user_metadata: {
        role: "professional",
        full_name: "Dr. Demo BookMe",
        dni: TEST_DNI,
      },
    });

    if (authError || !authUser.user) {
      console.error("Error creando usuario:", authError);
      return NextResponse.json({ error: authError?.message ?? "Error creando usuario" }, { status: 500 });
    }

    const userId = authUser.user.id;

    // Crear perfil (si el trigger no lo creó)
    await supabase.from("profiles").upsert({
      id: userId,
      role: "professional",
      full_name: "Dr. Demo BookMe",
      dni: TEST_DNI,
      phone: "+5491112345678",
    }, { onConflict: "id" });

    // Crear profesional
    const trialEnd = new Date();
    trialEnd.setDate(trialEnd.getDate() + 30);

    await supabase.from("professionals").upsert({
      id: userId,
      line: "healthcare",
      specialty: "Clínica Médica",
      specialty_slug: "clinica-medica",
      bio: "Profesional de prueba para desarrollo de BookMe",
      city: "Buenos Aires",
      province: "CABA",
      country: "AR",
      address: "Av. Corrientes 1234",
      public_slug: "dr-demo",
      is_visible: true,
      subscription_plan: "standard",
      subscription_status: "trialing",
      billing_cycle: "monthly",
      trial_ends_at: trialEnd.toISOString(),
    }, { onConflict: "id" });

    // Crear configuración de agenda por defecto
    await supabase.from("schedule_configs").upsert({
      professional_id: userId,
      working_days: [1, 2, 3, 4, 5],
      slot_duration: 30,
      vacation_mode: false,
    }, { onConflict: "professional_id" });

    // Crear horarios laborales
    const workingHours = [1, 2, 3, 4, 5].map((day) => ({
      professional_id: userId,
      day_of_week: day,
      start_time: "09:00",
      end_time: "18:00",
    }));

    await supabase.from("working_hours").insert(workingHours);

    // Crear algunos servicios de ejemplo
    const services = [
      { name: "Consulta general", duration_minutes: 30, price: 5000, show_price: true, line: "healthcare" as const },
      { name: "Control de seguimiento", duration_minutes: 20, price: 3500, show_price: true, line: "healthcare" as const },
      { name: "Primera consulta", duration_minutes: 45, price: 7000, show_price: false, line: "healthcare" as const },
    ];

    for (const svc of services) {
      await supabase.from("services").insert({
        professional_id: userId,
        ...svc,
      });
    }

    return NextResponse.json({
      message: "Usuario de prueba creado correctamente",
      email: TEST_EMAIL,
      password: TEST_PASSWORD,
      userId,
      slug: "bookme.ar/@dr-demo",
    });
  } catch (error) {
    console.error("Error en seed:", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
