import { NextRequest, NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";

// Helper: obtener clinic_id y branch_ids del admin
async function getAdminClinicContext(userId: string) {
  const admin = createAdminClient();

  const { data: ownedClinics } = await admin
    .from("clinics")
    .select("id")
    .eq("owner_id", userId);

  const { data: adminOf } = await admin
    .from("clinic_admins")
    .select("clinic_id")
    .eq("profile_id", userId);

  const clinicIds = new Set<string>();
  ownedClinics?.forEach((c) => clinicIds.add(c.id));
  adminOf?.forEach((a) => clinicIds.add(a.clinic_id));

  if (clinicIds.size === 0) return null;

  const clinicId = [...clinicIds][0]!;

  const { data: clinicBranches } = await admin
    .from("clinic_branches")
    .select("id")
    .eq("clinic_id", clinicId);

  const branchIds = (clinicBranches ?? []).map((b) => b.id);

  return { clinicId, branchIds, admin };
}

// Helper: obtener profesionales de la clínica
async function getClinicProfessionals(
  admin: ReturnType<typeof createAdminClient>,
  clinicId: string,
  branchIds: string[]
) {
  const { data: profs } = await admin
    .from("professionals")
    .select("id, specialty, branch_id, profile:profiles(full_name)")
    .or(
      branchIds.length > 0
        ? `clinic_id.eq.${clinicId},branch_id.in.(${branchIds.join(",")})`
        : `clinic_id.eq.${clinicId}`
    );

  return profs ?? [];
}

/**
 * GET /api/clinic/appointments?date=2026-04-04&professional_id=xxx
 */
export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

    const ctx = await getAdminClinicContext(user.id);
    if (!ctx) return NextResponse.json({ appointments: [], professionals: [] });

    const { clinicId, branchIds, admin } = ctx;

    const dateParam = req.nextUrl.searchParams.get("date");
    const professionalIdParam = req.nextUrl.searchParams.get("professional_id");
    const date = dateParam ?? new Date().toISOString().split("T")[0]!;

    const profs = await getClinicProfessionals(admin, clinicId, branchIds);
    const profIds = profs.map((p) => p.id);

    if (profIds.length === 0) {
      return NextResponse.json({ appointments: [], professionals: [] });
    }

    const filterProfIds = professionalIdParam
      ? [professionalIdParam].filter((id) => profIds.includes(id))
      : profIds;

    const startOfDay = `${date}T00:00:00.000Z`;
    const endOfDay = `${date}T23:59:59.999Z`;

    const { data: appointments, error } = await admin
      .from("appointments")
      .select(
        `id, starts_at, ends_at, status, notes, professional_id,
         patient:patients(full_name, phone),
         service:services(name)`
      )
      .in("professional_id", filterProfIds)
      .gte("starts_at", startOfDay)
      .lte("starts_at", endOfDay)
      .order("starts_at", { ascending: true });

    if (error) {
      console.error("[Clinic Appointments GET]", error);
      return NextResponse.json({ error: "Error al cargar turnos: " + error.message }, { status: 500 });
    }

    // Mapa de profesionales
    const profMap = new Map<string, { specialty: string; full_name: string }>();
    profs.forEach((p) => {
      const profile = Array.isArray(p.profile) ? p.profile[0] : p.profile;
      profMap.set(p.id, {
        specialty: p.specialty,
        full_name: profile?.full_name ?? "Profesional",
      });
    });

    const enriched = (appointments ?? []).map((apt) => {
      const prof = profMap.get(apt.professional_id);
      return {
        ...apt,
        patient: Array.isArray(apt.patient) ? apt.patient[0] : apt.patient,
        service: Array.isArray(apt.service) ? apt.service[0] : apt.service,
        professional: prof
          ? { id: apt.professional_id, specialty: prof.specialty, profile: { full_name: prof.full_name } }
          : null,
      };
    });

    const profList = profs.map((p) => {
      const profile = Array.isArray(p.profile) ? p.profile[0] : p.profile;
      return { id: p.id, full_name: profile?.full_name ?? "Profesional", specialty: p.specialty };
    });

    return NextResponse.json({ appointments: enriched, professionals: profList });
  } catch (err) {
    console.error("[Clinic Appointments GET]", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

/**
 * POST /api/clinic/appointments
 * Crea un turno para un profesional de la clínica.
 * Body: { professional_id, patient_name, patient_dni, patient_phone, patient_email?,
 *         date, start_time, end_time, service_id?, notes? }
 */
export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

    const ctx = await getAdminClinicContext(user.id);
    if (!ctx) return NextResponse.json({ error: "No tenés consultorio" }, { status: 403 });

    const { clinicId, branchIds, admin } = ctx;
    const body = (await req.json()) as Record<string, unknown>;

    // Validar campos
    const professional_id = body.professional_id as string;
    const patient_name = body.patient_name as string;
    const patient_dni = body.patient_dni as string;
    const patient_phone = (body.patient_phone as string) || null;
    const patient_email = (body.patient_email as string) || null;
    const date = body.date as string;
    const start_time = body.start_time as string;
    const end_time = body.end_time as string;
    const service_id = (body.service_id as string) || null;
    const notes = (body.notes as string) || null;

    if (!professional_id || !patient_name || !patient_dni || !date || !start_time || !end_time) {
      return NextResponse.json(
        { error: "Faltan campos obligatorios: profesional, paciente (nombre y DNI), fecha y horario" },
        { status: 400 }
      );
    }

    // Verificar que el profesional pertenezca a la clínica
    const profs = await getClinicProfessionals(admin, clinicId, branchIds);
    const profIds = profs.map((p) => p.id);
    if (!profIds.includes(professional_id)) {
      return NextResponse.json({ error: "El profesional no pertenece a este consultorio" }, { status: 403 });
    }

    // Buscar o crear paciente para este profesional
    const { data: existingPatient } = await admin
      .from("patients")
      .select("id")
      .eq("professional_id", professional_id)
      .eq("dni", patient_dni)
      .single();

    let patientId: string;

    if (existingPatient) {
      patientId = existingPatient.id;
      // Actualizar datos del paciente si cambiaron
      await admin
        .from("patients")
        .update({
          full_name: patient_name,
          phone: patient_phone,
          email: patient_email,
        })
        .eq("id", patientId);
    } else {
      const { data: newPatient, error: patErr } = await admin
        .from("patients")
        .insert({
          professional_id,
          dni: patient_dni,
          full_name: patient_name,
          phone: patient_phone,
          email: patient_email,
          is_particular: true,
        })
        .select("id")
        .single();

      if (patErr || !newPatient) {
        console.error("[Clinic Apt POST] Patient error:", patErr);
        return NextResponse.json({ error: "Error al crear paciente" }, { status: 500 });
      }
      patientId = newPatient.id;
    }

    // Crear turno
    const starts_at = `${date}T${start_time}:00.000Z`;
    const ends_at = `${date}T${end_time}:00.000Z`;

    const { data: appointment, error: aptErr } = await admin
      .from("appointments")
      .insert({
        professional_id,
        patient_id: patientId,
        service_id: service_id || null,
        starts_at,
        ends_at,
        status: "confirmed",
        booked_by: user.id,
        notes,
      })
      .select("id, starts_at, ends_at, status")
      .single();

    if (aptErr) {
      console.error("[Clinic Apt POST] Appointment error:", aptErr);
      return NextResponse.json({ error: "Error al crear turno: " + aptErr.message }, { status: 500 });
    }

    return NextResponse.json(
      { message: "Turno creado", appointment },
      { status: 201 }
    );
  } catch (err) {
    console.error("[Clinic Apt POST]", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
