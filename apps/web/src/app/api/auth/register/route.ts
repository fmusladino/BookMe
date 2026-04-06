import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { z } from "zod";

// Schema base para todos los registros
const baseSchema = z.object({
  email: z.string().email("Email inválido"),
  password: z.string().min(6, "La contraseña debe tener al menos 6 caracteres"),
  full_name: z.string().min(1, "El nombre es requerido"),
  dni: z.string().min(1, "El DNI es requerido"),
  phone: z.string().min(1, "El teléfono es requerido"),
  // Tipo de cuenta: paciente o profesional
  account_type: z.enum(["patient", "professional"]).default("patient"),
  // Campos extra para profesionales (opcionales)
  line: z.enum(["healthcare", "business"]).optional(),
  specialty: z.string().optional(),
});

/**
 * POST /api/auth/register
 * Registra un nuevo usuario como paciente o profesional.
 *
 * - Paciente: crea auth user + profile (role: patient)
 * - Profesional: crea auth user + profile (role: professional) + professionals row con trial 30 días
 */
export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as unknown;
    const parsed = baseSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Datos inválidos", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { email, password, full_name, dni, phone, account_type, line, specialty } = parsed.data;

    // Validar campos extra si es profesional
    if (account_type === "professional") {
      if (!line) {
        return NextResponse.json({ error: "La línea de negocio es requerida" }, { status: 400 });
      }
      if (!specialty || specialty.trim().length === 0) {
        return NextResponse.json({ error: "La especialidad es requerida" }, { status: 400 });
      }
    }

    const admin = createAdminClient();

    // 1. Crear usuario en Supabase Auth
    const { data: authData, error: authError } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true, // Auto-confirmar para MVP
    });

    if (authError) {
      if (authError.message?.includes("already been registered") || authError.message?.includes("already exists")) {
        return NextResponse.json(
          { error: "Ya existe una cuenta con ese email" },
          { status: 409 }
        );
      }
      console.error("Auth error:", authError);
      return NextResponse.json(
        { error: authError.message || "Error al crear la cuenta" },
        { status: 500 }
      );
    }

    if (!authData.user) {
      return NextResponse.json({ error: "Error al crear la cuenta" }, { status: 500 });
    }

    const userId = authData.user.id;
    const role = account_type === "professional" ? "professional" : "patient";

    // 2. Verificar DNI duplicado antes de crear perfil
    const { data: existingDni } = await admin
      .from("profiles")
      .select("id")
      .eq("dni", dni)
      .maybeSingle();

    if (existingDni) {
      // Limpiar: borrar auth user creado
      await admin.auth.admin.deleteUser(userId);
      return NextResponse.json(
        { error: "Ya existe una cuenta registrada con ese DNI" },
        { status: 409 }
      );
    }

    // 3. Crear perfil
    const { error: profileError } = await admin.from("profiles").insert({
      id: userId,
      full_name,
      dni,
      phone,
      role,
    });

    if (profileError) {
      console.error("Profile error:", profileError);
      await admin.auth.admin.deleteUser(userId);
      const msg = profileError.code === "23505"
        ? "Ya existe una cuenta con ese DNI o email"
        : `Error al crear el perfil: ${profileError.message}`;
      return NextResponse.json({ error: msg }, { status: profileError.code === "23505" ? 409 : 500 });
    }

    // 4. Si es profesional, crear la fila en professionals con trial de 30 días
    if (account_type === "professional" && line && specialty) {
      const trialEnd = new Date();
      trialEnd.setDate(trialEnd.getDate() + 30);

      // Generar slug público a partir del nombre
      const slug = full_name
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9\s-]/g, "")
        .replace(/\s+/g, "-")
        .replace(/-+/g, "-")
        .slice(0, 60);

      // Generar specialty_slug
      const specialtySlug = specialty
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9\s-]/g, "")
        .replace(/\s+/g, "-")
        .replace(/-+/g, "-");

      const { error: profError } = await admin.from("professionals").insert({
        id: userId,
        line,
        specialty,
        specialty_slug: specialtySlug,
        public_slug: slug,
        is_visible: true,
        subscription_plan: "standard",
        subscription_status: "trialing",
        billing_cycle: "monthly",
        trial_ends_at: trialEnd.toISOString(),
        city: "",
        province: "",
        country: "AR",
      });

      if (profError) {
        console.error("Professional error:", profError);
        // Limpiar: borrar perfil y auth user
        await admin.from("profiles").delete().eq("id", userId);
        await admin.auth.admin.deleteUser(userId);
        return NextResponse.json({ error: "Error al crear el perfil profesional" }, { status: 500 });
      }

      // Crear configuración de agenda por defecto
      await admin.from("schedule_configs").upsert({
        professional_id: userId,
        working_days: [1, 2, 3, 4, 5],
        slot_duration: 30,
        vacation_mode: false,
      }, { onConflict: "professional_id" });

      // Crear horarios laborales por defecto (lunes a viernes 9-18)
      const workingHours = [1, 2, 3, 4, 5].map((day) => ({
        professional_id: userId,
        day_of_week: day,
        start_time: "09:00",
        end_time: "18:00",
      }));
      await admin.from("working_hours").insert(workingHours);
    }

    return NextResponse.json(
      {
        message: "Cuenta creada exitosamente",
        userId,
        role,
        redirect: role === "professional" ? "/dashboard" : "/mis-turnos",
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Error POST /api/auth/register:", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
