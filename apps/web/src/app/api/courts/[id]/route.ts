import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { z } from "zod";

const updateSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional(),
  sport: z.string().optional(),
  surface: z.string().optional(),
  players: z.number().int().positive().optional(),
  price_per_hour: z.number().min(0).optional(),
  slot_duration: z.number().int().min(15).max(480).optional(),
  seña_required: z.boolean().optional(),
  seña_amount: z.number().min(0).optional(),
  seña_alias: z.string().optional(),
  seña_cbu: z.string().optional(),
  is_active: z.boolean().optional(),
  schedules: z.array(z.object({
    day_of_week: z.number().int().min(0).max(6),
    start_time: z.string(),
    end_time: z.string(),
  })).optional(),
});

/**
 * PATCH /api/courts/[id] — Actualiza una cancha
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

    const body = (await request.json()) as unknown;
    const parsed = updateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Datos inválidos", details: parsed.error.flatten() }, { status: 400 });
    }

    const { schedules, ...courtData } = parsed.data;

    // Actualizar cancha (RLS asegura que solo el dueño puede hacerlo)
    const { data: court, error } = await supabase
      .from("courts")
      .update(courtData)
      .eq("id", id)
      .eq("owner_id", user.id)
      .select()
      .single();

    if (error) throw error;

    // Reemplazar horarios si se enviaron
    if (schedules !== undefined && court) {
      await supabase.from("court_schedules").delete().eq("court_id", id);

      if (schedules.length > 0) {
        await supabase.from("court_schedules").insert(
          schedules.map((s) => ({
            court_id: id,
            day_of_week: s.day_of_week,
            start_time: s.start_time,
            end_time: s.end_time,
          }))
        );
      }
    }

    return NextResponse.json({ court });
  } catch (error) {
    console.error("PATCH /api/courts/[id]:", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

/**
 * DELETE /api/courts/[id] — Elimina una cancha
 */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

    const { error } = await supabase
      .from("courts")
      .delete()
      .eq("id", id)
      .eq("owner_id", user.id);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("DELETE /api/courts/[id]:", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
