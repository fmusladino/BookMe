import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/server";
import { z } from "zod";
import { verifyAdminAuth } from "../_lib/auth";
import type { LineOfBusiness, SubscriptionPlan } from "@/types";

// ─── Schemas ─────────────────────────────────────────────────────────────

const createProfessionalSchema = z.object({
  email: z.string().email("Email inválido"),
  password: z.string().min(6, "Contraseña mínimo 6 caracteres"),
  full_name: z.string().min(1, "Nombre requerido"),
  dni: z.string().min(1, "DNI requerido"),
  phone: z.string().min(1, "Teléfono requerido"),
  line: z.enum(["healthcare", "business"] as const),
  specialty: z.string().min(1, "Especialidad requerida"),
  specialty_slug: z.string().min(1, "Slug de especialidad requerido"),
  city: z.string().min(1, "Ciudad requerida"),
  province: z.string().min(1, "Provincia requerida"),
  bio: z.string().optional().nullable(),
  public_slug: z.string().min(1, "Slug público requerido"),
  subscription_plan: z
    .enum(["free", "base", "standard", "premium"] as const)
    .default("free"),
});

// ─── GET /api/admin/professionals ─────────────────────────────────────

/**
 * Lista todos los profesionales con filtros opcionales.
 * Query params:
 *   - search: busca por full_name o email
 *   - line: filtra por healthcare | business
 */
export async function GET(request: NextRequest) {
  const authResult = await verifyAdminAuth("superadmin");
  if ("error" in authResult) return authResult.error;

  try {
    const supabase = await createClient();
    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search");
    const line = searchParams.get("line");

    let query = supabase
      .from("professionals")
      .select(
        `
        id,
        line,
        specialty,
        city,
        province,
        public_slug,
        is_visible,
        subscription_plan,
        subscription_status,
        created_at,
        profiles:id (
          full_name,
          email: id,
          phone
        )
      `,
        { count: "exact" }
      );

    // Filtrar por línea si se especifica
    if (line && ["healthcare", "business"].includes(line)) {
      query = query.eq("line", line as LineOfBusiness);
    }

    const { data, error, count } = await query;

    if (error) {
      console.error("[GET professionals error]", error);
      return NextResponse.json(
        { error: "Error al obtener profesionales" },
        { status: 500 }
      );
    }

    // Filtrado en memoria por search si es necesario
    // (Nota: idealmente esto se haría en la BD, pero requiere mejoras en RLS)
    let filtered = data || [];
    if (search) {
      const searchLower = search.toLowerCase();
      filtered = filtered.filter((p: any) => {
        const fullName = (p.profiles?.full_name || "").toLowerCase();
        return fullName.includes(searchLower);
      });
    }

    return NextResponse.json({
      professionals: filtered,
      total: count,
    });
  } catch (error) {
    console.error("[GET professionals]", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

// ─── POST /api/admin/professionals ────────────────────────────────────

/**
 * Crea un nuevo profesional.
 * - Crea usuario en auth
 * - Crea perfil
 * - Crea registro de profesional
 * - Crea configuración de agenda
 * - Crea horarios de trabajo por defecto
 */
export async function POST(request: NextRequest) {
  const authResult = await verifyAdminAuth("superadmin");
  if ("error" in authResult) return authResult.error;

  try {
    const body = (await request.json()) as unknown;
    const parsed = createProfessionalSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Datos inválidos", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const {
      email,
      password,
      full_name,
      dni,
      phone,
      line,
      specialty,
      specialty_slug,
      city,
      province,
      bio,
      public_slug,
      subscription_plan,
    } = parsed.data;

    const admin = createAdminClient();

    // 1. Crear usuario en Auth
    const { data: authData, error: authError } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });

    if (authError) {
      if (
        authError.message?.includes("already been registered") ||
        authError.message?.includes("already exists")
      ) {
        return NextResponse.json(
          { error: "Ya existe una cuenta con ese email" },
          { status: 409 }
        );
      }
      console.error("[Auth error]", authError);
      return NextResponse.json(
        { error: authError.message || "Error al crear la cuenta" },
        { status: 500 }
      );
    }

    if (!authData.user) {
      return NextResponse.json(
        { error: "Error al crear la cuenta" },
        { status: 500 }
      );
    }

    const userId = authData.user.id;

    // 2. Crear perfil
    const { error: profileError } = await admin.from("profiles").insert({
      id: userId,
      full_name,
      dni,
      phone,
      role: "professional",
    });

    if (profileError) {
      console.error("[Profile error]", profileError);
      await admin.auth.admin.deleteUser(userId);
      return NextResponse.json(
        { error: "Error al crear el perfil" },
        { status: 500 }
      );
    }

    // 3. Crear registro de profesional
    const { error: profError } = await admin.from("professionals").insert({
      id: userId,
      line,
      specialty,
      specialty_slug,
      city,
      province,
      country: "Argentina", // Default para MVP LATAM
      bio: bio || null,
      public_slug,
      is_visible: true,
      subscription_plan: subscription_plan as SubscriptionPlan,
      subscription_status: "trialing",
      billing_cycle: "monthly",
      trial_ends_at: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
    });

    if (profError) {
      console.error("[Professional error]", profError);
      await admin.auth.admin.deleteUser(userId);
      await admin.from("profiles").delete().eq("id", userId);
      return NextResponse.json(
        { error: "Error al crear el registro de profesional" },
        { status: 500 }
      );
    }

    // 4. Crear configuración de agenda por defecto
    const { error: scheduleError } = await admin
      .from("schedule_configs")
      .insert({
        professional_id: userId,
        working_days: [1, 2, 3, 4, 5], // Lunes a viernes
        slot_duration: 30,
        lunch_break_start: "12:00",
        lunch_break_end: "13:00",
        vacation_mode: false,
      });

    if (scheduleError) {
      console.error("[Schedule config error]", scheduleError);
      // No fallar, crear el profesional de todas formas
    }

    // 5. Crear horarios de trabajo por defecto (9-17 L-V)
    const defaultHours = [];
    for (let day = 1; day <= 5; day++) {
      defaultHours.push({
        professional_id: userId,
        day_of_week: day,
        start_time: "09:00",
        end_time: "17:00",
      });
    }

    const { error: hoursError } = await admin
      .from("working_hours")
      .insert(defaultHours);

    if (hoursError) {
      console.error("[Working hours error]", hoursError);
      // No fallar
    }

    return NextResponse.json(
      {
        message: "Profesional creado exitosamente",
        professional: {
          id: userId,
          email,
          full_name,
          line,
          specialty,
          city,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("[POST professionals]", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
