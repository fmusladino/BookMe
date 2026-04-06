import { NextResponse, type NextRequest } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { z } from "zod";
import { verifyAdminAuth } from "../_lib/auth";
import type { UserRole, SubscriptionPlan } from "@/types";

// ─── Schemas ─────────────────────────────────────────────────────────────

const createUserSchema = z.object({
  email: z.string().email("Email inválido"),
  password: z.string().min(6, "Contraseña mínimo 6 caracteres"),
  full_name: z.string().min(1, "Nombre requerido"),
  dni: z.string().min(1, "DNI requerido"),
  phone: z.string().min(1, "Teléfono requerido"),
  role: z.enum(["professional", "patient", "admin", "superadmin", "marketing"] as const),
  // Campos opcionales para profesionales — obligatorios cuando role = "professional"
  line: z.enum(["healthcare", "business", "consultorio"]).optional(),
  specialty: z.string().optional(),
  subscription_plan: z.enum(["free", "base", "standard", "premium"]).optional(),
  // Campos opcionales para admin de consultorio — obligatorios cuando role = "admin"
  clinic_name: z.string().optional(),
  clinic_plan: z.enum(["small", "large"]).optional(),
  clinic_billing_cycle: z.enum(["monthly", "annual"]).optional(),
}).refine(
  (data) => {
    if (data.role === "professional") {
      if (data.line === "consultorio") {
        return !!data.clinic_name;
      }
      return !!data.line && !!data.specialty;
    }
    return true;
  },
  { message: "Campos obligatorios faltantes para la línea seleccionada" }
);

// ─── GET /api/admin/users ────────────────────────────────────────────

/**
 * Lista todos los perfiles (usuarios) con soporte para filtrado por rol.
 * Soporta filtro especial: ?role=clinic_owner para mostrar owners de clínica.
 * Retorna conteos por cada rol + clinic_owner count.
 */
