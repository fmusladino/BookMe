import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

// GET /api/schedule/config — obtener configuración de agenda del profesional
export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    const { data: config } = await supabase
      .from("schedule_configs")
      .select("*")
      .eq("professional_id", user.id)
      .single();

    const { data: workingHours } = await supabase
      .from("working_hours")
      .select("*")
      .eq("professional_id", user.id)
      .order("day_of_week", { ascending: true });

    return NextResponse.json({
      config: config ?? null,
      workingHours: workingHours ?? [],
    });
  } catch (error) {
    console.error("Error al obtener configuración de agenda:", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

// PUT /api/schedule/config — actualizar configuración de agenda
export async function PUT(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    const body = await request.json() as {
      workingDays: number[];
      slotDuration: number;
      lunchBreakStart: string | null;
      lunchBreakEnd: string | null;
      vacationMode: boolean;
      vacationUntil: string | null;
    };

    // Upsert: crear o actualizar config
    const { data: config, error } = await supabase
      .from("schedule_configs")
      .upsert(
        {
          professional_id: user.id,
          working_days: body.workingDays,
          slot_duration: body.slotDuration,
          lunch_break_start: body.lunchBreakStart,
          lunch_break_end: body.lunchBreakEnd,
          vacation_mode: body.vacationMode,
          vacation_until: body.vacationUntil,
        },
        { onConflict: "professional_id" }
      )
      .select()
      .single();

    if (error) {
      console.error("Error al guardar configuración:", error);
      return NextResponse.json({ error: "Error al guardar configuración" }, { status: 500 });
    }

    return NextResponse.json({ config });
  } catch (error) {
    console.error("Error al actualizar configuración de agenda:", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
