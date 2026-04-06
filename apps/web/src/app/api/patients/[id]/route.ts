import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { z } from "zod";

export const dynamic = "force-dynamic";

const updatePatientSchema = z.object({
  full_name: z.string().min(2).optional(),
  dni: z.string().min(6).optional(),
  email: z.string().email().nullable().optional(),
  phone: z.string().nullable().optional(),
  birth_date: z.string().nullable().optional(),
  insurance_id: z.string().uuid().nullable().optional(),
  insurance_number: z.string().nullable().optional(),
  is_particular: z.boolean().optional(),
  notes: z.string().max(1000).nullable().optional(),
});

// GET /api/patients/[id]
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const { data, error } = await supabase
      .from("patients")
      .select("*")
      .eq("id", id)
      .eq("professional_id", user.id)
      .single();

    if (error || !data) {
      return NextResponse.json({ error: "Paciente no encontrado" }, { status: 404 });
    }

    return NextResponse.json({ patient: data });
  } catch (error) {
    console.error("Error GET /api/patients/[id]:", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

// PATCH /api/patients/[id]
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    // Verificar que el paciente pertenece al profesional
    const { data: existing } = await supabase
      .from("patients")
      .select("id")
      .eq("id", id)
      .eq("professional_id", user.id)
      .single();

    if (!existing) {
      return NextResponse.json({ error: "Paciente no encontrado" }, { status: 404 });
    }

    const body = (await request.json()) as unknown;
    const parsed = updatePatientSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Datos inválidos", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { data, error } = await supabase
      .from("patients")
      .update(parsed.data)
      .eq("id", id)
      .eq("professional_id", user.id)
      .select()
      .single();

    if (error) {
      if (error.code === "23505") {
        return NextResponse.json(
          { error: "Ya existe un paciente con ese DNI" },
          { status: 409 }
        );
      }
      console.error("Error al actualizar paciente:", error);
      return NextResponse.json({ error: "Error al actualizar" }, { status: 500 });
    }

    return NextResponse.json({ patient: data });
  } catch (error) {
    console.error("Error PATCH /api/patients/[id]:", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

// DELETE /api/patients/[id]
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const { error } = await supabase
      .from("patients")
      .delete()
      .eq("id", id)
      .eq("professional_id", user.id);

    if (error) {
      // FK constraint — el paciente tiene turnos asociados
      if (error.code === "23503") {
        return NextResponse.json(
          { error: "No se puede eliminar: el paciente tiene turnos asociados" },
          { status: 409 }
        );
      }
      console.error("Error al eliminar paciente:", error);
      return NextResponse.json({ error: "Error al eliminar" }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error DELETE /api/patients/[id]:", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
