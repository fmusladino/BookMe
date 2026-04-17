import { NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";

// Forzar que esta ruta sea siempre dinámica (sin cache)
export const dynamic = "force-dynamic";

/**
 * GET /api/auth/me — Devuelve datos de sesión del usuario actual.
 * Incluye rol, datos profesionales Y estado de suscripción en una sola llamada.
 * Esto evita que el SubscriptionBanner haga un fetch separado.
 */
export async function GET() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const admin = createAdminClient();

    // Obtener perfil, datos profesionales, court_owner y si es owner/admin de clínica en paralelo
    const [profileResult, proResult, courtOwnerResult, clinicOwnerResult, clinicAdminResult] = await Promise.all([
      supabase
        .from("profiles")
        .select("id, role, full_name, avatar_url")
        .eq("id", user.id)
        .single(),
      supabase
        .from("professionals")
        .select("line, specialty, subscription_plan, subscription_status, trial_ends_at, subscription_expires_at, cancelled_at, cancellation_reason, public_slug")
        .eq("id", user.id)
        .maybeSingle(),
      // Datos de dueño de canchas
      supabase
        .from("court_owners")
        .select("id, business_name, slug, city, subscription_plan, subscription_status, trial_ends_at")
        .eq("id", user.id)
        .maybeSingle(),
      // ¿Es owner de alguna clínica?
      admin
        .from("clinics")
        .select("id, name")
        .eq("owner_id", user.id)
        .maybeSingle(),
      // ¿Es admin de alguna clínica?
      admin
        .from("clinic_admins")
        .select("clinic_id")
        .eq("profile_id", user.id)
        .limit(1)
        .maybeSingle(),
    ]);

    const { data: profile, error: profileError } = profileResult;

    if (profileError || !profile) {
      return NextResponse.json({ error: "Perfil no encontrado" }, { status: 404 });
    }

    const professional = profile.role === "professional" ? proResult.data : null;
    const courtOwner = profile.role === "canchas" ? courtOwnerResult.data : null;

    // Calcular días hasta fin del trial
    let subscription = null;
    const subscriptionSource = professional ?? courtOwner;
    if (subscriptionSource) {
      let daysUntilTrialEnd: number | null = null;
      if (subscriptionSource.trial_ends_at) {
        const now = new Date();
        const trialEnd = new Date(subscriptionSource.trial_ends_at);
        const diffMs = trialEnd.getTime() - now.getTime();
        daysUntilTrialEnd = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
      }

      subscription = {
        plan: subscriptionSource.subscription_plan || "free",
        status: subscriptionSource.subscription_status || "trialing",
        trialEndsAt: subscriptionSource.trial_ends_at,
        daysUntilTrialEnd,
        subscriptionExpiresAt: (subscriptionSource as { subscription_expires_at?: string | null }).subscription_expires_at ?? null,
        cancelledAt: (subscriptionSource as { cancelled_at?: string | null }).cancelled_at ?? null,
        cancellationReason: (subscriptionSource as { cancellation_reason?: string | null }).cancellation_reason ?? null,
      };
    }

    // Determinar si tiene acceso a panel de clínica
    const isClinicOwner = !!clinicOwnerResult.data;
    const isClinicAdmin = !!clinicAdminResult.data;

    return NextResponse.json({
      user: {
        id: profile.id,
        email: user.email,
        role: profile.role,
        full_name: profile.full_name,
        avatar_url: profile.avatar_url,
        professional: professional
          ? {
              line: professional.line,
              specialty: professional.specialty,
              plan: professional.subscription_plan,
              status: professional.subscription_status,
              slug: professional.public_slug,
            }
          : null,
        // Datos del dueño de canchas
        court_owner: courtOwner
          ? {
              business_name: courtOwner.business_name,
              slug: courtOwner.slug,
              city: courtOwner.city,
              plan: courtOwner.subscription_plan,
              status: courtOwner.subscription_status,
            }
          : null,
        // Datos de suscripción incluidos directamente
        subscription,
        // Acceso a panel de clínica
        is_clinic_owner: isClinicOwner,
        is_clinic_admin: isClinicAdmin,
        clinic_id: clinicOwnerResult.data?.id ?? null,
      },
    });
  } catch (error) {
    console.error("Error GET /api/auth/me:", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
