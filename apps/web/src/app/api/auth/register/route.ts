import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { z } from "zod";
import { checkRateLimit, getClientIp } from "@/lib/security";
import { getTrialEndsAt } from "@/lib/trial";
import { validateStrongPassword, PASSWORD_MIN_LENGTH } from "@/lib/password";

// Schema base para todos los registros
const baseSchema = z.object({
  email: z.string().email("Email inválido"),
  password: z.string().min(PASSWORD_MIN_LENGTH, `La contraseña debe tener al menos ${PASSWORD_MIN_LENGTH} caracteres`),
  full_name: z.string().min(1, "El nombre es requerido"),
  dni: z.string().min(1, "El DNI es requerido"),
  phone: z.string().min(1, "El teléfono es requerido"),
  // Tipo de cuenta: paciente, profesional o canchas
  account_type: z.enum(["patient", "professional", "canchas"]).default("patient"),
  // Campos extra para profesionales (opcionales) — BookMe es solo Healthcare
  line: z.literal("healthcare").optional(),
  specialty: z.string().optional(),
  // Ubicación del consultorio/local
  address: z.string().optional(),
  city: z.string().optional(),
  province: z.string().optional(),
  postal_code: z.string().optional(),
  country: z.string().optional(),
  // Campos extra para canchas
  business_name: z.string().optional(),
  sport: z.string().optional(),
  whatsapp: z.string().optional(),
});

/**
 * POST /api/auth/register
 * Registra un nuevo usuario como paciente, profesional o dueño de canchas.
 *
 * - Paciente: crea auth user + profile (role: patient)
 * - Profesional: crea auth user + profile (role: professional) + professionals row con trial 7 días
 * - Canchas: crea auth user + profile (role: canchas) + court_owners row con trial 7 días
 */