export async function GET(request: NextRequest) {
  const authResult = await verifyAdminAuth("superadmin");
  if ("error" in authResult) return authResult.error;

  try {
    const supabase = await createClient();
    const admin = createAdminClient();
    const { searchParams } = new URL(request.url);
    const roleFilter = searchParams.get("role");

    // Obtener TODOS los perfiles siempre (para conteos)
    const { data: allProfiles, error: allError } = await supabase
      .from("profiles")
      .select("id, full_name, role, dni, phone, created_at");

    if (allError) {
      console.error("[GET users error]", allError);
      return NextResponse.json({ error: "Error al obtener usuarios" }, { status: 500 });
    }

    // Obtener emails desde auth.users
    const { data: authUsersResult } = await admin.auth.admin.listUsers({ perPage: 1000 });
    const emailMap: Record<string, string> = {};
    if (authUsersResult?.users) {
      for (const u of authUsersResult.users) {
        if (u.email) emailMap[u.id] = u.email;
      }
    }

    // Obtener owners de clínicas
    const { data: clinics } = await admin
      .from("clinics")
      .select("id, name, owner_id");

    const clinicOwnerIds = new Set((clinics ?? []).map((c) => c.owner_id));
    const clinicNameByOwner: Record<string, string> = {};
    (clinics ?? []).forEach((c) => {
      clinicNameByOwner[c.owner_id] = c.name;
    });

    // Obtener visibilidad en cartilla de profesionales
    const { data: proVisibility } = await admin
      .from("professionals")
      .select("id, is_visible");
    const visibilityMap: Record<string, boolean> = {};
    (proVisibility ?? []).forEach((p) => {
      visibilityMap[p.id] = p.is_visible;
    });

    // Enriquecer perfiles
    const enrichedUsers = (allProfiles || []).map((p) => ({
      ...p,
      email: emailMap[p.id] || "—",
      is_clinic_owner: clinicOwnerIds.has(p.id),
      clinic_name: clinicNameByOwner[p.id] ?? null,
      is_visible: visibilityMap[p.id] ?? null,
    }));

    // Conteos por rol
    const roleCounts: Record<string, number> = {
      professional: 0,
      patient: 0,
      admin: 0,
      superadmin: 0,
      marketing: 0,
      clinic_owner: clinicOwnerIds.size,
    };

    enrichedUsers.forEach((p) => {
      if (p.role in roleCounts) {
        roleCounts[p.role]++;
      }
    });

    // Filtrar
    let filteredUsers = enrichedUsers;
    if (roleFilter === "clinic_owner") {
      filteredUsers = enrichedUsers.filter((u) => u.is_clinic_owner);
    } else if (roleFilter && ["professional", "patient", "admin", "superadmin", "marketing"].includes(roleFilter)) {
      filteredUsers = enrichedUsers.filter((u) => u.role === roleFilter);
    }

    return NextResponse.json({
      users: filteredUsers,
      total: filteredUsers.length,
      roleCounts,
    });
  } catch (error) {
    console.error("[GET users]", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

// ─── POST /api/admin/users ───────────────────────────────────────────

/**
 * Crea un nuevo usuario con cualquier rol.
 * Usa el admin client para crear el usuario de auth.
 */
export async function POST(request: NextRequest) {
  const authResult = await verifyAdminAuth("superadmin");
  if ("error" in authResult) return authResult.error;

  try {
    const body = (await request.json()) as unknown;
    const parsed = createUserSchema.safeParse(body);

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
      role,
      line,
      specialty,
      subscription_plan,
      clinic_name,
      clinic_plan,
      clinic_billing_cycle,
    } = parsed.data;

    const admin = createAdminClient();

    // 1. Crear usuario en Auth
    const { data: authData, error: authError } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      app_metadata: { role },
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

    // 2. Crear perfil (si es consultorio, el rol real es "admin")
    const effectiveRole = line === "consultorio" ? "admin" : role;
    const { error: profileError } = await admin.from("profiles").insert({
      id: userId,
      full_name,
      dni,
      phone,
      role: effectiveRole,
    });

    if (profileError) {
      console.error("[Profile error]", profileError);
      await admin.auth.admin.deleteUser(userId);
      return NextResponse.json(
        { error: "Error al crear el perfil" },
        { status: 500 }
      );
    }

    // 3. Si es profesional (Healthcare/Business), crear registro en professionals con plan y config de agenda
    if (role === "professional" && line && line !== "consultorio" && specialty) {
      const plan = (subscription_plan ?? "free") as SubscriptionPlan;
      const specialtySlug = specialty
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "");

      // Generar slug público único basado en el nombre
      const baseSlug = full_name
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "");

      // Trial de 30 días si el plan no es free
      const trialEndsAt = plan !== "free"
        ? new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
        : null;

      const { error: profError } = await admin.from("professionals").insert({
        id: userId,
        line,
        specialty,
        specialty_slug: specialtySlug,
        public_slug: baseSlug,
        is_visible: true,
        subscription_plan: plan,
        subscription_status: plan === "free" ? "active" : "trialing",
        billing_cycle: "monthly",
        trial_ends_at: trialEndsAt,
      });

      if (profError) {
        console.error("[Professional error]", profError);
        // Rollback: eliminar perfil y auth
        await admin.from("profiles").delete().eq("id", userId);
        await admin.auth.admin.deleteUser(userId);
        return NextResponse.json(
          { error: "Error al crear el registro de profesional: " + profError.message },
          { status: 500 }
        );
      }

      // Crear configuración de agenda por defecto
      const { error: scheduleError } = await admin.from("schedule_configs").insert({
        professional_id: userId,
        slot_duration: 30,
        working_days: [1, 2, 3, 4, 5], // Lunes a viernes
        vacation_mode: false,
      });

      if (scheduleError) {
        console.error("[Schedule config warning]", scheduleError);
        // No rollback por esto — no es crítico
      }

      // Crear horarios laborales por defecto (9:00-13:00 y 14:00-18:00, lun-vie)
      const defaultHours = [];
      for (let day = 1; day <= 5; day++) {
        defaultHours.push(
          { professional_id: userId, day_of_week: day, start_time: "09:00", end_time: "13:00" },
          { professional_id: userId, day_of_week: day, start_time: "14:00", end_time: "18:00" }
        );
      }
      const { error: hoursError } = await admin.from("working_hours").insert(defaultHours);
      if (hoursError) {
        console.error("[Working hours warning]", hoursError);
      }
    }

    // 4. Si es consultorio (line=consultorio o role=admin), crear clínica + suscripción
    if (clinic_name && (line === "consultorio" || role === "admin")) {
      const plan = clinic_plan ?? "small";
      const cycle = clinic_billing_cycle ?? "monthly";

      // Precios en centavos para referencia interna
      const priceMap = {
        small: { monthly: 7900, annual: 85400 },
        large: { monthly: 14900, annual: 161000 },
      };

      const clinicSlug = clinic_name
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "");

      // Crear la clínica
      const { data: clinicData, error: clinicError } = await admin
        .from("clinics")
        .insert({
          name: clinic_name,
          slug: clinicSlug,
          owner_id: userId,
          line: "healthcare" as const, // Consultorios solo Healthcare
          max_professionals: plan === "small" ? 10 : null,
        })
        .select("id")
        .single();

      if (clinicError) {
        console.error("[Clinic error]", clinicError);
        await admin.from("profiles").delete().eq("id", userId);
        await admin.auth.admin.deleteUser(userId);
        return NextResponse.json(
          { error: "Error al crear el consultorio: " + clinicError.message },
          { status: 500 }
        );
      }

      // Crear suscripción del consultorio
      const { error: subError } = await admin.from("clinic_subscriptions").insert({
        clinic_id: clinicData.id,
        plan,
        billing_cycle: cycle,
        price_cents: priceMap[plan][cycle],
        status: "trialing",
        trial_ends_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        features_level: plan === "large" ? "premium" : "standard",
      });

      if (subError) {
        console.error("[Clinic subscription error]", subError);
        // No rollback de la clínica — se puede corregir manualmente
      }

      // Crear relación admin → clínica
      const { error: adminRelError } = await admin.from("clinic_members").insert({
        clinic_id: clinicData.id,
        user_id: userId,
        role: "owner",
      });

      if (adminRelError) {
        console.error("[Clinic member error]", adminRelError);
      }
    }

    return NextResponse.json(
      {
        message: "Usuario creado exitosamente",
        user: {
          id: userId,
          email,
          full_name,
          role,
          ...(role === "professional" && {
            line,
            specialty,
            subscription_plan: subscription_plan ?? "free",
          }),
          ...(role === "admin" && clinic_name && {
            clinic_name,
            clinic_plan: clinic_plan ?? "small",
            clinic_billing_cycle: clinic_billing_cycle ?? "monthly",
          }),
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("[POST users]", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
