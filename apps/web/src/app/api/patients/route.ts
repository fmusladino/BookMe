import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { z } from "zod";

export const dynamic = "force-dynamic";

// Helper: convierte "", null, undefined a undefined para que Zod lo trate como optional
const optionalString = z.preprocess(
  (val) => (val === "" || val === null ? undefined : val),
  z.string().optional()
);

const optionalEmail = z.preprocess(
  (val) => (val === "" || val === null ? undefined : val),
  z.string().email("Email inválido").optional()
);

const optionalUuid = z.preprocess(
  (val) => (val === "" || val === null ? undefined : val),
  z.string().uuid().optional()
);

const createPatientSchema = z.object({
  full_name: z.string().min(2, "Nombre requerido"),
  dni: z.string().min(6, "DNI inválido"),
  email: optionalEmail,
  phone: optionalString,
  insurance_id: optionalUuid,
  insurance_number: optionalString,
  is_particular: z.boolean().optional().default(true),
  birth_date: optionalString,
  notes: optionalString,
});

// GET /api/patients — Pacientes del profesional autenticado
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

    const { data, error } = await supabase
      .from("patients")
      .select("*")
      .eq("professional_id", user.id)
      .order("full_name", { ascending: true });

    if (error) {
      console.error("Error al obtener pacientes:", error);
      return NextResponse.json(
        { error: "Error al obtener pacientes" },
        { status: 500 }
      );
    }

    return NextResponse.json({ patients: data });
  } catch (error) {
    console.error("Error GET /api/patients:", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

// POST /api/patients — Crear paciente
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const body = (await request.json()) as unknown;
    const parsed = createPatientSchema.safeParse(body);

    if (!parsed.success) {
      const fieldErrors = parsed.error.flatten().fieldErrors;
      const firstError = Object.values(fieldErrors).flat()[0];
      console.error("[Patients] Validation error:", JSON.stringify(fieldErrors));
      return NextResponse.json(
        { error: firstError || "Datos inválidos", details: fieldErrors },
        { status: 400 }
      );
    }

    const { data, error } = await supabase
      .from("patients")
      .insert({
        professional_id: user.id,
        full_name: parsed.data.full_name,
        dni: parsed.data.dni,
        email: parsed.data.email ?? null,
        phone: parsed.data.phone ?? null,
        insurance_id: parsed.data.insurance_id ?? null,
        insurance_number: parsed.data.insurance_number ?? null,
        is_particular: parsed.data.is_particular,
        birth_date: parsed.data.birth_date ?? null,
        notes: parsed.data.notes ?? null,
      })
      .select()
      .single();

    if (error) {
      if (error.code === "23505") {
        return NextResponse.json(
          { error: "Ya existe un paciente con ese DNI" },
          { status: 409 }
        );
      }
      console.error("Error al crear paciente:", error);
      return NextResponse.json(
        { error: "Error al crear paciente" },
        { status: 500 }
      );
    }

    return NextResponse.json({ patient: data }, { status: 201 });
  } catch (error) {
    console.error("Error POST /api/patients:", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
