import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { z } from "zod";

const createPrestacionSchema = z.object({
  insurance_id: z.string().uuid("Obra social inválida"),
  code: z.string().min(1, "Código requerido"),
  description: z.string().min(2, "Descripción requerida"),
  amount: z.number().min(0, "El valor debe ser positivo"),
  valid_from: z.string().optional(), // ISO date string
  valid_until: z.string().optional().nullable(),
});

// GET /api/prestaciones — Prestaciones del profesional autenticado
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const activeOnly = searchParams.get("active") === "true";
    const insuranceId = searchParams.get("insurance_id");

    let query = supabase
      .from("prestaciones")
      .select("*, insurance:insurances(id, name, code, logo_url)")
      .eq("professional_id", user.id)
      .order("description", { ascending: true });

    if (activeOnly) {
      query = query.eq("is_active", true);
    }
    if (insuranceId) {
      query = query.eq("insurance_id", insuranceId);
    }

    const { data, error } = await query;

    if (error) {
      console.error("Error al obtener prestaciones:", error);
      return NextResponse.json(
        { error: "Error al obtener prestaciones" },
        { status: 500 }
      );
    }

    return NextResponse.json({ prestaciones: data });
  } catch (error) {
    console.error("Error GET /api/prestaciones:", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

// POST /api/prestaciones — Crear prestación
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

    // Verificar que es profesional healthcare
    const { data: prof } = await supabase
      .from("professionals")
      .select("line")
      .eq("id", user.id)
      .single();

    if (!prof || prof.line !== "healthcare") {
      return NextResponse.json(
        { error: "Solo profesionales de salud pueden cargar prestaciones" },
        { status: 403 }
      );
    }

    const body = (await request.json()) as unknown;
    const parsed = createPrestacionSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Datos inválidos", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { data, error } = await supabase
      .from("prestaciones")
      .insert({
        professional_id: user.id,
        insurance_id: parsed.data.insurance_id,
        code: parsed.data.code,
        description: parsed.data.description,
        amount: parsed.data.amount,
        valid_from: parsed.data.valid_from || new Date().toISOString().split("T")[0],
        valid_until: parsed.data.valid_until || null,
      })
      .select("*, insurance:insurances(id, name, code, logo_url)")
      .single();

    if (error) {
      console.error("Error al crear prestación:", error);
      return NextResponse.json(
        { error: "Error al crear prestación", details: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ prestacion: data }, { status: 201 });
  } catch (error) {
    console.error("Error POST /api/prestaciones:", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
