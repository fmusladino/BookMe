import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { z } from "zod";

const courtSchema = z.object({
  name: z.string().min(1, "El nombre es requerido"),
  description: z.string().optional(),
  sport: z.string().min(1, "El deporte es requerido"),
  surface: z.string().optional(),
  players: z.number().int().positive().optional(),
  price_per_hour: z.number().min(0).default(0),
  slot_duration: z.number().int().min(15).max(480).default(60),
  seña_required: z.boolean().default(false),
  seña_amount: z.number().min(0).optional(),
  seña_alias: z.string().optional(),
  seña_cbu: z.string().optional(),
  is_active: z.boolean().default(true),
  // Horarios: array de {day_of_week, start_time, end_time}
  schedules: z.array(z.object({
    day_of_week: z.number().int().min(0).max(6),
    start_time: z.string(),
    end_time: z.string(),
  })).optional(),
});

/**
 * GET /api/courts — Lista todas las canchas del dueño autenticado
 */
export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

    const { data: courts, error } = await supabase
      .from("courts")
      .select(`
        *,
        court_schedules (*)
      `)
      .eq("owner_id", user.id)
      .order("created_at", { ascending: true });

    if (error) throw error;

    return NextResponse.json({ courts: courts ?? [] });
  } catch (error) {
    console.error("GET /api/courts:", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

/**
 * POST /api/courts — Crea una nueva cancha
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

    // Verificar que es dueño de canchas
    const { data: courtOwner } = await supabase
      .from("court_owners")
      .select("id")
      .eq("id", user.id)
      .maybeSingle();

    if (!courtOwner) {
      return NextResponse.json({ error: "Solo los dueños de canchas pueden crear canchas" }, { status: 403 });
    }

    const body = (await request.json()) as unknown;
    const parsed = courtSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Datos inválidos", details: parsed.error.flatten() }, { status: 400 });
    }

    const { schedules, ...courtData } = parsed.data;

    // Crear cancha
    const { data: court, error: courtError } = await supabase
      .from("courts")
      .insert({
        ...courtData,
        owner_id: user.id,
      })
      .select()
      .single();

    if (courtError) throw courtError;

    // Crear horarios si se enviaron
    if (schedules && schedules.length > 0 && court) {
      const { error: scheduleError } = await supabase
        .from("court_schedules")
        .insert(
          schedules.map((s) => ({
            court_id: court.id,
            day_of_week: s.day_of_week,
            start_time: s.start_time,
            end_time: s.end_time,
          }))
        );

      if (scheduleError) {
        console.error("Error creating schedules:", scheduleError);
      }
    }

    return NextResponse.json({ court }, { status: 201 });
  } catch (error) {
    console.error("POST /api/courts:", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
