import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { z } from "zod";

const createServiceSchema = z.object({
  name: z.string().min(2, "Nombre requerido"),
  duration_minutes: z.number().min(5).max(480),
  price: z.number().min(0).optional().nullable(),
  show_price: z.boolean().optional(),
  modality: z.enum(["presencial", "virtual", "both"]).optional().default("presencial"),
  line: z.enum(["healthcare", "business"]).optional().default("healthcare"),
  insurance_ids: z.array(z.string().uuid()).optional(), // IDs de obras sociales que acepta
});

// GET /api/services — Servicios del profesional autenticado
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
      .from("services")
      .select("*, service_insurances(insurance_id, insurance:insurances(id, name, code))")
      .eq("professional_id", user.id)
      .order("name", { ascending: true });

    if (error) {
      console.error("Error al obtener servicios:", error);
      return NextResponse.json(
        { error: "Error al obtener servicios" },
        { status: 500 }
      );
    }

    return NextResponse.json({ services: data });
  } catch (error) {
    console.error("Error GET /api/services:", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

// POST /api/services — Crear servicio
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
    console.log("[services] body:", JSON.stringify(body));
    const parsed = createServiceSchema.safeParse(body);

    if (!parsed.success) {
      console.error("[services] Zod error:", JSON.stringify(parsed.error.flatten()));
      return NextResponse.json(
        { error: "Datos inválidos", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { insurance_ids, ...serviceData } = parsed.data;

    const { data, error } = await supabase
      .from("services")
      .insert({
        professional_id: user.id,
        ...serviceData,
      })
      .select()
      .single();

    if (error) {
      console.error("Error al crear servicio:", error);
      return NextResponse.json(
        { error: "Error al crear servicio", details: error.message },
        { status: 500 }
      );
    }

    // Guardar obras sociales asociadas
    if (insurance_ids && insurance_ids.length > 0) {
      const rows = insurance_ids.map((ins_id) => ({
        service_id: data.id,
        insurance_id: ins_id,
      }));
      const { error: insError } = await supabase
        .from("service_insurances")
        .insert(rows);
      if (insError) {
        console.error("Error al asociar obras sociales:", insError);
      }
    }

    // Re-fetch con insurances
    const { data: full } = await supabase
      .from("services")
      .select("*, service_insurances(insurance_id, insurance:insurances(id, name, code))")
      .eq("id", data.id)
      .single();

    return NextResponse.json({ service: full || data }, { status: 201 });
  } catch (error) {
    console.error("Error POST /api/services:", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
