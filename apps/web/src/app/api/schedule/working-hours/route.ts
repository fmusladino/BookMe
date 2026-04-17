import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

// PUT /api/schedule/working-hours — reemplazar todos los horarios laborales
export async function PUT(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    const body = await request.json() as {
      hours: Array<{
        dayOfWeek: number;
        startTime: string;
        endTime: string;
        modality?: "presencial" | "virtual" | "both";
      }>;
    };

    // Validar que los horarios sean coherentes
    for (const h of body.hours) {
      if (h.startTime >= h.endTime) {
        return NextResponse.json(
          { error: `El horario del día ${h.dayOfWeek} es inválido: inicio debe ser anterior al fin` },
          { status: 400 }
        );
      }
    }

    // Eliminar los horarios existentes y crear los nuevos en una transacción
    const { error: deleteError } = await supabase
      .from("working_hours")
      .delete()
      .eq("professional_id", user.id);

    if (deleteError) {
      console.error("Error al eliminar horarios:", deleteError);
      return NextResponse.json({ error: "Error al actualizar horarios" }, { status: 500 });
    }

    if (body.hours.length > 0) {
      const rows = body.hours.map((h) => ({
        professional_id: user.id,
        day_of_week: h.dayOfWeek,
        start_time: h.startTime,
        end_time: h.endTime,
        modality: h.modality ?? "both",
      }));

      const { error: insertError } = await supabase
        .from("working_hours")
        .insert(rows);

      if (insertError) {
        console.error("Error al insertar horarios:", insertError);
        return NextResponse.json({ error: "Error al guardar horarios" }, { status: 500 });
      }
    }

    // Devolver los horarios actualizados
    const { data: workingHours } = await supabase
      .from("working_hours")
      .select("*")
      .eq("professional_id", user.id)
      .order("day_of_week", { ascending: true });

    return NextResponse.json({ workingHours: workingHours ?? [] });
  } catch (error) {
    console.error("Error al actualizar horarios laborales:", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
