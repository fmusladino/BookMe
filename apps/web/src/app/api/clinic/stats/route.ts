import { NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";

/**
 * GET /api/clinic/stats
 * Retorna estadísticas de la clínica del admin autenticado.
 */
export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  // Buscar la clínica del admin
  const { data: adminOf } = await supabase
    .from("clinic_admins")
    .select("clinic_id")
    .eq("profile_id", user.id);

  const { data: ownedClinics } = await supabase
    .from("clinics")
    .select("id")
    .eq("owner_id", user.id);

  const clinicIds = new Set<string>();
  adminOf?.forEach((a) => clinicIds.add(a.clinic_id));
  ownedClinics?.forEach((c) => clinicIds.add(c.id));

  if (clinicIds.size === 0) {
    return NextResponse.json({
      professionals_count: 0,
      today_appointments: 0,
      total_patients: 0,
      month_appointments: 0,
      cancelled_month: 0,
    });
  }

  const clinicId = [...clinicIds][0]!;

  // Usar admin client para bypasear RLS
  const admin = createAdminClient();

  // Profesionales de la clínica
  const { count: profCount } = await admin
    .from("professionals")
    .select("id", { count: "exact", head: true })
    .eq("clinic_id", clinicId);

  // IDs de profesionales para filtrar turnos
  const { data: profIds } = await admin
    .from("professionals")
    .select("id")
    .eq("clinic_id", clinicId);

  const ids = profIds?.map((p) => p.id) ?? [];

  const today = new Date();
  const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate()).toISOString();
  const endOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1).toISOString();
  const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1).toISOString();

  let todayAppointments = 0;
  let monthAppointments = 0;
  let cancelledMonth = 0;
  let totalPatients = 0;

  if (ids.length > 0) {
    // Turnos de hoy
    const { count: todayCount } = await admin
      .from("appointments")
      .select("id", { count: "exact", head: true })
      .in("professional_id", ids)
      .gte("starts_at", startOfDay)
      .lt("starts_at", endOfDay)
      .neq("status", "cancelled");
    todayAppointments = todayCount ?? 0;

    // Turnos del mes
    const { count: monthCount } = await admin
      .from("appointments")
      .select("id", { count: "exact", head: true })
      .in("professional_id", ids)
      .gte("starts_at", startOfMonth)
      .neq("status", "cancelled");
    monthAppointments = monthCount ?? 0;

    // Cancelados del mes
    const { count: cancelCount } = await admin
      .from("appointments")
      .select("id", { count: "exact", head: true })
      .in("professional_id", ids)
      .gte("starts_at", startOfMonth)
      .eq("status", "cancelled");
    cancelledMonth = cancelCount ?? 0;

    // Pacientes totales (distintos)
    const { data: patientData } = await admin
      .from("patients")
      .select("id", { count: "exact", head: true })
      .in("professional_id", ids);
    totalPatients = (patientData as unknown as { count: number })?.count ?? 0;

    // Alternativa: contar pacientes con count
    const { count: patientCount } = await admin
      .from("patients")
      .select("id", { count: "exact", head: true })
      .in("professional_id", ids);
    totalPatients = patientCount ?? 0;
  }

  return NextResponse.json({
    professionals_count: profCount ?? 0,
    today_appointments: todayAppointments,
    total_patients: totalPatients,
    month_appointments: monthAppointments,
    cancelled_month: cancelledMonth,
  });
}
