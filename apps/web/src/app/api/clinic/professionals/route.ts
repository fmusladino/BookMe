import { NextRequest, NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";

// ─── Helper: obtener clinic_id del usuario actual ─────────────────────
async function getClinicId(supabase: Awaited<ReturnType<typeof createClient>>, userId: string): Promise<string | null> {
  const { data: adminOf } = await supabase
    .from("clinic_admins")
    .select("clinic_id")
    .eq("profile_id", userId);

  const { data: ownedClinics } = await supabase
    .from("clinics")
    .select("id")
    .eq("owner_id", userId);

  const clinicIds = new Set<string>();
  adminOf?.forEach((a: { clinic_id: string }) => clinicIds.add(a.clinic_id));
  ownedClinics?.forEach((c: { id: string }) => clinicIds.add(c.id));

  return clinicIds.size > 0 ? [...clinicIds][0]! : null;
}

/**
 * GET /api/clinic/professionals
 * Retorna los profesionales de la clínica del admin autenticado.
 */
export async function GET() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    const admin = createAdminClient();

    // Buscar clínicas del usuario (admin client para evitar RLS)
    const { data: ownedClinics } = await admin
      .from("clinics")
      .select("id")
      .eq("owner_id", user.id);

    const { data: adminOf } = await admin
      .from("clinic_admins")
      .select("clinic_id")
      .eq("profile_id", user.id);

    const clinicIds = new Set<string>();
    ownedClinics?.forEach((c) => clinicIds.add(c.id));
    adminOf?.forEach((a) => clinicIds.add(a.clinic_id));

    if (clinicIds.size === 0) {
      return NextResponse.json({ professionals: [], clinic: null });
    }

    const clinicId = [...clinicIds][0]!;

    // Obtener datos de la clínica
    const { data: clinic } = await admin
      .from("clinics")
      .select("id, name, slug, address, city, province, phone, email, logo_url")
      .eq("id", clinicId)
      .single();

    // Obtener las sedes de esta clínica para buscar profesionales por branch_id
    const { data: clinicBranches } = await admin
      .from("clinic_branches")
      .select("id")
      .eq("clinic_id", clinicId);

    const branchIds = (clinicBranches ?? []).map((b) => b.id);

    // Buscar profesionales que pertenecen a la clínica por clinic_id O por branch_id
    const { data: professionals, error } = await admin
      .from("professionals")
      .select(
        `id, specialty, specialty_slug, city, province, is_visible,
         subscription_plan, subscription_status, created_at, branch_id,
         profile:profiles(full_name, avatar_url, phone),
         branch:clinic_branches(id, name, address, city)`
      )
      .or(
        branchIds.length > 0
          ? `clinic_id.eq.${clinicId},branch_id.in.(${branchIds.join(",")})`
          : `clinic_id.eq.${clinicId}`
      )
      .order("created_at", { ascending: true });

    if (error) {
      console.error("[Clinic Professionals GET] Error:", error);
      return NextResponse.json(
        { error: "Error al cargar profesionales: " + error.message },
        { status: 500 }
      );
    }

    // Obtener info de suscripción para mostrar contador
    const { data: subscription } = await admin
      .from("clinic_subscriptions")
      .select("plan, max_professionals, status")
      .eq("clinic_id", clinicId)
      .single();

    const totalProfessionals = (professionals ?? []).length;
    const maxProfessionals = subscription?.max_professionals ?? (subscription?.plan === "small" ? 10 : null);
    const remainingSlots = maxProfessionals !== null ? maxProfessionals - totalProfessionals : null;

    return NextResponse.json({
      clinic,
      professionals: professionals ?? [],
      subscription: subscription ? {
        plan: subscription.plan,
        status: subscription.status,
        max_professionals: maxProfessionals,
        current_count: totalProfessionals,
        remaining: remainingSlots,
        limit_reached: maxProfessionals !== null && totalProfessionals >= maxProfessionals,
      } : null,
    });
  } catch (err) {
    console.error("[Clinic Professionals GET] Unexpected error:", err);
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/clinic/professionals
 * Da de alta un nuevo profesional y lo asocia a la clínica del admin.
 */
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  const clinicId = await getClinicId(supabase, user.id);

  if (!clinicId) {
    return NextResponse.json(
      { error: "No tenés un consultorio asociado" },
      { status: 403 }
    );
  }

  try {
    // ─── Verificar límite de profesionales del plan ───────────
    const adminClient = createAdminClient();

    const { data: subscription } = await adminClient
      .from("clinic_subscriptions")
      .select("plan, max_professionals, status")
      .eq("clinic_id", clinicId)
      .single();

    if (subscription) {
      const { count: currentCount } = await adminClient
        .from("professionals")
        .select("id", { count: "exact", head: true })
        .eq("clinic_id", clinicId);

      const maxAllowed = subscription.max_professionals ?? (subscription.plan === "small" ? 10 : null);

      if (maxAllowed !== null && (currentCount ?? 0) >= maxAllowed) {
        return NextResponse.json(
          {
            error: `Alcanzaste el límite de ${maxAllowed} profesionales de tu plan ${subscription.plan === "small" ? "Pequeño" : "Grande"}. Actualizá tu plan para agregar más.`,
            code: "LIMIT_REACHED",
            current: currentCount,
            max: maxAllowed,
          },
          { status: 403 }
        );
      }
    }

    const body = (await request.json()) as Record<string, unknown>;

    // Validación básica
    const email = body.email as string;
    const password = body.password as string;
    const full_name = body.full_name as string;
    const dni = body.dni as string;
    const phone = body.phone as string;
    const line = body.line as string;
    const specialty = body.specialty as string;
    const city = body.city as string;
    const province = body.province as string;
    const bio = (body.bio as string) || null;
    const branch_id = (body.branch_id as string) || null;

    if (!email || !password || !full_name || !dni || !phone || !line || !specialty || !city || !province) {
      return NextResponse.json(
        { error: "Faltan campos obligatorios" },
        { status: 400 }
      );
    }

    if (password.length < 6) {
      return NextResponse.json(
        { error: "La contraseña debe tener al menos 6 caracteres" },
        { status: 400 }
      );
    }

    if (!["healthcare", "business"].includes(line)) {
      return NextResponse.json(
        { error: "Línea de negocio inválida" },
        { status: 400 }
      );
    }

    // Generar specialty_slug y public_slug
    const specialty_slug = specialty
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");

    const name_slug = full_name
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");

    const public_slug = `${name_slug}-${Date.now().toString(36)}`;

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
      console.error("[Clinic Prof POST] Auth error:", authError);
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
      console.error("[Clinic Prof POST] Profile error:", profileError);
      await admin.auth.admin.deleteUser(userId);
      return NextResponse.json(
        { error: "Error al crear el perfil" },
        { status: 500 }
      );
    }

    // 3. Crear registro de profesional con clinic_id
    const { error: profError } = await admin.from("professionals").insert({
      id: userId,
      clinic_id: clinicId,
      branch_id,
      line,
      specialty,
      specialty_slug,
      city,
      province,
      country: "AR",
      bio,
      public_slug,
      is_visible: true,
      subscription_plan: "free",
      subscription_status: "trialing",
      trial_ends_at: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
    });

    if (profError) {
      console.error("[Clinic Prof POST] Professional error:", profError);
      await admin.auth.admin.deleteUser(userId);
      return NextResponse.json(
        { error: "Error al crear el registro de profesional" },
        { status: 500 }
      );
    }

    // 4. Crear configuración de agenda por defecto
    await admin
      .from("schedule_configs")
      .insert({
        professional_id: userId,
        working_days: [1, 2, 3, 4, 5],
        slot_duration: 30,
        lunch_break_start: "12:00",
        lunch_break_end: "13:00",
        vacation_mode: false,
      })
      .then(({ error }) => {
        if (error) console.error("[Schedule config]", error);
      });

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

    await admin
      .from("working_hours")
      .insert(defaultHours)
      .then(({ error }) => {
        if (error) console.error("[Working hours]", error);
      });

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
          province,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("[Clinic Prof POST]", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
