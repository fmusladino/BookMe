import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { z } from "zod";

const createServiceSchema = z.object({
  name: z.string().min(2, "Nombre requerido"),
  duration_minutes: z.number().min(5).max(480),
  price: z.number().min(0).optional(),
  show_price: z.boolean().optional(),
  line: z.enum(["healthcare", "business"]),
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
      .select("*")
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
    const parsed = createServiceSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Datos inválidos", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { data, error } = await supabase
      .from("services")
      .insert({
        professional_id: user.id,
        ...parsed.data,
      })
      .select()
      .single();

    if (error) {
      console.error("Error al crear servicio:", error);
      return NextResponse.json(
        { error: "Error al crear servicio" },
        { status: 500 }
      );
    }

    return NextResponse.json({ service: data }, { status: 201 });
  } catch (error) {
    console.error("Error POST /api/services:", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
