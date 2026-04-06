import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { verifyAdminAuth } from "../_lib/auth";

// ─── GET /api/admin/patients ──────────────────────────────────────────

/**
 * Lista todos los pacientes con información de perfil y profesional vinculado.
 * Query params:
 *   - search: busca por full_name, email, dni o phone
 *   - professional_id: filtra por profesional específico
 */
export async function GET(request: NextRequest) {
  const authResult = await verifyAdminAuth("superadmin");
  if ("error" in authResult) return authResult.error;

  try {
    const supabase = await createClient();
    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search");
    const professionalId = searchParams.get("professional_id");

    let query = supabase
      .from("patients")
      .select(
        `
        id,
        dni,
        full_name,
        email,
        phone,
        birth_date,
        is_particular,
        notes,
        created_at,
        professional_id,
        insurance_id,
        insurance_number,
        insurance:insurance_id (
          id,
          name
        ),
        professional:professional_id (
          id,
          specialty,
          city
        ),
        profile:profile_id (
          id
        )
      `,
        { count: "exact" }
      );

    // Filtrar por profesional si se especifica
    if (professionalId) {
      query = query.eq("professional_id", professionalId);
    }

    const { data, error, count } = await query;

    if (error) {
      console.error("[GET patients error]", error);
      return NextResponse.json(
        { error: "Error al obtener pacientes" },
        { status: 500 }
      );
    }

    // Filtrado en memoria por search si es necesario
    let filtered = data || [];
    if (search) {
      const searchLower = search.toLowerCase();
      filtered = filtered.filter((p: any) => {
        const fullName = (p.full_name || "").toLowerCase();
        const email = (p.email || "").toLowerCase();
        const dni = (p.dni || "").toLowerCase();
        const phone = (p.phone || "").toLowerCase();

        return (
          fullName.includes(searchLower) ||
          email.includes(searchLower) ||
          dni.includes(searchLower) ||
          phone.includes(searchLower)
        );
      });
    }

    // Transformar respuesta para incluir info del profesional en el top level
    const formattedPatients = filtered.map((p: any) => ({
      id: p.id,
      dni: p.dni,
      full_name: p.full_name,
      email: p.email,
      phone: p.phone,
      birth_date: p.birth_date,
      is_particular: p.is_particular,
      notes: p.notes,
      created_at: p.created_at,
      professional_id: p.professional_id,
      professional_name: p.professional?.specialty || "N/A",
      professional_city: p.professional?.city,
      insurance: p.insurance
        ? {
            id: p.insurance.id,
            name: p.insurance.name,
          }
        : null,
      insurance_number: p.insurance_number,
      has_profile: !!p.profile?.id,
    }));

    return NextResponse.json({
      patients: formattedPatients,
      total: count,
    });
  } catch (error) {
    console.error("[GET patients]", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