export async function POST(request: NextRequest) {
  try {
    // Rate limiting: máx 5 registros por minuto por IP (previene spam de cuentas)
    const ip = getClientIp(request);
    const rateLimitError = checkRateLimit(`register:${ip}`, 5, 60_000);
    if (rateLimitError) return rateLimitError;

    const body = (await request.json()) as unknown;
    const parsed = baseSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Datos inválidos", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const {
      email, password, full_name, dni, phone, account_type,
      line, specialty, address, city, province, postal_code, country,
      business_name, sport, whatsapp,
    } = parsed.data;

    // Validar fuerza de contraseña (mayúscula, minúscula, número, símbolo, no común)
    const passwordError = validateStrongPassword(password);
    if (passwordError) {
      return NextResponse.json({ error: passwordError }, { status: 400 });
    }

    // Validar campos extra si es profesional — siempre healthcare
    const effectiveLine = "healthcare" as const;
    if (account_type === "professional") {
      if (line && line !== "healthcare") {
        return NextResponse.json({ error: "Línea no soportada" }, { status: 400 });
      }
      if (!specialty || specialty.trim().length === 0) {
        return NextResponse.json({ error: "La especialidad es requerida" }, { status: 400 });
      }
      if (!address?.trim()) {
        return NextResponse.json({ error: "La dirección es requerida" }, { status: 400 });
      }
      if (!city?.trim()) {
        return NextResponse.json({ error: "La localidad es requerida" }, { status: 400 });
      }
      if (!province?.trim()) {
        return NextResponse.json({ error: "La provincia es requerida" }, { status: 400 });
      }
      if (!postal_code?.trim()) {
        return NextResponse.json({ error: "El código postal es requerido" }, { status: 400 });
      }
    }

    // Validar campos extra si es canchas
    if (account_type === "canchas") {
      if (!business_name?.trim()) {
        return NextResponse.json({ error: "El nombre del complejo es requerido" }, { status: 400 });
      }
      if (!city?.trim()) {
        return NextResponse.json({ error: "La localidad es requerida" }, { status: 400 });
      }
      if (!province?.trim()) {
        return NextResponse.json({ error: "La provincia es requerida" }, { status: 400 });
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

    // Mapear account_type a role en BD
    const roleMap: Record<string, string> = {
      professional: "professional",
      patient: "patient",
      canchas: "canchas",
    };
    const role = roleMap[account_type] ?? "patient";

    // 2. Verificar DNI duplicado antes de crear perfil
    const { data: existingDni } = await admin
      .from("profiles")
      .select("id")
      .eq("dni", dni)
      .maybeSingle();

    if (existingDni) {
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

    // 4a. Si es profesional, crear la fila en professionals con trial
    if (account_type === "professional" && specialty) {
      const trialEnd = getTrialEndsAt();

      const baseSlug =
        full_name
          .toLowerCase()
          .normalize("NFD")
          .replace(/[\u0300-\u036f]/g, "")
          .replace(/[^a-z0-9\s-]/g, "")
          .replace(/\s+/g, "-")
          .replace(/-+/g, "-")
          .replace(/^-|-$/g, "")
          .slice(0, 60) || "profesional";

      // public_slug es UNIQUE: si el nombre ya est\u00e1 tomado, agregamos sufijo num\u00e9rico
      const { data: takenSlugs } = await admin
        .from("professionals")
        .select("public_slug")
        .like("public_slug", `${baseSlug}%`);

      const taken = new Set((takenSlugs ?? []).map((r) => r.public_slug as string));
      let slug = baseSlug;
      for (let i = 2; taken.has(slug); i++) {
        slug = `${baseSlug.slice(0, 55)}-${i}`;
      }

      const specialtySlug = specialty
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9\s-]/g, "")
        .replace(/\s+/g, "-")
        .replace(/-+/g, "-");

      const { error: profError } = await admin.from("professionals").insert({
        id: userId,
        line: effectiveLine,
        specialty,
        specialty_slug: specialtySlug,
        public_slug: slug,
        is_visible: true,
        subscription_plan: "standard",
        subscription_status: "trialing",
        billing_cycle: "monthly",
        trial_ends_at: trialEnd.toISOString(),
        address: address?.trim() || null,
        city: city?.trim() || "",
        province: province?.trim() || "",
        postal_code: postal_code?.trim() || null,
        country: country?.trim() || "AR",
      });

      if (profError) {
        console.error("Professional error:", profError);
        await admin.from("profiles").delete().eq("id", userId);
        await admin.auth.admin.deleteUser(userId);
        // Exponemos el detalle del error de BD: sin esto el fallo es imposible de diagnosticar
        return NextResponse.json(
          { error: `Error al crear el perfil profesional: ${profError.message}`, code: profError.code },
          { status: 500 }
        );
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

    // 4b. Si es canchas, crear la fila en court_owners con trial
    if (account_type === "canchas" && business_name) {
      const trialEnd = getTrialEndsAt();

      // Generar slug público a partir del nombre del complejo
      const baseSlug = business_name
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9\s-]/g, "")
        .replace(/\s+/g, "-")
        .replace(/-+/g, "-")
        .slice(0, 60);

      // Verificar si el slug ya existe y hacer único con sufijo
      const { data: existingSlug } = await admin
        .from("court_owners")
        .select("id")
        .eq("slug", baseSlug)
        .maybeSingle();

      const slug = existingSlug ? `${baseSlug}-${Date.now()}` : baseSlug;

      const { error: courtOwnerError } = await admin.from("court_owners").insert({
        id: userId,
        business_name: business_name.trim(),
        slug,
        address: address?.trim() || null,
        city: city?.trim() || "",
        province: province?.trim() || "",
        postal_code: postal_code?.trim() || null,
        country: country?.trim() || "AR",
        phone,
        whatsapp: whatsapp?.trim() || null,
        is_visible: true,
        subscription_plan: "standard",
        subscription_status: "trialing",
        trial_ends_at: trialEnd.toISOString(),
      });

      if (courtOwnerError) {
        console.error("Court owner error:", courtOwnerError);
        await admin.from("profiles").delete().eq("id", userId);
        await admin.auth.admin.deleteUser(userId);
        return NextResponse.json({ error: "Error al crear el perfil de canchas" }, { status: 500 });
      }

      // Crear una cancha de ejemplo si se especificó el deporte
      if (sport?.trim()) {
        await admin.from("courts").insert({
          owner_id: userId,
          name: `Cancha 1`,
          sport: sport.trim(),
          price_per_hour: 0,
          seña_required: false,
          is_active: true,
        });
      }
    }

    const redirectMap: Record<string, string> = {
      professional: "/dashboard",
      patient: "/mis-turnos",
      canchas: "/canchas",
    };

    return NextResponse.json(
      {
        message: "Cuenta creada exitosamente",
        userId,
        role,
        redirect: redirectMap[account_type] ?? "/",
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Error POST /api/auth/register:", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
